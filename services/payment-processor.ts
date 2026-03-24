/**
 * 支付处理公共服务
 * 抽取 confirm 和 webhook 中的重复逻辑，遵循 DRY 原则
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import {
  addSupabaseAddonCredits,
  addCalendarMonths,
  getBeijingYMD,
  getSupabasePlanMediaLimits,
  renewSupabaseMonthlyQuota,
  seedSupabaseWalletForPlan,
  updateSupabaseSubscription,
  upgradeSupabaseMonthlyQuota,
} from "@/services/wallet-supabase";
import {
  addAddonCredits,
  upgradeMonthlyQuota,
  renewMonthlyQuota,
  seedWalletForPlan,
  getPlanMediaLimits,
} from "@/services/wallet";
import { trackPaymentEvent, trackSubscriptionEvent } from "@/services/analytics";
import { normalizePlanName, PLAN_RANK, isUpgrade, isDowngrade, isSamePlanRenewal } from "@/utils/plan-utils";
import { isAfter, addDays } from "date-fns";

// =============================================================================
// 类型定义
// =============================================================================

export interface PaymentMetadata {
  userId?: string;
  productType?: "SUBSCRIPTION" | "ADDON";
  planName?: string;
  billingCycle?: "monthly" | "annual";
  days?: string;
  isUpgrade?: string;
  addonPackageId?: string;
  imageCredits?: string;
  videoAudioCredits?: string;
  expectedAmountCents?: string;
  expectedAmount?: string;
}

export interface ProcessPaymentParams {
  sessionId: string;
  metadata: PaymentMetadata;
  amount: number;
  currency: string;
  provider: "stripe" | "paypal";
  source: "confirm" | "webhook";
}

export interface ProcessPaymentResult {
  success: boolean;
  status?: string;
  error?: string;
  data?: Record<string, any>;
}

// =============================================================================
// 幂等性检查
// =============================================================================

/**
 * 检查支付是否已处理（幂等性）
 */
export async function checkPaymentProcessed(
  sessionId: string,
  provider: string
): Promise<boolean> {
  if (IS_DOMESTIC_VERSION) {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const existingRes = await db
      .collection("payments")
      .where({ providerOrderId: sessionId, provider })
      .limit(1)
      .get();

    return !!(existingRes?.data?.[0]);
  } else if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("provider_order_id", sessionId)
      .eq("provider", provider)
      .maybeSingle();

    return !!data;
  }

  return false;
}

// =============================================================================
// 加油包处理
// =============================================================================

/**
 * 处理加油包购买
 */
export async function processAddonPayment(params: {
  userId: string;
  sessionId: string;
  provider: string;
  amount: number;
  currency: string;
  addonPackageId: string;
  imageCredits: number;
  videoAudioCredits: number;
}): Promise<ProcessPaymentResult> {
  const { userId, sessionId, provider, amount, currency, addonPackageId, imageCredits, videoAudioCredits } = params;

  // 检查幂等性
  const alreadyProcessed = await checkPaymentProcessed(sessionId, provider);
  if (alreadyProcessed) {
    return {
      success: true,
      status: "already_processed",
      data: { productType: "ADDON", addonPackageId, imageCredits, videoAudioCredits },
    };
  }

  if (IS_DOMESTIC_VERSION) {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 记录支付
    await db.collection("payments").add({
      userId,
      provider,
      providerOrderId: sessionId,
      amount,
      currency,
      status: "COMPLETED",
      type: "ADDON",
      addonPackageId,
      imageCredits,
      videoAudioCredits,
      createdAt: new Date().toISOString(),
      source: "cn",
    });

    // 增加额度
    const addResult = await addAddonCredits(userId, imageCredits, videoAudioCredits);
    if (!addResult.success) {
      console.error("[payment-processor][addon-credit-error]", addResult.error);
    }
  } else if (supabaseAdmin) {
    // 记录支付
    await supabaseAdmin.from("payments").insert({
      user_id: userId,
      provider,
      provider_order_id: sessionId,
      amount,
      currency,
      status: "COMPLETED",
      type: "ADDON",
      addon_package_id: addonPackageId,
      image_credits: imageCredits,
      video_audio_credits: videoAudioCredits,
      source: "global",
    });

    // 增加额度
    const addResult = await addSupabaseAddonCredits(userId, imageCredits, videoAudioCredits);
    if (!addResult.success) {
      console.error("[payment-processor][addon-credit-error]", addResult.error);
    }
  }

  // 埋点
  trackPaymentEvent(userId, {
    amount,
    currency,
    plan: "ADDON",
    provider,
    orderId: sessionId,
  }).catch((err) => console.warn("[payment-processor] trackPaymentEvent error:", err));

  return {
    success: true,
    status: "COMPLETED",
    data: { productType: "ADDON", addonPackageId, imageCredits, videoAudioCredits, amount, currency },
  };
}

