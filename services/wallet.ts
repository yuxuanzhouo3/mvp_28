/**
 * Wallet 钱包服务 - CloudBase 版
 * 统一管理用户的订阅配额和加油包配额
 *
 * 数据结构 (users 集合 wallet 字段):
 * {
 *   monthly_image_balance: number,
 *   monthly_video_balance: number,
 *   monthly_reset_at?: string,       // 上次账单日（ISO，存储为北京时间 00:00 对应的 UTC 时刻）
 *   billing_cycle_anchor?: number,   // 账单日锚点 (1-31)，用于月末粘性
 *   addon_image_balance: number,
 *   addon_video_balance: number,
 *   daily_external_used?: number,
 *   daily_external_day?: string,
 *   daily_external_plan?: string,
 * }
 */

import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import {
  getBasicDailyLimit,
  getProDailyLimit,
  getFreeDailyLimit,
  getEnterpriseDailyLimit,
  getBasicMonthlyPhotoLimit,
  getBasicMonthlyVideoAudioLimit,
  getEnterpriseMonthlyPhotoLimit,
  getEnterpriseMonthlyVideoAudioLimit,
  getFreeMonthlyPhotoLimit,
  getFreeMonthlyVideoAudioLimit,
  getProMonthlyPhotoLimit,
  getProMonthlyVideoAudioLimit,
  getCurrentYearMonth,
  getTodayString,
} from "@/utils/model-limits";

// =============================================================================
// 类型定义
// =============================================================================

export interface UserWallet {
  monthly_image_balance: number;
  monthly_video_balance: number;
  monthly_reset_at?: string; // ISO 北京时间 00:00 对应的 UTC 时刻
  billing_cycle_anchor?: number; // 1-31
  plan_exp?: string;
  addon_image_balance: number;
  addon_video_balance: number;
  daily_external_used?: number;
  daily_external_day?: string;
  daily_external_plan?: string;
}

export interface QuotaDeductionRequest {
  userId: string;
  imageCount?: number;
  videoAudioCount?: number;
}

export interface QuotaDeductionResult {
  success: boolean;
  error?: string;
  deducted?: {
    monthly_image: number;
    monthly_video: number;
    addon_image: number;
    addon_video: number;
  };
  remaining?: {
    monthly_image_balance: number;
    monthly_video_balance: number;
    addon_image_balance: number;
    addon_video_balance: number;
  };
}

export interface QuotaCheckResult {
  hasEnoughQuota: boolean;
  totalImageBalance: number;
  totalVideoBalance: number;
  monthlyImageBalance: number;
  monthlyVideoBalance: number;
  addonImageBalance: number;
  addonVideoBalance: number;
}

// =============================================================================
// 时间 & 账单工具（统一使用北京时间）
// =============================================================================

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

function toBeijingDate(date: Date): Date {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utcMs + BEIJING_OFFSET_MS);
}

export function getBeijingYMD(date: Date): { year: number; month: number; day: number } {
  const bj = toBeijingDate(date);
  return { year: bj.getFullYear(), month: bj.getMonth() + 1, day: bj.getDate() };
}

function beijingMidnightUtcMs(ymd: { year: number; month: number; day: number }): number {
  // 北京 00:00 等价于 UTC 前一天 16:00
  return Date.UTC(ymd.year, ymd.month - 1, ymd.day, -8, 0, 0);
}

function daysInMonth(year: number, month1Based: number): number {
  return new Date(year, month1Based, 0).getDate();
}

function clampAnchorDay(year: number, month1Based: number, anchorDay: number): number {
  return Math.min(anchorDay, daysInMonth(year, month1Based));
}

/**
 * 日历月累加，保持账单锚点（含月末粘性）
 */
export function addCalendarMonths(baseDate: Date, months: number, anchorDay: number): Date {
  let current = baseDate;
  for (let i = 0; i < months; i++) {
    current = getNextBillingDateSticky(current, anchorDay);
  }
  return current;
}

/**
 * 计算“下一个账单日”对应的北京日期（支持月末粘性：31 -> 28/29 -> 回弹 31）
 */
export function getNextBillingDateSticky(currentDate: Date, anchorDay: number): Date {
  const { year, month } = getBeijingYMD(currentDate);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const day = clampAnchorDay(nextYear, nextMonth, anchorDay);
  const utcMs = beijingMidnightUtcMs({ year: nextYear, month: nextMonth, day });
  return new Date(utcMs);
}

