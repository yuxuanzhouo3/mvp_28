// app/api/payment/webhook/wechat/route.ts
// 微信支付 Webhook 回调处理 (API v3)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { WechatProviderV3 } from "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { isAfter } from "date-fns";
import {
  addAddonCredits as addWalletAddonCredits,
  addCalendarMonths,
  getBeijingYMD,
  getPlanMediaLimits,
  renewMonthlyQuota,
  seedWalletForPlan,
  upgradeMonthlyQuota,
} from "@/services/wallet";

const PLAN_RANK: Record<string, number> = { Basic: 1, Pro: 2, Enterprise: 3 };

// 统一套餐名称，兼容中文/英文，返回英文 canonical key
const normalizePlanName = (p?: string) => {
  const lower = (p || "").toLowerCase();
  if (lower === "basic" || lower === "基础版") return "Basic";
  if (lower === "pro" || lower === "专业版") return "Pro";
  if (lower === "enterprise" || lower === "企业版") return "Enterprise";
  return p || "";
};

export async function POST(request: NextRequest) {
  try {
    if (!IS_DOMESTIC_VERSION) {
      return new NextResponse(null, { status: 404 });
    }

    // 1. 获取 Webhook 签名信息
    const signature = request.headers.get("Wechatpay-Signature") || "";
    const timestamp = request.headers.get("Wechatpay-Timestamp") || "";
    const nonce = request.headers.get("Wechatpay-Nonce") || "";

    // 2. 读取请求体
    const body = await request.text();

    console.log("📥 [WeChat Webhook] Received:", {
      timestamp,
      nonce,
      bodyLength: body.length,
    });

    // 3. 初始化微信支付提供商用于验证签名
    const wechatProvider = new WechatProviderV3({
      appId: process.env.WECHAT_PAY_APP_ID!,
      mchId: process.env.WECHAT_PAY_MCH_ID!,
      apiV3Key: process.env.WECHAT_PAY_API_V3_KEY!,
      privateKey: process.env.WECHAT_PAY_PRIVATE_KEY!,
      serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
      notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL}/api/payment/webhook/wechat`,
    });

    // 4. 验证签名（生产环境启用）
    if (process.env.NODE_ENV === "production") {
      const isValidSignature = wechatProvider.verifyWebhookSignature(body, signature, timestamp, nonce);
      if (!isValidSignature) {
        console.error("❌ [WeChat Webhook] Signature verification failed");
        return NextResponse.json(
          { code: "FAIL", message: "Invalid signature" },
          { status: 401 }
        );
      }
      console.log("✅ [WeChat Webhook] Signature verified");
    } else {
      console.log("⚠️ [WeChat Webhook] Skipping signature verification (non-production)");
    }

    // 5. 解析 Webhook 数据
    const webhookData = JSON.parse(body);

    console.log("📥 [WeChat Webhook] Event type:", webhookData.event_type);

    // 6. 仅处理支付成功事件
    if (webhookData.event_type !== "TRANSACTION.SUCCESS") {
      console.log(
        "⏭️ [WeChat Webhook] Ignoring event:",
        webhookData.event_type
      );
      return NextResponse.json(
        { code: "SUCCESS", message: "Ok" },
        { status: 200 }
      );
    }

    // 7. 解密回调数据
    let paymentData: any;
    try {
      paymentData = await wechatProvider.handleWebhookNotification(webhookData);
    } catch (error) {
      console.error("❌ [WeChat Webhook] Failed to decrypt data:", error);
      return NextResponse.json(
        { code: "FAIL", message: "Decryption failed" },
        { status: 400 }
      );
    }

    console.log("🔓 [WeChat Webhook] Decrypted payment data:", {
      out_trade_no: paymentData.out_trade_no,
      transaction_id: paymentData.transaction_id,
      trade_state: paymentData.trade_state,
      amount: paymentData.amount?.total,
      attach: paymentData.attach,
    });

    // 8. 检查交易状态
    if (paymentData.trade_state !== "SUCCESS") {
      console.log(
        "⏭️ [WeChat Webhook] Payment not successful:",
        paymentData.trade_state
      );
      return NextResponse.json(
        { code: "SUCCESS", message: "Ok" },
        { status: 200 }
      );
    }

    // 9. 幂等性检查：防止重复处理（只跳过已处理的事件）
    const webhookEventId = `wechat_${paymentData.transaction_id}`;
    let eventProcessed = false;

    if (IS_DOMESTIC_VERSION) {
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        const result = await db
          .collection("webhook_events")
          .where({ id: webhookEventId, processed: true })
          .get();
        eventProcessed = (result.data?.length || 0) > 0;
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error checking CloudBase event:",
          error
        );
      }
    } else {
      try {
        const { data } = await supabaseAdmin
          .from("webhook_events")
          .select("id")
          .eq("id", webhookEventId)
          .eq("processed", true)
          .maybeSingle();
        eventProcessed = !!data;
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error checking Supabase event:",
          error
        );
      }
    }

    if (eventProcessed) {
      console.log(
        "⏭️ [WeChat Webhook] Event already processed:",
        webhookEventId
      );
      return NextResponse.json(
        { code: "SUCCESS", message: "Ok" },
        { status: 200 }
      );
    }

    // 10. 记录 Webhook 事件
    const webhookEvent = {
      id: webhookEventId,
      provider: "wechat",
      event_type: "TRANSACTION.SUCCESS",
      event_data: paymentData,
      processed: false,
      created_at: new Date().toISOString(),
    };

    if (IS_DOMESTIC_VERSION) {
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        await db.collection("webhook_events").add(webhookEvent);
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error saving CloudBase event:",
          error
        );
      }
    } else {
      try {
        await supabaseAdmin.from("webhook_events").insert([webhookEvent]);
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error saving Supabase event:",
          error
        );
      }
    }

    // 11. 获取支付订单信息
    const amount = paymentData.amount?.total
      ? paymentData.amount.total / 100
      : 0;
    let paymentRecord: any = null;
    const userId = paymentData.attach || ""; // 从附加数据获取用户ID

    if (IS_DOMESTIC_VERSION) {
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        const result = await db
          .collection("payments")
          .where({ provider: "wechat", providerOrderId: paymentData.out_trade_no })
          .get();
        paymentRecord = result.data?.[0];
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error querying CloudBase payment:",
          error
        );
      }
    } else {
      try {
        const { data } = await supabaseAdmin
          .from("payments")
          .select("*")
          .eq("provider_order_id", paymentData.out_trade_no)
          .maybeSingle();
        paymentRecord = data;
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error querying Supabase payment:",
          error
        );
      }
    }

    if (!paymentRecord) {
      console.error("[WeChat Webhook] Payment record not found:", {
        out_trade_no: paymentData.out_trade_no,
      });
      return NextResponse.json(
        { code: "FAIL", message: "Payment record not found" },
        { status: 400 }
      );
    }

    const effectiveUserId = paymentRecord?.userId || userId;

    if (!effectiveUserId) {
      console.error(
        "❌ [WeChat Webhook] Payment record not found or missing user_id"
      );
      return NextResponse.json(
        { code: "FAIL", message: "Payment record not found" },
        { status: 400 }
      );
    }

    const currentStatus = (paymentRecord?.status || "").toString().toUpperCase();
    if (currentStatus === "COMPLETED") {
      return NextResponse.json({ code: "SUCCESS", message: "Ok" }, { status: 200 });
    }

    // 交易金额校验：防止金额不一致导致错误发放权益
    const expectedAmount = Number(paymentRecord?.amount || 0);
    if (expectedAmount > 0 && Math.abs(expectedAmount - amount) > 0.01) {
      console.error("[WeChat Webhook] amount mismatch", {
        out_trade_no: paymentData.out_trade_no,
        expectedAmount,
        paidAmount: amount,
      });
      return NextResponse.json(
        { code: "FAIL", message: "Amount mismatch" },
        { status: 400 }
      );
    }

    // 12. 检查是否是加油包购买
    const isAddon =
      (paymentRecord?.type as string | undefined) === "ADDON" ||
      paymentRecord?.metadata?.productType === "ADDON";

    if (isAddon) {
      // 加油包购买 - 增加用户额度
      const imageCredits =
        paymentRecord?.imageCredits ?? paymentRecord?.metadata?.imageCredits ?? 0;
      const videoAudioCredits =
        paymentRecord?.videoAudioCredits ??
        paymentRecord?.metadata?.videoAudioCredits ??
        0;

      console.log("📦 [WeChat Webhook] Processing addon purchase:", {
        userId: effectiveUserId,
        imageCredits,
        videoAudioCredits,
      });

      const addResult = await addWalletAddonCredits(
        effectiveUserId,
        Number(imageCredits) || 0,
        Number(videoAudioCredits) || 0
      );

      if (!addResult.success) {
        console.error("❌ [WeChat Webhook] Failed to add addon credits");
        return NextResponse.json(
          { code: "FAIL", message: "Failed to add addon credits" },
          { status: 500 }
        );
      }
    } else {
      // 订阅购买 - 更新订阅状态
      const period = (paymentRecord?.period || paymentRecord?.metadata?.billingCycle || "monthly") as
        | "monthly"
        | "annual";
      const days = Number(paymentRecord?.metadata?.days) || (period === "annual" ? 365 : 30);
      const planName = normalizePlanName(paymentRecord?.plan || paymentRecord?.metadata?.planName || "Pro") || "Pro";

      console.log("📦 [WeChat Webhook] Processing subscription:", {
        userId: effectiveUserId,
        days,
        planName,
        paymentRecordFound: !!paymentRecord,
        metadata: paymentRecord?.metadata,
      });

      await applySubscriptionPayment(
        effectiveUserId,
        paymentData.out_trade_no,
        paymentData.transaction_id,
        period,
        days,
        planName
      );
    }

    // 13. 更新支付订单状态
    const updateData = {
      status: "COMPLETED",
      providerTransactionId: paymentData.transaction_id,
      updatedAt: new Date().toISOString(),
    };

    if (IS_DOMESTIC_VERSION) {
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        await db
          .collection("payments")
          .where({ provider: "wechat", providerOrderId: paymentData.out_trade_no })
          .update(updateData);
        console.log(
          "✅ [WeChat Webhook] Updated CloudBase payment:",
          paymentData.out_trade_no
        );
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error updating CloudBase payment:",
          error
        );
      }
    } else {
      try {
        await supabaseAdmin
          .from("payments")
          .update(updateData)
          .eq("provider_order_id", paymentData.out_trade_no);
        console.log(
          "✅ [WeChat Webhook] Updated Supabase payment:",
          paymentData.out_trade_no
        );
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error updating Supabase payment:",
          error
        );
      }
    }

    // 14. 标记 Webhook 事件为已处理
    if (IS_DOMESTIC_VERSION) {
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        await db
          .collection("webhook_events")
          .where({ id: webhookEventId })
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
          });
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error updating CloudBase event:",
          error
        );
      }
    } else {
      try {
        await supabaseAdmin
          .from("webhook_events")
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq("id", webhookEventId);
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error updating Supabase event:",
          error
        );
      }
    }

    console.log("✅ [WeChat Webhook] Successfully processed:", webhookEventId);

    // 15. 返回成功响应给微信
    return NextResponse.json(
      {
        code: "SUCCESS",
        message: "Ok",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ [WeChat Webhook] Processing error:", error);

    // 返回失败响应，微信会继续重试
    return NextResponse.json(
      {
        code: "FAIL",
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * 国内版：应用订阅购买结果（同级顺延 / 升级立即生效并重置周期 / 降级延期生效）
 * 说明：微信支付为一次性购买周期，本函数仅负责落库与配额初始化/刷新。
 */
async function applySubscriptionPayment(
  userId: string,
  providerOrderId: string,
  _providerTransactionId: string,
  period: "monthly" | "annual",
  days: number,
  planName: string,
): Promise<void> {
  if (!IS_DOMESTIC_VERSION) return;

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  const now = new Date();
  const nowIso = now.toISOString();
  const plan = normalizePlanName(planName) || "Pro";
  const planLower = plan.toLowerCase();

  const userRes = await db.collection("users").doc(userId).get();
  const userDoc = userRes?.data?.[0] || null;
  if (!userDoc) {
    console.error("[WeChat Webhook] user not found:", userId);
    return;
  }

  const currentPlanKey = normalizePlanName(userDoc?.plan || userDoc?.subscriptionTier || "");
  const currentPlanExp = userDoc?.plan_exp ? new Date(userDoc.plan_exp) : null;
  const currentPlanActive = currentPlanExp ? isAfter(currentPlanExp, now) : false;

  const purchasePlanKey = normalizePlanName(plan);
  const purchaseRank = PLAN_RANK[purchasePlanKey] || 0;
  const currentRank = PLAN_RANK[currentPlanKey] || 0;
  const isUpgrade = purchaseRank > currentRank && currentPlanActive;
  const isDowngrade = purchaseRank < currentRank && currentPlanActive;
  const isSameActive = purchaseRank === currentRank && currentPlanActive;
  const isNewOrExpired = !currentPlanActive || !currentPlanKey;

  const { imageLimit, videoLimit } = getPlanMediaLimits(planLower);
  const anchorDayNow = getBeijingYMD(now).day;
  const existingAnchorDay =
    userDoc?.wallet?.billing_cycle_anchor ||
    (userDoc?.wallet?.monthly_reset_at
      ? getBeijingYMD(new Date(userDoc.wallet.monthly_reset_at)).day
      : null) ||
    (currentPlanExp ? getBeijingYMD(currentPlanExp).day : null) ||
    anchorDayNow;

  const monthsToAdd = period === "annual" ? 12 : 1;
  const anchorDay = isUpgrade || isNewOrExpired ? anchorDayNow : existingAnchorDay;
  const baseDate = isSameActive && currentPlanExp ? currentPlanExp : now;
  const purchaseExpiresAt = addCalendarMonths(baseDate, monthsToAdd, anchorDay);

  const subsColl = db.collection("subscriptions");

  // 降级：延期生效（支持多重降级队列，按等级排序：高级先生效）
  if (isDowngrade) {
    // 1. 查询用户所有待生效的 pending 订阅
    const existingPendingRes = await subsColl.where({ userId, status: "pending" }).get();
    const existingPendingSubs = existingPendingRes?.data || [];

    // 2. 创建新的 pending 订阅记录（先用临时时间，后面会重新计算）
    const tempStart = currentPlanExp && currentPlanActive ? currentPlanExp : now;
    const newSubRes = await subsColl.add({
      userId,
      plan,
      period,
      status: "pending",
      provider: "wechat",
      providerOrderId,
      startedAt: tempStart.toISOString(),
      expiresAt: addCalendarMonths(tempStart, monthsToAdd, existingAnchorDay).toISOString(),
      updatedAt: nowIso,
      createdAt: nowIso,
      type: "SUBSCRIPTION",
    });

    // 3. 将所有 pending 订阅（包括新的）按等级降序排列，同等级按创建时间升序
    const allPendingSubs = [
      ...existingPendingSubs.map((s: any) => ({
        _id: s._id,
        plan: normalizePlanName(s.plan),
        period: s.period,
        rank: PLAN_RANK[normalizePlanName(s.plan)] || 0,
        createdAt: s.createdAt || nowIso,
      })),
      {
        _id: newSubRes?.id,
        plan,
        period,
        rank: purchaseRank,
        createdAt: nowIso,
      },
    ].sort((a, b) => {
      // 先按等级降序（高级先生效）
      if (b.rank !== a.rank) return b.rank - a.rank;
      // 同等级按创建时间升序（先买的先生效）
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // 4. 重新计算每个订阅的 startedAt 和 expiresAt
    let nextStartDate = currentPlanExp && currentPlanActive ? currentPlanExp : now;
    const updatedQueue: { targetPlan: string; effectiveAt: string; expiresAt: string }[] = [];

    for (const pendingSub of allPendingSubs) {
      const subPeriod = pendingSub.period === "annual" ? 12 : 1;
      const subExpires = addCalendarMonths(nextStartDate, subPeriod, existingAnchorDay);

      // 更新订阅记录的时间
      if (pendingSub._id) {
        await subsColl.doc(pendingSub._id).update({
          startedAt: nextStartDate.toISOString(),
          expiresAt: subExpires.toISOString(),
          updatedAt: nowIso,
        });
      }

      updatedQueue.push({
        targetPlan: pendingSub.plan,
        effectiveAt: nextStartDate.toISOString(),
        expiresAt: subExpires.toISOString(),
      });

      // 下一个订阅从这个订阅到期后开始
      nextStartDate = subExpires;
    }

    // 5. 更新用户的 pendingDowngrade 为数组（按生效顺序）
    await db.collection("users").doc(userId).update({
      pendingDowngrade: updatedQueue.length > 0 ? updatedQueue : null,
      updatedAt: nowIso,
    });

    console.log("[WeChat Webhook] Downgrade queue updated:", {
      userId,
      newPlan: plan,
      queue: updatedQueue,
    });

    return;
  }

  // 新购/续费/升级：立即生效
  const subPayload = {
    userId,
    plan,
    period,
    status: "active",
    provider: "wechat",
    providerOrderId,
    startedAt: nowIso,
    expiresAt: purchaseExpiresAt.toISOString(),
    updatedAt: nowIso,
    type: "SUBSCRIPTION",
  };

  const existing = await subsColl
    .where({ userId, provider: "wechat", plan })
    .limit(1)
    .get();

  if (existing?.data?.[0]?._id) {
    await subsColl.doc(existing.data[0]._id).update(subPayload);
  } else {
    await subsColl.add({ ...subPayload, createdAt: nowIso });
  }

  // 升级时清理低等级的待生效降级订阅
  // 注意：同级续费不清理，因为用户已经为这些降级付费，应该让它们在当前订阅到期后依次生效
  if (isUpgrade) {
    const pendingRes = await subsColl.where({ userId, status: "pending" }).get();
    const pendingSubs = pendingRes?.data || [];
    const toDeleteIds: string[] = [];
    const toKeepSubs: { targetPlan: string; effectiveAt: string; expiresAt: string }[] = [];

    for (const pendingSub of pendingSubs) {
      const pendingRank = PLAN_RANK[normalizePlanName(pendingSub.plan)] || 0;
      if (pendingRank <= purchaseRank) {
        // 等级低于或等于当前购买的订阅，删除
        toDeleteIds.push(pendingSub._id);
      } else {
        // 等级高于当前购买的订阅，保留但需要重新计算时间
        toKeepSubs.push({
          targetPlan: normalizePlanName(pendingSub.plan),
          effectiveAt: purchaseExpiresAt.toISOString(),
          expiresAt: addCalendarMonths(purchaseExpiresAt, pendingSub.period === "annual" ? 12 : 1, anchorDay).toISOString(),
        });
      }
    }

    // 删除低等级的 pending 订阅
    for (const docId of toDeleteIds) {
      try {
        await subsColl.doc(docId).remove();
      } catch (e) {
        console.warn("[WeChat Webhook] Failed to remove pending subscription:", docId, e);
      }
    }

    // 更新保留的高等级 pending 订阅的生效时间
    let nextStart = purchaseExpiresAt;
    for (let i = 0; i < toKeepSubs.length; i++) {
      const keep = toKeepSubs[i];
      const matchRes = await subsColl.where({ userId, plan: keep.targetPlan, status: "pending" }).limit(1).get();
      if (matchRes?.data?.[0]?._id) {
        const subPeriod = matchRes.data[0].period === "annual" ? 12 : 1;
        const newExpire = addCalendarMonths(nextStart, subPeriod, anchorDay);
        await subsColl.doc(matchRes.data[0]._id).update({
          startedAt: nextStart.toISOString(),
          expiresAt: newExpire.toISOString(),
          updatedAt: nowIso,
        });
        toKeepSubs[i] = {
          targetPlan: keep.targetPlan,
          effectiveAt: nextStart.toISOString(),
          expiresAt: newExpire.toISOString(),
        };
        nextStart = newExpire;
      }
    }

    console.log("[WeChat Webhook] Cleaned pending subscriptions:", {
      userId,
      deleted: toDeleteIds.length,
      kept: toKeepSubs.length,
    });
  }

  await db.collection("users").doc(userId).update({
    pro: planLower !== "basic",
    plan,
    plan_exp: purchaseExpiresAt.toISOString(),
    subscriptionTier: plan,
    pendingDowngrade: null,
    updatedAt: nowIso,
  });

  if (isUpgrade || isNewOrExpired) {
    await upgradeMonthlyQuota(userId, imageLimit, videoLimit);
  } else if (isSameActive) {
    await renewMonthlyQuota(userId);
  }

  await seedWalletForPlan(userId, planLower, {
    forceReset: isUpgrade || isNewOrExpired,
  });
}

/**
 * 更新订阅状态
 */
async function updateSubscription(
  userId: string,
  outTradeNo: string,
  transactionId: string,
  days: number,
  planName: string = "Pro"
): Promise<void> {
  const now = new Date();
  let newExpiresAt: Date;
  const planId = planName.toLowerCase(); // basic, pro, enterprise

  if (IS_DOMESTIC_VERSION) {
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();

      // 获取现有订阅（查询该用户的任何活跃订阅）
      const existingSubscription = await db
        .collection("subscriptions")
        .where({
          user_id: userId,
          status: "active",
        })
        .get();

      if (
        existingSubscription.data &&
        existingSubscription.data.length > 0
      ) {
        const subscription = existingSubscription.data[0];
        const currentExpiresAt = new Date(subscription.current_period_end);

        console.log("📊 [WeChat Webhook] Existing subscription found:", {
          subscriptionId: subscription._id,
          currentExpiresAt: currentExpiresAt.toISOString(),
          now: now.toISOString(),
          isExpired: currentExpiresAt <= now,
          daysToAdd: days,
        });

        if (currentExpiresAt > now) {
          // 延长现有订阅
          newExpiresAt = new Date(currentExpiresAt);
          newExpiresAt.setDate(newExpiresAt.getDate() + days);
          console.log("📈 [WeChat Webhook] Extending subscription:", {
            from: currentExpiresAt.toISOString(),
            to: newExpiresAt.toISOString(),
            daysAdded: days,
          });
        } else {
          // 从现在开始
          newExpiresAt = new Date();
          newExpiresAt.setDate(newExpiresAt.getDate() + days);
          console.log("🆕 [WeChat Webhook] Starting fresh subscription:", {
            from: now.toISOString(),
            to: newExpiresAt.toISOString(),
            daysAdded: days,
          });
        }

        await db
          .collection("subscriptions")
          .doc(subscription._id)
          .update({
            plan_id: planId,
            current_period_end: newExpiresAt.toISOString(),
            transaction_id: transactionId,
            updated_at: now.toISOString(),
          });

        console.log(
          "✅ [WeChat Webhook] Updated CloudBase subscription:",
          userId,
          "new expires at:",
          newExpiresAt.toISOString()
        );
      } else {
        // 创建新订阅
        newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + days);

        await db.collection("subscriptions").add({
          user_id: userId,
          plan_id: planId,
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: newExpiresAt.toISOString(),
          cancel_at_period_end: false,
          payment_method: "wechat",
          transaction_id: transactionId,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        });

        console.log(
          "✅ [WeChat Webhook] Created CloudBase subscription:",
          userId
        );
      }

      // 同步到 web_users
      try {
        const userQuery = await db
          .collection("web_users")
          .where({ _id: userId })
          .get();

        if (userQuery.data && userQuery.data.length > 0) {
          // 根据套餐设置会员等级
          const membershipLevel = planId; // basic, pro, enterprise
          await db.collection("web_users").doc(userId).update({
            membership_expires_at: newExpiresAt.toISOString(),
            membership_level: membershipLevel,
            pro: planId === "pro" || planId === "enterprise",
            updated_at: now.toISOString(),
          });
        }
      } catch (error) {
        console.error(
          "❌ [WeChat Webhook] Error syncing to web_users:",
          error
        );
      }
    } catch (error) {
      console.error(
        "❌ [WeChat Webhook] Error updating CloudBase subscription:",
        error
      );
    }
  } else {
    try {
      // Supabase 订阅更新
      const { data: existingSubscription } = await supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (existingSubscription) {
        const currentExpiresAt = new Date(
          existingSubscription.current_period_end
        );

        if (currentExpiresAt > now) {
          newExpiresAt = new Date(currentExpiresAt);
          newExpiresAt.setDate(newExpiresAt.getDate() + days);
        } else {
          newExpiresAt = new Date();
          newExpiresAt.setDate(newExpiresAt.getDate() + days);
        }

        await supabaseAdmin
          .from("subscriptions")
          .update({
            plan_id: planId,
            current_period_end: newExpiresAt.toISOString(),
            provider_subscription_id: outTradeNo,
            updated_at: now.toISOString(),
          })
          .eq("id", existingSubscription.id);

        console.log(
          "✅ [WeChat Webhook] Updated Supabase subscription:",
          userId
        );
      } else {
        newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + days);

        await supabaseAdmin.from("subscriptions").insert({
          user_id: userId,
          plan_id: planId,
          status: "active",
          provider_subscription_id: outTradeNo,
          current_period_start: now.toISOString(),
          current_period_end: newExpiresAt.toISOString(),
        });

        console.log(
          "✅ [WeChat Webhook] Created Supabase subscription:",
          userId
        );
      }
    } catch (error) {
      console.error(
        "❌ [WeChat Webhook] Error updating Supabase subscription:",
        error
      );
    }
  }
}