// =============================================================================
// 订阅处理 - 国际版
// =============================================================================

/**
 * 处理国际版订阅支付
 */
export async function processSupabaseSubscription(params: {
  userId: string;
  sessionId: string;
  provider: string;
  amount: number;
  currency: string;
  plan: string;
  period: "monthly" | "annual";
  days: number;
  isUpgradeOrder: boolean;
}): Promise<ProcessPaymentResult> {
  const { userId, sessionId, provider, amount, currency, plan, period, days, isUpgradeOrder } = params;

  if (!supabaseAdmin) {
    return { success: false, error: "supabaseAdmin not available" };
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // 检查幂等性
  const alreadyProcessed = await checkPaymentProcessed(sessionId, provider);
  if (alreadyProcessed) {
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, period, expires_at")
      .eq("user_id", userId)
      .eq("status", "active");

    if (subs && subs.length > 0) {
      subs.sort((a, b) => (PLAN_RANK[b.plan] || 0) - (PLAN_RANK[a.plan] || 0));
      const top = subs[0];
      return {
        success: true,
        status: "already_processed",
        data: { plan: top.plan, period: top.period, expiresAt: top.expires_at },
      };
    }
  }

  // 获取当前钱包信息
  const { data: walletRow } = await supabaseAdmin
    .from("user_wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const currentPlanKey = normalizePlanName(walletRow?.plan || "");
  const currentPlanExp = walletRow?.plan_exp ? new Date(walletRow.plan_exp) : null;
  const currentPlanActive = currentPlanExp ? isAfter(currentPlanExp, now) : false;

  const purchasePlanKey = normalizePlanName(plan);
  const isUpgradeFlag = isUpgrade(currentPlanKey, purchasePlanKey, currentPlanActive);
  const isDowngradeFlag = isDowngrade(currentPlanKey, purchasePlanKey, currentPlanActive);
  const isSameActive = isSamePlanRenewal(currentPlanKey, purchasePlanKey, currentPlanActive);
  const isNewOrExpired = !currentPlanActive || !currentPlanKey;

  // 计算到期日期
  const monthsToAdd = period === "annual" ? 12 : 1;
  const anchorDay = walletRow?.billing_cycle_anchor ||
    (walletRow?.monthly_reset_at ? getBeijingYMD(new Date(walletRow.monthly_reset_at)).day : getBeijingYMD(now).day);

  let purchaseExpiresAt: Date;
  if (isUpgradeOrder && days > 0) {
    purchaseExpiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  } else {
    const baseDate = isSameActive && currentPlanExp ? currentPlanExp : now;
    purchaseExpiresAt = addCalendarMonths(baseDate, monthsToAdd, anchorDay);
  }

  // 记录支付
  await supabaseAdmin.from("payments").insert({
    user_id: userId,
    provider,
    provider_order_id: sessionId,
    amount,
    currency,
    status: "COMPLETED",
    type: "SUBSCRIPTION",
    source: "global",
  });

  const { imageLimit, videoLimit } = getSupabasePlanMediaLimits(plan.toLowerCase());

  // 更新订阅
  await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan,
      period,
      status: "active",
      provider,
      provider_order_id: sessionId,
      started_at: nowIso,
      expires_at: purchaseExpiresAt.toISOString(),
      type: "SUBSCRIPTION",
    },
    { onConflict: "user_id" }
  );

  const isProFlag = plan.toLowerCase() !== "basic" && plan.toLowerCase() !== "free";

  // 更新用户元数据
  await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: {
      pro: isProFlag,
      plan,
      plan_exp: purchaseExpiresAt.toISOString(),
    },
  });

  // 更新钱包
  await updateSupabaseSubscription(userId, plan, purchaseExpiresAt.toISOString(), isProFlag, null);

  // 处理配额
  if (isUpgradeFlag || isNewOrExpired) {
    await upgradeSupabaseMonthlyQuota(userId, imageLimit, videoLimit);
  } else if (isSameActive) {
    await renewSupabaseMonthlyQuota(userId);
  }

  await seedSupabaseWalletForPlan(userId, plan.toLowerCase(), {
    forceReset: isUpgradeFlag || isNewOrExpired,
  });

  // 埋点
  trackPaymentEvent(userId, {
    amount,
    currency,
    plan,
    provider,
    orderId: sessionId,
  }).catch((err) => console.warn("[payment-processor] trackPaymentEvent error:", err));

  trackSubscriptionEvent(userId, {
    action: isUpgradeFlag ? "upgrade" : isNewOrExpired ? "subscribe" : "renew",
    fromPlan: currentPlanKey || "Free",
    toPlan: plan,
    period,
  }).catch((err) => console.warn("[payment-processor] trackSubscriptionEvent error:", err));

  return {
    success: true,
    status: "COMPLETED",
    data: {
      plan,
      period,
      expiresAt: purchaseExpiresAt.toISOString(),
      amount,
      currency,
    },
  };
}