/**
 * 基于 billing_cycle_anchor 和 last_reset_at 计算当前账期是否应重置
 * 返回：是否到期 + 当前账单锚点（对齐 anchorDay 的当期账单日）
 */
export function computePaidResetState(
  lastResetIso?: string,
  anchorDay?: number,
  now: Date = new Date()
): { due: boolean; anchorIso: string; anchorDay: number } {
  const nowYmd = getBeijingYMD(now);
  const nowMidnight = beijingMidnightUtcMs(nowYmd);

  let resolvedAnchorDay = anchorDay && anchorDay >= 1 && anchorDay <= 31 ? anchorDay : nowYmd.day;
  let baseDate = now;
  let invalidBase = true;

  if (lastResetIso) {
    const last = new Date(lastResetIso);
    if (!Number.isNaN(last.getTime())) {
      baseDate = last;
      invalidBase = false;
      if (!anchorDay) {
        resolvedAnchorDay = getBeijingYMD(last).day;
      }
    }
  }

  const baseYmd = getBeijingYMD(baseDate);
  const anchorYmd = {
    year: baseYmd.year,
    month: baseYmd.month,
    day: clampAnchorDay(baseYmd.year, baseYmd.month, resolvedAnchorDay),
  };

  let anchorMidnight = beijingMidnightUtcMs(anchorYmd);
  let nextDate = getNextBillingDateSticky(new Date(anchorMidnight), resolvedAnchorDay);
  let nextMidnight = nextDate.getTime();
  let due = invalidBase;

  while (nowMidnight >= nextMidnight) {
    due = true;
    anchorMidnight = nextMidnight;
    nextDate = getNextBillingDateSticky(new Date(anchorMidnight), resolvedAnchorDay);
    nextMidnight = nextDate.getTime();
  }

  return { due, anchorIso: new Date(anchorMidnight).toISOString(), anchorDay: resolvedAnchorDay };
}

// =============================================================================
// 默认钱包
// =============================================================================

export function createDefaultWallet(): UserWallet {
  return {
    monthly_image_balance: 0,
    monthly_video_balance: 0,
    monthly_reset_at: undefined,
    plan_exp: undefined,
    billing_cycle_anchor: undefined,
    addon_image_balance: 0,
    addon_video_balance: 0,
    daily_external_used: 0,
    daily_external_day: getTodayString(),
    daily_external_plan: undefined,
  };
}

export function normalizeWallet(raw: any): UserWallet {
  const wallet = raw?.wallet || {};
  // 兼容旧结构 (wallet.addon.image/video) 和新结构 (wallet.addon_image_balance/addon_video_balance)
  const addonImageBalance =
    wallet.addon_image_balance ??
    wallet.addon?.image ??
    0;
  const addonVideoBalance =
    wallet.addon_video_balance ??
    wallet.addon?.video ??
    0;

  return {
    monthly_image_balance: wallet.monthly_image_balance ?? 0,
    monthly_video_balance: wallet.monthly_video_balance ?? 0,
    monthly_reset_at: wallet.monthly_reset_at,
    plan_exp: wallet.plan_exp ?? raw?.plan_exp,
    billing_cycle_anchor: wallet.billing_cycle_anchor ?? wallet.billing_cycle_anchor,
    addon_image_balance: addonImageBalance,
    addon_video_balance: addonVideoBalance,
    daily_external_used: wallet.daily_external_used ?? 0,
    daily_external_day: wallet.daily_external_day,
    daily_external_plan: wallet.daily_external_plan,
  };
}

// =============================================================================
// 配额与套餐工具
// =============================================================================

export function getPlanMediaLimits(planLower: string): { imageLimit: number; videoLimit: number } {
  const plan = (planLower || "").toLowerCase();
  switch (plan) {
    case "basic":
      return { imageLimit: getBasicMonthlyPhotoLimit(), videoLimit: getBasicMonthlyVideoAudioLimit() };
    case "pro":
      return { imageLimit: getProMonthlyPhotoLimit(), videoLimit: getProMonthlyVideoAudioLimit() };
    case "enterprise":
      return {
        imageLimit: getEnterpriseMonthlyPhotoLimit(),
        videoLimit: getEnterpriseMonthlyVideoAudioLimit(),
      };
    default:
      return { imageLimit: getFreeMonthlyPhotoLimit(), videoLimit: getFreeMonthlyVideoAudioLimit() };
  }
}

