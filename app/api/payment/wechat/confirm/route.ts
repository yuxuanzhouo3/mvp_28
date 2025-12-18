// app/api/payment/wechat/confirm/route.ts
// 微信支付确认 API - 用于前端轮询时主动确认支付状态并处理业务逻辑

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

export const runtime = "nodejs";

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
      appId: process.env.WECHAT_APP_ID!,
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

  // 降级：延期生效
  if (isDowngrade) {
    const scheduledStart = currentPlanExp && currentPlanActive ? currentPlanExp : now;
    const scheduledExpire = addCalendarMonths(scheduledStart, monthsToAdd, existingAnchorDay);
    const pendingDowngrade = {
      targetPlan: plan,
      effectiveAt: scheduledStart.toISOString(),
    };

    await subsColl.add({
      userId,
      plan,
      period,
      status: "pending",
      provider: "wechat",
      providerOrderId,
      startedAt: scheduledStart.toISOString(),
      expiresAt: scheduledExpire.toISOString(),
      updatedAt: nowIso,
      createdAt: nowIso,
      type: "SUBSCRIPTION",
    });

    await db.collection("users").doc(userId).update({
      pendingDowngrade,
      updatedAt: nowIso,
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
