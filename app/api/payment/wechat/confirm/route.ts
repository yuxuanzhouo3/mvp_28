// app/api/payment/wechat/confirm/route.ts
// 微信支付确认 API - 用于前端轮询时主动确认支付状态并处理业务逻辑
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { WechatProviderV3 } from "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider";
import {
  addAddonCredits,
  addCalendarMonths,
  getBeijingYMD,
  getPlanMediaLimits,
  renewMonthlyQuota,
  seedWalletForPlan,
  upgradeMonthlyQuota,
} from "@/services/wallet";
import { isAfter } from "date-fns";

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
      return NextResponse.json(
        { success: false, error: "Only available in domestic version" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { outTradeNo } = body as { outTradeNo?: string };

    if (!outTradeNo) {
      return NextResponse.json(
        { success: false, error: "Missing outTradeNo" },
        { status: 400 }
      );
    }

    console.log("📥 [WeChat Confirm] Processing:", outTradeNo);

    // 1. 查询本地支付记录
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const payRes = await db
      .collection("payments")
      .where({ provider: "wechat", providerOrderId: outTradeNo })
      .limit(1)
      .get();

    const paymentRecord = (payRes?.data?.[0] as any | undefined) || null;

    if (!paymentRecord) {
      console.error("[WeChat Confirm] Payment record not found:", outTradeNo);
      return NextResponse.json(
        { success: false, error: "Payment record not found" },
        { status: 404 }
      );
    }

    // 2. 检查是否已经处理过
    const currentStatus = (paymentRecord.status || "").toString().toUpperCase();
    if (currentStatus === "COMPLETED") {
      console.log("[WeChat Confirm] Already completed:", outTradeNo);
      return NextResponse.json({
        success: true,
        status: "COMPLETED",
        message: "Payment already processed",
        productType: paymentRecord.type,
      });
    }

    // 3. 查询微信支付确认支付状态
    const wechatProvider = new WechatProviderV3({
      appId: process.env.WECHAT_PAY_APP_ID!,
      mchId: process.env.WECHAT_PAY_MCH_ID!,
      apiV3Key: process.env.WECHAT_PAY_API_V3_KEY!,
      privateKey: process.env.WECHAT_PAY_PRIVATE_KEY!,
      serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
      notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL}/api/payment/webhook/wechat`,
    });

    let wechatStatus: any;

    try {
      wechatStatus = await wechatProvider.queryOrderByOutTradeNo(outTradeNo);
      console.log("[WeChat Confirm] WeChat query result:", wechatStatus);
    } catch (queryError) {
      console.error("[WeChat Confirm] Query failed:", queryError);
      return NextResponse.json(
        { success: false, error: "Failed to query WeChat payment status" },
        { status: 500 }
      );
    }

    // 4. 检查支付状态
    const tradeState = wechatStatus?.tradeState;
    if (tradeState !== "SUCCESS") {
      console.log("[WeChat Confirm] Payment not successful:", tradeState);
      return NextResponse.json({
        success: false,
        status: tradeState || "UNKNOWN",
        error: "Payment not completed",
      });
    }

    // 5. 处理业务逻辑
    const userId = (paymentRecord.userId || paymentRecord.user_id || "") as string;
    if (!userId) {
      console.error("[WeChat Confirm] Missing userId in payment record:", outTradeNo);
      return NextResponse.json(
        { success: false, error: "Missing userId in payment record" },
        { status: 400 }
      );
    }

    const productType = (paymentRecord.type || paymentRecord?.metadata?.productType || "SUBSCRIPTION")
      .toString()
      .toUpperCase();
    const isAddon = productType === "ADDON";

    if (isAddon) {
      // 加油包处理
      const imageCredits =
        paymentRecord?.imageCredits ?? paymentRecord?.metadata?.imageCredits ?? 0;
      const videoAudioCredits =
        paymentRecord?.videoAudioCredits ??
        paymentRecord?.metadata?.videoAudioCredits ??
        0;

      console.log("[WeChat Confirm] Processing addon:", {
        userId,
        imageCredits,
        videoAudioCredits,
      });

      const addRes = await addAddonCredits(
        userId,
        Number(imageCredits) || 0,
        Number(videoAudioCredits) || 0
      );

      if (!addRes.success) {
        console.error("[WeChat Confirm] Failed to add addon credits:", addRes.error);
        return NextResponse.json(
          { success: false, error: addRes.error || "Failed to add addon credits" },
          { status: 500 }
        );
      }

      console.log("[WeChat Confirm] Addon credits added successfully");
    } else {
      // 订阅处理
      const period = (paymentRecord.period || paymentRecord?.metadata?.billingCycle || "monthly") as
        | "monthly"
        | "annual";
      const days = Number(paymentRecord?.metadata?.days) || (period === "annual" ? 365 : 30);
      const planName =
        normalizePlanName(paymentRecord.plan || paymentRecord?.metadata?.planName || "Pro") ||
        "Pro";

      console.log("[WeChat Confirm] Processing subscription:", {
        userId,
        planName,
        period,
        days,
      });

      await applySubscriptionPayment(userId, outTradeNo, period, days, planName);
    }

    // 6. 更新支付记录状态
    const updatePayload = {
      status: "COMPLETED",
      providerTransactionId: wechatStatus?.transactionId || null,
      updatedAt: new Date().toISOString(),
    };

    if (paymentRecord._id) {
      await db.collection("payments").doc(paymentRecord._id).update(updatePayload);
    } else {
      await db
        .collection("payments")
        .where({ provider: "wechat", providerOrderId: outTradeNo })
        .update(updatePayload);
    }

    console.log("✅ [WeChat Confirm] Payment confirmed and processed:", outTradeNo);

    return NextResponse.json({
      success: true,
      status: "COMPLETED",
      productType: isAddon ? "ADDON" : "SUBSCRIPTION",
      message: isAddon ? "Addon credits added successfully" : "Subscription activated successfully",
    });
  } catch (error) {
    console.error("❌ [WeChat Confirm] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to confirm payment",
      },
      { status: 500 }
    );
  }
}

/**
 * 应用订阅购买结果
 */
async function applySubscriptionPayment(
  userId: string,
  providerOrderId: string,
  period: "monthly" | "annual",
  days: number,
  planName: string
): Promise<void> {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();
  const _ = db.command; // CloudBase 命令对象，用于 set/remove 等操作

  const now = new Date();
  const nowIso = now.toISOString();
  const plan = normalizePlanName(planName) || "Pro";
  const planLower = plan.toLowerCase();

  const userRes = await db.collection("users").doc(userId).get();
  const userDoc = userRes?.data?.[0] || null;
  if (!userDoc) {
    console.error("[WeChat Confirm] user not found:", userId);
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
    const pendingSubsRes = await subsColl
      .where({ userId, status: "pending" })
      .get();
    const existingPendingSubs = (pendingSubsRes?.data || []) as any[];

    // 2. 创建新的 pending 订阅记录（先用临时时间，后面会重新计算）
    const tempStart = currentPlanExp && currentPlanActive ? currentPlanExp : now;
    const newPendingSub = {
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
    };

    // 添加新订阅到数据库
    const addResult = await subsColl.add(newPendingSub);
    const newSubId = addResult?.id;

    // 3. 将所有 pending 订阅（包括新的）按等级降序排列，同等级按创建时间升序
    const allPendingSubs = [
      ...existingPendingSubs.map((s: any) => ({
        _id: s._id,
        plan: normalizePlanName(s.plan),
        period: s.period,
        rank: PLAN_RANK[normalizePlanName(s.plan)] || 0,
        createdAt: s.createdAt || s.created_at || nowIso, // 用于同等级排序
      })),
      {
        _id: newSubId,
        plan,
        period,
        rank: purchaseRank,
        createdAt: nowIso, // 新订阅的创建时间
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
      pendingDowngrade: _.set(updatedQueue.length > 0 ? updatedQueue : null),
      updatedAt: nowIso,
    });

    console.log("[WeChat Confirm] Downgrade queue updated:", {
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

  // 更新用户订阅信息，使用 _.set(null) 清除 pendingDowngrade
  await db.collection("users").doc(userId).update({
    pro: planLower !== "basic",
    plan,
    plan_exp: purchaseExpiresAt.toISOString(),
    subscriptionTier: plan,
    pendingDowngrade: _.set(null),
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