export function getPlanDailyLimit(planLower: string): number {
  const plan = (planLower || "").toLowerCase();
  switch (plan) {
    case "basic":
      return getBasicDailyLimit();
    case "pro":
      return getProDailyLimit();
    case "enterprise":
      return getEnterpriseDailyLimit();
    default:
      return getFreeDailyLimit();
  }
}

// =============================================================================
// 钱包操作
// =============================================================================

/**
 * 确保钱包存在，并按套餐初始化/懒刷新月度配额（含账单锚点）
 */
export async function seedWalletForPlan(
  userId: string,
  planLower: string,
  options?: { forceReset?: boolean; expired?: boolean }
): Promise<UserWallet> {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  const userRes = await db.collection("users").doc(userId).get();
  const userDoc = userRes?.data?.[0] || null;
  if (!userDoc) throw new Error(`User not found: ${userId}`);

  const now = new Date();
  let effectivePlanLower = (planLower || "free").toLowerCase();

  // 过期强制降级为 Free
  const planExpIso = (userDoc.wallet && userDoc.wallet.plan_exp) || userDoc.plan_exp;
  if (planExpIso) {
    const exp = new Date(planExpIso);
    if (!Number.isNaN(exp.getTime()) && exp < now) {
      effectivePlanLower = "free";
    }
  }
  if (options?.expired) {
    effectivePlanLower = "free";
  }

  const baseLimits = getPlanMediaLimits(effectivePlanLower);
  const wallet = normalizeWallet(userDoc);
  const nowIso = now.toISOString();
  const currentMonthKey = getCurrentYearMonth();
  const walletMonthKey = wallet.monthly_reset_at
    ? new Date(wallet.monthly_reset_at).toISOString().slice(0, 7)
    : null;
  const isFreePlan = effectivePlanLower === "free";
  const isPaidPlan = !isFreePlan;

  // 确定/刷新锚点：付费且缺失或 forceReset 时，使用今天的北京 day
  let anchorDay = wallet.billing_cycle_anchor;
  if (isPaidPlan && (options?.forceReset || !anchorDay)) {
    anchorDay = getBeijingYMD(now).day;
  } else if (!anchorDay && wallet.monthly_reset_at) {
    anchorDay = getBeijingYMD(new Date(wallet.monthly_reset_at)).day;
  }

  const paidResetState =
    isPaidPlan && anchorDay
      ? computePaidResetState(wallet.monthly_reset_at, anchorDay, now)
      : null;

  let needUpdate = false;
  const updatePayload: Record<string, any> = { updatedAt: nowIso };
  const nextWallet: UserWallet = { ...wallet, billing_cycle_anchor: anchorDay };

  if (options?.expired) {
    nextWallet.monthly_image_balance = 0;
    nextWallet.monthly_video_balance = 0;
    nextWallet.monthly_reset_at = nowIso;
    needUpdate = true;
  } else {
    const shouldResetFreeMonthly =
      isFreePlan && (options?.forceReset || walletMonthKey !== currentMonthKey);
    const shouldResetPaidMonthly =
      isPaidPlan &&
      (options?.forceReset || !wallet.monthly_reset_at || (paidResetState && paidResetState.due));

    if (shouldResetFreeMonthly || shouldResetPaidMonthly) {
      nextWallet.monthly_image_balance = baseLimits.imageLimit;
      nextWallet.monthly_video_balance = baseLimits.videoLimit;
      nextWallet.monthly_reset_at =
        shouldResetPaidMonthly && paidResetState ? paidResetState.anchorIso : nowIso;
      needUpdate = true;
    }
  }

  if (!userDoc.wallet) {
    updatePayload.wallet = nextWallet;
    needUpdate = true;
  } else if (needUpdate) {
    updatePayload["wallet.monthly_image_balance"] = nextWallet.monthly_image_balance;
    updatePayload["wallet.monthly_video_balance"] = nextWallet.monthly_video_balance;
    updatePayload["wallet.monthly_reset_at"] = nextWallet.monthly_reset_at;
    updatePayload["wallet.billing_cycle_anchor"] = nextWallet.billing_cycle_anchor;
  } else if (nextWallet.billing_cycle_anchor !== wallet.billing_cycle_anchor) {
    // 锚点补录
    updatePayload["wallet.billing_cycle_anchor"] = nextWallet.billing_cycle_anchor;
    needUpdate = true;
  }

  if (needUpdate) {
    await db.collection("users").doc(userId).update(updatePayload);
  }

  return nextWallet;
}