// =============================================================================
// 订阅处理 - 国内版
// =============================================================================

/**
 * 处理国内版订阅支付
 */
export async function processCloudBaseSubscription(params: {
  userId: string;
  sessionId: string;
  provider: string;
  amount: number;
  currency: string;
  plan: string;
  period: "monthly" | "annual";
  days: number;
}): Promise<ProcessPaymentResult> {
  const { userId, sessionId, provider, amount, currency, plan, period, days } = params;

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();
  const _ = db.command;

  const now = new Date();
  const nowIso = now.toISOString();

  // 检查幂等性
  const alreadyProcessed = await checkPaymentProcessed(sessionId, provider);
  if (alreadyProcessed) {
    return { success: true, status: "already_processed" };
  }

  // 获取用户当前信息
  const userRes = await db.collection("users").doc(userId).get();
  const userDoc = userRes?.data?.[0] || null;

  const currentPlanKey = normalizePlanName(userDoc?.plan || userDoc?.subscriptionTier || "");
  const currentPlanExp = userDoc?.plan_exp ? new Date(userDoc.plan_exp) : null;
  const currentPlanActive = currentPlanExp ? isAfter(currentPlanExp, now) : false;

  const purchasePlanKey = normalizePlanName(plan);
  const isUpgradeFlag = isUpgrade(currentPlanKey, purchasePlanKey, currentPlanActive);
  const isSameActive = isSamePlanRenewal(currentPlanKey, purchasePlanKey, currentPlanActive);
  const isNewOrExpired = !currentPlanActive || !currentPlanKey;

  const { imageLimit, videoLimit } = getPlanMediaLimits(plan.toLowerCase());
  const baseDate = isSameActive && currentPlanExp ? currentPlanExp : now;
  const purchaseExpiresAt = addDays(baseDate, days);

  // 记录支付
  await db.collection("payments").add({
    userId,
    provider,
    providerOrderId: sessionId,
    amount,
    currency,
    status: "COMPLETED",
    plan,
    period,
    type: "SUBSCRIPTION",
    createdAt: nowIso,
    source: "cn",
  });

  // 更新订阅
  const subsColl = db.collection("subscriptions");
  const subPayload = {
    userId,
    plan,
    period,
    status: "active",
    provider,
    providerOrderId: sessionId,
    startedAt: nowIso,
    expiresAt: purchaseExpiresAt.toISOString(),
    updatedAt: nowIso,
    type: "SUBSCRIPTION",
  };

  const existing = await subsColl.where({ userId, provider, plan }).limit(1).get();
  if (existing?.data?.[0]?._id) {
    await subsColl.doc(existing.data[0]._id).update(subPayload);
  } else {
    await subsColl.add({ ...subPayload, createdAt: nowIso });
  }

  // 更新用户信息
  await db.collection("users").doc(userId).update({
    pro: plan.toLowerCase() !== "basic",
    plan,
    plan_exp: purchaseExpiresAt.toISOString(),
    subscriptionTier: plan,
    pendingDowngrade: _.set(null),
    updatedAt: nowIso,
  });

  // 处理配额
  if (isUpgradeFlag || isNewOrExpired) {
    await upgradeMonthlyQuota(userId, imageLimit, videoLimit);
  } else if (isSameActive) {
    await renewMonthlyQuota(userId);
  }

  await seedWalletForPlan(userId, plan.toLowerCase(), {
    forceReset: isUpgradeFlag || isNewOrExpired,
  });

  // 埋点
  trackPaymentEvent(userId, {
    amount,
    currency,
    plan,
    provider,
    orderId: sessionId,
  }).catch((err) => console.warn("[payment-processor] trackPaymentEvent error:", err));

  trackSubscriptionEvent(userId, {
    action: isUpgradeFlag ? "upgrade" : isNewOrExpired ? "subscribe" : "renew",
    fromPlan: currentPlanKey || "Free",
    toPlan: plan,
    period,
  }).catch((err) => console.warn("[payment-processor] trackSubscriptionEvent error:", err));

  return {
    success: true,
    status: "COMPLETED",
    data: {
      plan,
      period,
      expiresAt: purchaseExpiresAt.toISOString(),
      amount,
      currency,
    },
  };
}
