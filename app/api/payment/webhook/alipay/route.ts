// app/api/payment/webhook/alipay/route.ts - 支付宝 Webhook 处理
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { isAfter } from "date-fns";
import {
  addAddonCredits,
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
    console.log("🔔 [Alipay Webhook] 收到 webhook 请求");

    // 支付宝在POST body中以form-urlencoded格式传递数据
    const formData = await request.formData();
    const params: Record<string, string> = {};

    // 收集所有参数
    formData.forEach((value, key) => {
      params[key] = value as string;
    });

    console.log("📝 [Alipay Webhook] 接收到的参数:", {
      outTradeNo: params.out_trade_no,
      tradeNo: params.trade_no,
      tradeStatus: params.trade_status,
      totalAmount: params.total_amount,
      passbackParams: params.passback_params,
      hasSignature: !!params.sign,
    });

    // 验证支付宝签名
    const isValidSignature = verifyAlipaySignature(
      params,
      process.env.ALIPAY_ALIPAY_PUBLIC_KEY
    );

    console.log(
      "🔐 [Alipay Webhook] 签名验证:",
      isValidSignature ? "✅ 通过" : "❌ 失败"
    );

    if (!isValidSignature) {
      console.error("❌ [Alipay Webhook] Invalid Alipay webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 检查支付状态
    const tradeStatus = params.trade_status;
    console.log("💰 [Alipay Webhook] 支付状态:", tradeStatus);

    if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
      console.log(
        "⏭️  [Alipay Webhook] 支付状态不是最终状态，忽略:",
        tradeStatus
      );
      return NextResponse.json({ status: "ignored" });
    }

    console.log("✅ [Alipay Webhook] 支付成功，开始处理");

    const success = await processAlipayWebhook(tradeStatus, params);

    console.log(
      "📊 [Alipay Webhook] 处理结果:",
      success ? "✅ 成功" : "❌ 失败"
    );

    if (success) {
      // 支付宝要求返回success字符串
      console.log("✨ [Alipay Webhook] 返回 success");
      return new NextResponse("success");
    } else {
      console.error("❌ [Alipay Webhook] Failed to process Alipay webhook");
      return new NextResponse("failure");
    }
  } catch (error) {
    console.error("❌ [Alipay Webhook] 异常错误:", error);
    return new NextResponse("failure");
  }
}

async function processAlipayWebhook(
  _tradeStatus: string,
  params: Record<string, string>
): Promise<boolean> {
  const outTradeNo = params.out_trade_no || "";
  const tradeNo = params.trade_no || "";
  const totalAmount = parseFloat(params.total_amount || "0");

  if (!outTradeNo) {
    console.error("[Alipay Webhook] Missing out_trade_no");
    return false;
  }

  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const payRes = await db
      .collection("payments")
      .where({ provider: "alipay", providerOrderId: outTradeNo })
      .limit(1)
      .get();

    const paymentRecord = (payRes?.data?.[0] as any | undefined) || null;
    if (!paymentRecord) {
      console.error("[Alipay Webhook] Payment record not found:", outTradeNo);
      return false;
    }

    const currentStatus = (paymentRecord.status || "").toString().toUpperCase();
    if (currentStatus === "COMPLETED") {
      return true;
    }

    const expectedAmount = Number(paymentRecord.amount || 0);
    if (
      expectedAmount > 0 &&
      Number.isFinite(totalAmount) &&
      Math.abs(expectedAmount - totalAmount) > 0.01
    ) {
      console.error("[Alipay Webhook] amount mismatch", {
        outTradeNo,
        expectedAmount,
        paidAmount: totalAmount,
      });
      return false;
    }

    const userId = (paymentRecord.userId || paymentRecord.user_id || "") as string;
    if (!userId) {
      console.error("[Alipay Webhook] Missing userId in payment record:", outTradeNo);
      return false;
    }

    const productType = (paymentRecord.type || paymentRecord?.metadata?.productType || "SUBSCRIPTION")
      .toString()
      .toUpperCase();
    const isAddon = productType === "ADDON";

    if (isAddon) {
      const imageCredits =
        paymentRecord?.imageCredits ?? paymentRecord?.metadata?.imageCredits ?? 0;
      const videoAudioCredits =
        paymentRecord?.videoAudioCredits ??
        paymentRecord?.metadata?.videoAudioCredits ??
        0;

      const addRes = await addAddonCredits(
        userId,
        Number(imageCredits) || 0,
        Number(videoAudioCredits) || 0
      );
      if (!addRes.success) {
        console.error("[Alipay Webhook] Failed to add addon credits:", addRes.error);
        return false;
      }
    } else {
      const period = (paymentRecord.period || paymentRecord?.metadata?.billingCycle || "monthly") as
        | "monthly"
        | "annual";
      const days = Number(paymentRecord?.metadata?.days) || (period === "annual" ? 365 : 30);
      const planName =
        normalizePlanName(paymentRecord.plan || paymentRecord?.metadata?.planName || "Pro") ||
        "Pro";

      await applySubscriptionPayment(userId, outTradeNo, period, days, planName);
    }

    const updatePayload = {
      status: "COMPLETED",
      providerTransactionId: tradeNo || null,
      updatedAt: new Date().toISOString(),
    };

    if (paymentRecord._id) {
      await db.collection("payments").doc(paymentRecord._id).update(updatePayload);
    } else {
      await db
        .collection("payments")
        .where({ provider: "alipay", providerOrderId: outTradeNo })
        .update(updatePayload);
    }

    return true;
  } catch (error) {
    console.error("[Alipay Webhook] process error", error);
    return false;
  }
}

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
    console.error("[Alipay Webhook] user not found:", userId);
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

  // 降级：延期生效（不改变当前用户的 plan / plan_exp）
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
      provider: "alipay",
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
    provider: "alipay",
    providerOrderId,
    startedAt: nowIso,
    expiresAt: purchaseExpiresAt.toISOString(),
    updatedAt: nowIso,
    type: "SUBSCRIPTION",
  };

  const existing = await subsColl
    .where({ userId, provider: "alipay", plan })
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

/**
 * 验证支付宝签名
 */
function verifyAlipaySignature(
  params: Record<string, string>,
  publicKey?: string
): boolean {
  try {
    // 仅在非生产环境或沙箱模式下跳过签名验证
    if (
      process.env.NODE_ENV !== "production" ||
      process.env.ALIPAY_SANDBOX === "true"
    ) {
      console.log("⚠️ [Alipay Webhook] 跳过签名验证 (非生产/沙箱环境)");
      return true;
    }

    if (!publicKey) {
      console.error("Missing Alipay public key");
      return false;
    }

    // 从参数中提取签名
    const sign = params.sign;
    const signType = params.sign_type;

    if (!sign || signType !== "RSA2") {
      console.error("Missing or invalid Alipay signature");
      return false;
    }

    // 移除签名相关参数
    const paramsToSign = { ...params };
    delete paramsToSign.sign;
    delete paramsToSign.sign_type;

    // 排序参数
    const sortedKeys = Object.keys(paramsToSign).sort();
    const signString = sortedKeys
      .map((key) => `${key}=${paramsToSign[key]}`)
      .join("&");

    // 验证RSA2签名
    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(signString, "utf8");

    const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;

    const isValid = verify.verify(publicKeyPem, sign, "base64");

    if (!isValid) {
      console.error("Alipay signature verification failed");
    }

    return isValid;
  } catch (error) {
    console.error("Alipay signature verification error:", error);
    return false;
  }
}