export async function getUserWallet(userId: string): Promise<UserWallet | null> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();
    const userRes = await db.collection("users").doc(userId).get();
    const userDoc = userRes?.data?.[0] || null;
    if (!userDoc) return null;
    return normalizeWallet(userDoc);
  } catch (error: any) {
    if (error?.code === "DATABASE_COLLECTION_NOT_EXIST") {
      console.log("[wallet] users collection not found");
    } else {
      console.error("[wallet] Error fetching user wallet:", error);
    }
    return null;
  }
}

/**
 * 初始化用户钱包 (如果不存在)
 */
export async function ensureUserWallet(userId: string): Promise<UserWallet> {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  const userRes = await db.collection("users").doc(userId).get();
  const userDoc = userRes?.data?.[0] || null;
  if (!userDoc) throw new Error(`User not found: ${userId}`);

  if (userDoc.wallet) return normalizeWallet(userDoc);

  const now = new Date();
  const defaultWallet = createDefaultWallet();
  defaultWallet.billing_cycle_anchor = getBeijingYMD(now).day;

  await db.collection("users").doc(userId).update({
    wallet: defaultWallet,
    updatedAt: now.toISOString(),
  });

  return defaultWallet;
}

/**
 * 增加加油包额度
 * 兼容旧结构 (wallet.addon.image/video) 和新结构 (wallet.addon_image_balance/addon_video_balance)
 */
export async function addAddonCredits(
  userId: string,
  imageCredits: number,
  videoAudioCredits: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 1. 获取当前用户数据
    const userRes = await db.collection("users").doc(userId).get();
    const userDoc = userRes?.data?.[0] || null;
    if (!userDoc) {
      console.error("[wallet][addon-add] User not found:", userId);
      return { success: false, error: `User not found: ${userId}` };
    }

    // 2. 读取当前余额（兼容旧结构和新结构）
    const wallet = userDoc.wallet || {};
    // 新结构优先，回退到旧结构
    const currentImageBalance =
      wallet.addon_image_balance ??
      wallet.addon?.image ??
      0;
    const currentVideoBalance =
      wallet.addon_video_balance ??
      wallet.addon?.video ??
      0;

    // 3. 计算新余额
    const newImageBalance = currentImageBalance + imageCredits;
    const newVideoBalance = currentVideoBalance + videoAudioCredits;

    // 4. 以统一的新结构更新数据库
    await db.collection("users").doc(userId).update({
      "wallet.addon_image_balance": newImageBalance,
      "wallet.addon_video_balance": newVideoBalance,
      updatedAt: new Date().toISOString(),
    });

    console.log("[wallet][addon-added]", {
      userId,
      imageCredits,
      videoAudioCredits,
      previousBalance: { image: currentImageBalance, video: currentVideoBalance },
      newBalance: { image: newImageBalance, video: newVideoBalance },
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error("[wallet][addon-add-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add addon credits",
    };
  }
}

/**
 * 重置月度配额 (订阅续费或升级时调用)
 */
export async function resetMonthlyQuota(
  userId: string,
  imageLimit: number,
  videoLimit: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const currentWallet = await getUserWallet(userId);
    if (!currentWallet) await ensureUserWallet(userId);
    const anchorDay =
      currentWallet?.billing_cycle_anchor || (currentWallet?.monthly_reset_at
        ? getBeijingYMD(new Date(currentWallet.monthly_reset_at)).day
        : getBeijingYMD(new Date()).day);
    const paidState = computePaidResetState(currentWallet?.monthly_reset_at, anchorDay, new Date());

    await db.collection("users").doc(userId).update({
      "wallet.monthly_image_balance": imageLimit,
      "wallet.monthly_video_balance": videoLimit,
      "wallet.monthly_reset_at": paidState.anchorIso,
      "wallet.billing_cycle_anchor": anchorDay,
      updatedAt: new Date().toISOString(),
    });

    console.log("[wallet][monthly-reset]", {
      userId,
      imageLimit,
      videoLimit,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error("[wallet][monthly-reset-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reset monthly quota",
    };
  }
}

/**
 * 获取钱包统计信息
 */
export async function getWalletStats(userId: string): Promise<{
  monthly: { image: number; video: number; resetAt?: string };
  addon: { image: number; video: number };
  total: { image: number; video: number };
  dailyExternal?: { used: number; day?: string };
} | null> {
  const wallet = await getUserWallet(userId);
  if (!wallet) return null;

  return {
    monthly: {
      image: wallet.monthly_image_balance,
      video: wallet.monthly_video_balance,
      resetAt: wallet.monthly_reset_at,
    },
    addon: {
      image: wallet.addon_image_balance,
      video: wallet.addon_video_balance,
    },
    total: {
      image: wallet.monthly_image_balance + wallet.addon_image_balance,
      video: wallet.monthly_video_balance + wallet.addon_video_balance,
    },
    dailyExternal: {
      used: wallet.daily_external_used || 0,
      day: wallet.daily_external_day,
    },
  };
}

// =============================================================================
// 订阅相关配额操作
// =============================================================================

/**
 * 订阅升级时重置月度配额
 */
export async function upgradeMonthlyQuota(
  userId: string,
  imageLimit: number,
  videoLimit: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const currentWallet = await getUserWallet(userId);
    if (!currentWallet) await ensureUserWallet(userId);
    const anchorDay =
      currentWallet?.billing_cycle_anchor || getBeijingYMD(new Date()).day;
    const paidState = computePaidResetState(currentWallet?.monthly_reset_at, anchorDay, new Date());

    await db.collection("users").doc(userId).update({
      "wallet.monthly_image_balance": imageLimit,
      "wallet.monthly_video_balance": videoLimit,
      "wallet.monthly_reset_at": paidState.anchorIso,
      "wallet.billing_cycle_anchor": anchorDay,
      updatedAt: new Date().toISOString(),
    });

    console.log("[wallet][upgrade-monthly-quota]", {
      userId,
      newImageLimit: imageLimit,
      newVideoLimit: videoLimit,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error("[wallet][upgrade-monthly-quota-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upgrade monthly quota",
    };
  }
}

/**
 * 订阅续费时延长配额周期（不重置余额，更新账单锚点时间戳）
 */
export async function renewMonthlyQuota(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const currentWallet = await getUserWallet(userId);
    if (!currentWallet) await ensureUserWallet(userId);
    const anchorDay =
      currentWallet?.billing_cycle_anchor ||
      (currentWallet?.monthly_reset_at
        ? getBeijingYMD(new Date(currentWallet.monthly_reset_at)).day
        : getBeijingYMD(new Date()).day);

    // 基准时间：如果有月度重置时间则从该时间起算，否则从现在开始
    const baseDate = currentWallet?.monthly_reset_at
      ? new Date(currentWallet.monthly_reset_at)
      : new Date();
    const nextBillingDate = addCalendarMonths(baseDate, 1, anchorDay);

    await db.collection("users").doc(userId).update({
      "wallet.monthly_reset_at": nextBillingDate.toISOString(),
      "wallet.billing_cycle_anchor": anchorDay,
      updatedAt: new Date().toISOString(),
    });

    console.log("[wallet][renew-monthly-quota]", {
      userId,
      timestamp: new Date().toISOString(),
      nextBillingDate: nextBillingDate.toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error("[wallet][renew-monthly-quota-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to renew monthly quota",
    };
  }
}

/**
 * 订阅到期时清空月度配额（不影响加油包）
 */
export async function expireMonthlyQuota(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    await ensureUserWallet(userId);

    await db.collection("users").doc(userId).update({
      "wallet.monthly_image_balance": 0,
      "wallet.monthly_video_balance": 0,
      updatedAt: new Date().toISOString(),
    });

    console.log("[wallet][expire-monthly-quota]", {
      userId,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error("[wallet][expire-monthly-quota-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to expire monthly quota",
    };
  }
}

/**
 * 扣减外部模型每日配额（按请求计数）
 */
export async function checkDailyExternalQuota(
  userId: string,
  planLower: string,
  count: number = 1
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();
  const today = getTodayString();
  const limit = getPlanDailyLimit(planLower);

  const userRes = await db.collection("users").doc(userId).get();
  const userDoc = userRes?.data?.[0] || null;
  if (!userDoc) return { allowed: false, remaining: 0, limit };

  const wallet = normalizeWallet(userDoc);
  const isNewDay = wallet.daily_external_day !== today;
  const isPlanChanged =
    !!wallet.daily_external_plan && wallet.daily_external_plan !== planLower;
  const used = isNewDay || isPlanChanged ? 0 : wallet.daily_external_used || 0;

  if (isNewDay || isPlanChanged) {
    await db.collection("users").doc(userId).update({
      "wallet.daily_external_used": 0,
      "wallet.daily_external_day": today,
      "wallet.daily_external_plan": planLower,
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    allowed: used + count <= limit,
    remaining: Math.max(0, limit - used - count),
    limit,
  };
}

export async function consumeDailyExternalQuota(
  userId: string,
  planLower: string,
  count: number = 1
): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();
    const _ = db.command;
    const today = getTodayString();
    const limit = getPlanDailyLimit(planLower);

    const userRes = await db.collection("users").doc(userId).get();
    const userDoc = userRes?.data?.[0] || null;
    if (!userDoc) return { success: false, error: "User not found" };

    const wallet = normalizeWallet(userDoc);
    const isNewDay = wallet.daily_external_day !== today;
    const isPlanChanged =
      !!wallet.daily_external_plan && wallet.daily_external_plan !== planLower;
    const used = isNewDay || isPlanChanged ? 0 : wallet.daily_external_used || 0;
    const nextUsed = used + count;

    if (nextUsed > limit) return { success: false, error: "Insufficient daily quota" };

    const updatePayload: Record<string, any> = {
      updatedAt: new Date().toISOString(),
      "wallet.daily_external_plan": planLower,
    };

    if (isNewDay || isPlanChanged) {
      updatePayload["wallet.daily_external_used"] = count;
      updatePayload["wallet.daily_external_day"] = today;
    } else {
      updatePayload["wallet.daily_external_used"] = _.inc(count);
    }

    await db.collection("users").doc(userId).update(updatePayload);

    console.log("[wallet][consume-daily]", {
      userId,
      planLower,
      count,
      usedBefore: used,
      usedAfter: nextUsed,
      day: today,
    });

    return { success: true };
  } catch (error) {
    console.error("[wallet][consume-daily-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to consume daily quota",
    };
  }
}

// =============================================================================
// FEFO 扣费
// =============================================================================

/**
 * 智能扣费 FEFO：先月度，再加油包
 * 兼容旧结构和新结构钱包
 */
export async function consumeQuota(
  request: QuotaDeductionRequest
): Promise<QuotaDeductionResult> {
  const { userId, imageCount = 0, videoAudioCount = 0 } = request;
  if (imageCount <= 0 && videoAudioCount <= 0) return { success: true };

  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const wallet = await getUserWallet(userId);
    if (!wallet) return { success: false, error: "User wallet not found" };

    const deducted = { monthly_image: 0, monthly_video: 0, addon_image: 0, addon_video: 0 };

    // 图片
    let imgNeed = imageCount;
    if (imgNeed > 0 && wallet.monthly_image_balance > 0) {
      const d = Math.min(imgNeed, wallet.monthly_image_balance);
      deducted.monthly_image = d;
      imgNeed -= d;
    }
    if (imgNeed > 0 && wallet.addon_image_balance > 0) {
      const d = Math.min(imgNeed, wallet.addon_image_balance);
      deducted.addon_image = d;
      imgNeed -= d;
    }
    if (imgNeed > 0) return { success: false, error: "Insufficient image quota" };

    // 视频/音频
    let mediaNeed = videoAudioCount;
    if (mediaNeed > 0 && wallet.monthly_video_balance > 0) {
      const d = Math.min(mediaNeed, wallet.monthly_video_balance);
      deducted.monthly_video = d;
      mediaNeed -= d;
    }
    if (mediaNeed > 0 && wallet.addon_video_balance > 0) {
      const d = Math.min(mediaNeed, wallet.addon_video_balance);
      deducted.addon_video = d;
      mediaNeed -= d;
    }
    if (mediaNeed > 0) return { success: false, error: "Insufficient video/audio quota" };

    // 计算新余额（使用绝对值更新，避免 _.inc 在字段不存在时失败）
    const remaining = {
      monthly_image_balance: wallet.monthly_image_balance - deducted.monthly_image,
      monthly_video_balance: wallet.monthly_video_balance - deducted.monthly_video,
      addon_image_balance: wallet.addon_image_balance - deducted.addon_image,
      addon_video_balance: wallet.addon_video_balance - deducted.addon_video,
    };

    await db.collection("users").doc(userId).update({
      "wallet.monthly_image_balance": remaining.monthly_image_balance,
      "wallet.monthly_video_balance": remaining.monthly_video_balance,
      "wallet.addon_image_balance": remaining.addon_image_balance,
      "wallet.addon_video_balance": remaining.addon_video_balance,
      updatedAt: new Date().toISOString(),
    });

    console.log("[wallet][consume-quota]", {
      userId,
      requested: { imageCount, videoAudioCount },
      deducted,
      remaining,
      timestamp: new Date().toISOString(),
    });

    return { success: true, deducted, remaining };
  } catch (error) {
    console.error("[wallet][consume-quota-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to consume quota",
    };
  }
}

/**
 * 检查用户配额是否充足
 */
export async function checkQuota(
  userId: string,
  requiredImages: number = 0,
  requiredVideoAudio: number = 0
): Promise<QuotaCheckResult> {
  const wallet = await getUserWallet(userId);
  if (!wallet) {
    return {
      hasEnoughQuota: false,
      totalImageBalance: 0,
      totalVideoBalance: 0,
      monthlyImageBalance: 0,
      monthlyVideoBalance: 0,
      addonImageBalance: 0,
      addonVideoBalance: 0,
    };
  }

  const totalImageBalance = wallet.monthly_image_balance + wallet.addon_image_balance;
  const totalVideoBalance = wallet.monthly_video_balance + wallet.addon_video_balance;
  const hasEnoughQuota =
    totalImageBalance >= requiredImages && totalVideoBalance >= requiredVideoAudio;

  return {
    hasEnoughQuota,
    totalImageBalance,
    totalVideoBalance,
    monthlyImageBalance: wallet.monthly_image_balance,
    monthlyVideoBalance: wallet.monthly_video_balance,
    addonImageBalance: wallet.addon_image_balance,
    addonVideoBalance: wallet.addon_video_balance,
  };
}

/**
 * 计算升级补差价
 *
 * 升级机制说明：
 * 1. 用户从低级套餐升级到高级套餐时，需要支付剩余订阅期内的差价
 * 2. 计算公式：(目标套餐日价 - 当前套餐日价) × 剩余天数
 * 3. 升级后，订阅到期时间保持不变，用户在剩余期间享受新套餐权益
 * 4. 到期后按新套餐价格续费
 *
 * 示例：
 * - 用户有Basic月订阅，剩余120天，想升级到Pro月订阅
 * - Basic日价 = ¥29/30 = ¥0.97/天
 * - Pro日价 = ¥99/30 = ¥3.30/天
 * - 差价 = (3.30 - 0.97) × 120 = ¥280
 *
 * @param currentPlanDailyPrice 当前套餐的日价格
 * @param targetPlanDailyPrice 目标套餐的日价格
 * @param remainingDays 当前订阅剩余天数
 * @param minimumPayment 最低支付金额（避免支付接口报错），默认0.01
 * @returns 升级需要支付的金额
 */
export function calculateUpgradePrice(
  currentPlanDailyPrice: number,
  targetPlanDailyPrice: number,
  remainingDays: number,
  minimumPayment: number = 0.01
): number {
  // 计算每日差价
  const dailyDifference = targetPlanDailyPrice - currentPlanDailyPrice;

  // 计算总升级价格
  const upgradePrice = dailyDifference * remainingDays;

  console.log("[wallet][calculate-upgrade-price]", {
    currentPlanDailyPrice,
    targetPlanDailyPrice,
    dailyDifference,
    remainingDays,
    rawUpgradePrice: upgradePrice,
  });

  // 确保最低支付金额（支付接口不接受0或负数）
  const finalPrice = Math.max(minimumPayment, upgradePrice);

  console.log("[wallet][calculate-upgrade-price] Final price:", finalPrice);

  return Math.round(finalPrice * 100) / 100;
}
