/**
 * Wallet 钱包服务
 * 统一管理用户的订阅配额和加油包配额
 * 
 * 数据库 Schema (users 集合):
 * {
 *   ...其他字段,
 *   wallet: {
 *     // 月度配额 (随订阅周期重置)
 *     monthly_image_balance: number,     // 本月图片余额
 *     monthly_video_balance: number,     // 本月视频/音频余额
 *     monthly_reset_at: string,          // 月度配额重置时间 (ISO)
 *     
 *     // 加油包配额 (永久有效)
 *     addon_image_balance: number,       // 加油包图片余额
 *     addon_video_balance: number,       // 加油包视频/音频余额
 *   }
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
} from "@/utils/model-limits";
import { getTodayString } from "@/utils/model-limits";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 钱包数据结构
 */
export interface UserWallet {
  // 月度配额 (随订阅周期重置)
  monthly_image_balance: number;
  monthly_video_balance: number;
  monthly_reset_at?: string;         // ISO 时间戳

  // 加油包配额 (永久有效)
  addon_image_balance: number;
  addon_video_balance: number;

  // 外部模型每日用量（按天重置，仅用于每日请求计数）
  daily_external_used?: number;
  daily_external_day?: string;
  daily_external_plan?: string;     // 记录最近一次扣减/校验时的套餐，用于切换套餐时当日重置
}

/**
 * 配额扣减请求
 */
export interface QuotaDeductionRequest {
  userId: string;
  imageCount?: number;      // 需要扣减的图片数量
  videoAudioCount?: number; // 需要扣减的视频/音频数量
}

/**
 * 配额扣减结果
 */
export interface QuotaDeductionResult {
  success: boolean;
  error?: string;
  
  // 扣减详情 (用于日志追踪)
  deducted?: {
    monthly_image: number;
    monthly_video: number;
    addon_image: number;
    addon_video: number;
  };
  
  // 扣减后余额
  remaining?: {
    monthly_image_balance: number;
    monthly_video_balance: number;
    addon_image_balance: number;
    addon_video_balance: number;
  };
}

/**
 * 配额检查结果
 */
export interface QuotaCheckResult {
  hasEnoughQuota: boolean;
  totalImageBalance: number;       // 总图片余额 (monthly + addon)
  totalVideoBalance: number;       // 总视频余额 (monthly + addon)
  monthlyImageBalance: number;
  monthlyVideoBalance: number;
  addonImageBalance: number;
  addonVideoBalance: number;
}

// =============================================================================
// 默认钱包结构
// =============================================================================

/**
 * 创建默认钱包结构
 */
export function createDefaultWallet(): UserWallet {
  return {
    monthly_image_balance: 0,
    monthly_video_balance: 0,
    monthly_reset_at: undefined,
    addon_image_balance: 0,
    addon_video_balance: 0,
    daily_external_used: 0,
    daily_external_day: getTodayString(),
    daily_external_plan: undefined,
  };
}

/**
 * 合并钱包数据 (处理旧数据迁移)
 */
export function normalizeWallet(raw: any): UserWallet {
  const wallet = raw?.wallet || {};
  return {
    monthly_image_balance: wallet.monthly_image_balance ?? 0,
    monthly_video_balance: wallet.monthly_video_balance ?? 0,
    monthly_reset_at: wallet.monthly_reset_at,
    addon_image_balance: wallet.addon_image_balance ?? 0,
    addon_video_balance: wallet.addon_video_balance ?? 0,
    daily_external_used: wallet.daily_external_used ?? 0,
    daily_external_day: wallet.daily_external_day,
    daily_external_plan: wallet.daily_external_plan,
  };
}

// =============================================================================
// 钱包操作服务
// =============================================================================

/**
 * 按套餐获取基础配额
 */
export function getPlanMediaLimits(planLower: string): {
  imageLimit: number;
  videoLimit: number;
} {
  const plan = (planLower || "").toLowerCase();
  switch (plan) {
    case "basic":
      return {
        imageLimit: getBasicMonthlyPhotoLimit(),
        videoLimit: getBasicMonthlyVideoAudioLimit(),
      };
    case "pro":
      return {
        imageLimit: getProMonthlyPhotoLimit(),
        videoLimit: getProMonthlyVideoAudioLimit(),
      };
    case "enterprise":
      return {
        imageLimit: getEnterpriseMonthlyPhotoLimit(),
        videoLimit: getEnterpriseMonthlyVideoAudioLimit(),
      };
    default:
      return {
        imageLimit: getFreeMonthlyPhotoLimit(),
        videoLimit: getFreeMonthlyVideoAudioLimit(),
      };
  }
}

/**
 * 按套餐获取每日外部模型调用上限
 */
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

/**
 * 确保钱包存在，并按套餐初始化/重置月度配额
 * - Free：自然月切换时重置为基础额度
 * - 付费：首次初始化写入基础额度，其余由订阅回调控制
 * - expired=true：清空月度额度，但不影响加油包
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
  if (!userDoc) {
    throw new Error(`User not found: ${userId}`);
  }

  const baseLimits = getPlanMediaLimits(planLower);
  const wallet = normalizeWallet(userDoc);
  const now = new Date();
  const nowIso = now.toISOString();
  const currentMonthKey = getCurrentYearMonth();
  const walletMonthKey = wallet.monthly_reset_at
    ? new Date(wallet.monthly_reset_at).toISOString().slice(0, 7)
    : null;
  const isFreePlan = (planLower || "free").toLowerCase() === "free";

  let needUpdate = false;
  const updatePayload: Record<string, any> = {
    updatedAt: nowIso,
  };
  const nextWallet: UserWallet = { ...wallet };

  if (options?.expired) {
    nextWallet.monthly_image_balance = 0;
    nextWallet.monthly_video_balance = 0;
    nextWallet.monthly_reset_at = nowIso;
    needUpdate = true;
  } else {
    const shouldResetFreeMonthly =
      isFreePlan && (options?.forceReset || walletMonthKey !== currentMonthKey);
    const shouldInitPaidMonthly = !isFreePlan && (!wallet.monthly_reset_at || options?.forceReset);

    if (shouldResetFreeMonthly || shouldInitPaidMonthly) {
      nextWallet.monthly_image_balance = baseLimits.imageLimit;
      nextWallet.monthly_video_balance = baseLimits.videoLimit;
      nextWallet.monthly_reset_at = nowIso;
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
  }

  if (needUpdate) {
    await db.collection("users").doc(userId).update(updatePayload);
  }

  return nextWallet;
}

/**
 * 获取用户钱包信息
 * 如果用户不存在或数据库查询失败，返回 null
 */
export async function getUserWallet(userId: string): Promise<UserWallet | null> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const userRes = await db.collection("users").doc(userId).get();
    const userDoc = userRes?.data?.[0] || null;

    if (!userDoc) {
      return null;
    }

    return normalizeWallet(userDoc);
  } catch (error: any) {
    // 集合不存在或其他错误时优雅降级
    if (error?.code === 'DATABASE_COLLECTION_NOT_EXIST') {
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

  if (!userDoc) {
    throw new Error(`User not found: ${userId}`);
  }

  // 如果已有 wallet 字段，返回规范化后的数据
  if (userDoc.wallet) {
    return normalizeWallet(userDoc);
  }

  // 创建默认钱包
  const defaultWallet = createDefaultWallet();
  await db.collection("users").doc(userId).update({
    wallet: defaultWallet,
    updatedAt: new Date().toISOString(),
  });

  return defaultWallet;
}

/**
 * 增加加油包额度 (ADDON 购买成功后调用)
 * 使用 CloudBase 原子操作 _.inc 保证并发安全
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
    const _ = db.command;

    // 确保用户有 wallet 字段
    await ensureUserWallet(userId);

    // 使用原子操作增加额度
    await db.collection("users").doc(userId).update({
      "wallet.addon_image_balance": _.inc(imageCredits),
      "wallet.addon_video_balance": _.inc(videoAudioCredits),
      updatedAt: new Date().toISOString(),
    });

    console.log("[wallet][addon-added]", {
      userId,
      imageCredits,
      videoAudioCredits,
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

    // 确保用户有 wallet 字段
    await ensureUserWallet(userId);

    // 直接设置新的月度配额
    await db.collection("users").doc(userId).update({
      "wallet.monthly_image_balance": imageLimit,
      "wallet.monthly_video_balance": videoLimit,
      "wallet.monthly_reset_at": new Date().toISOString(),
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

// =============================================================================
// 外部模型每日配额（按请求计数）
// =============================================================================

/**
 * 校验外部模型每日配额
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
  if (!userDoc) {
    return { allowed: false, remaining: 0, limit };
  }

  const wallet = normalizeWallet(userDoc);
  const isNewDay = wallet.daily_external_day !== today;
  // 套餐切换后同一天也需要重置
  const isPlanChanged =
    !!wallet.daily_external_plan && wallet.daily_external_plan !== planLower;
  const used = isNewDay || isPlanChanged ? 0 : wallet.daily_external_used || 0;

  // 新的一天需要重置计数
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

/**
 * 扣减外部模型每日配额（按请求计数）
 */
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
    if (!userDoc) {
      return { success: false, error: "User not found" };
    }

    const wallet = normalizeWallet(userDoc);
    const isNewDay = wallet.daily_external_day !== today;
    const isPlanChanged =
      !!wallet.daily_external_plan && wallet.daily_external_plan !== planLower;
    const used = isNewDay || isPlanChanged ? 0 : wallet.daily_external_used || 0;
    const nextUsed = used + count;

    if (nextUsed > limit) {
      return { success: false, error: "Insufficient daily quota" };
    }

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

/**
 * 智能扣费机制 - FEFO (最短有效期优先)
 * 
 * 扣费顺序：
 * 1. 先扣月度配额 (monthly_*_balance)
 * 2. 月度不足时，再扣加油包配额 (addon_*_balance)
 * 
 * 注意：必须在 AI 成功响应后才调用此函数
 */
export async function consumeQuota(
  request: QuotaDeductionRequest
): Promise<QuotaDeductionResult> {
  const { userId, imageCount = 0, videoAudioCount = 0 } = request;

  // 如果没有需要扣减的数量，直接返回成功
  if (imageCount <= 0 && videoAudioCount <= 0) {
    return { success: true };
  }

  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();
    const _ = db.command;

    // 获取当前钱包状态
    const wallet = await getUserWallet(userId);
    if (!wallet) {
      return { success: false, error: "User wallet not found" };
    }

    // 计算扣减分配 - FEFO 原则：先月度，后加油包
    const deducted = {
      monthly_image: 0,
      monthly_video: 0,
      addon_image: 0,
      addon_video: 0,
    };

    // === 图片扣减逻辑 ===
    let remainingImageToDeduct = imageCount;
    
    // 1. 先扣月度图片配额
    if (remainingImageToDeduct > 0 && wallet.monthly_image_balance > 0) {
      const monthlyDeduct = Math.min(remainingImageToDeduct, wallet.monthly_image_balance);
      deducted.monthly_image = monthlyDeduct;
      remainingImageToDeduct -= monthlyDeduct;
    }
    
    // 2. 月度不足，扣加油包图片配额
    if (remainingImageToDeduct > 0 && wallet.addon_image_balance > 0) {
      const addonDeduct = Math.min(remainingImageToDeduct, wallet.addon_image_balance);
      deducted.addon_image = addonDeduct;
      remainingImageToDeduct -= addonDeduct;
    }

    // 检查图片配额是否足够
    if (remainingImageToDeduct > 0) {
      return {
        success: false,
        error: "Insufficient image quota",
      };
    }

    // === 视频/音频扣减逻辑 ===
    let remainingVideoToDeduct = videoAudioCount;
    
    // 1. 先扣月度视频配额
    if (remainingVideoToDeduct > 0 && wallet.monthly_video_balance > 0) {
      const monthlyDeduct = Math.min(remainingVideoToDeduct, wallet.monthly_video_balance);
      deducted.monthly_video = monthlyDeduct;
      remainingVideoToDeduct -= monthlyDeduct;
    }
    
    // 2. 月度不足，扣加油包视频配额
    if (remainingVideoToDeduct > 0 && wallet.addon_video_balance > 0) {
      const addonDeduct = Math.min(remainingVideoToDeduct, wallet.addon_video_balance);
      deducted.addon_video = addonDeduct;
      remainingVideoToDeduct -= addonDeduct;
    }

    // 检查视频配额是否足够
    if (remainingVideoToDeduct > 0) {
      return {
        success: false,
        error: "Insufficient video/audio quota",
      };
    }

    // === 执行扣减 (使用原子操作) ===
    const updatePayload: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (deducted.monthly_image > 0) {
      updatePayload["wallet.monthly_image_balance"] = _.inc(-deducted.monthly_image);
    }
    if (deducted.monthly_video > 0) {
      updatePayload["wallet.monthly_video_balance"] = _.inc(-deducted.monthly_video);
    }
    if (deducted.addon_image > 0) {
      updatePayload["wallet.addon_image_balance"] = _.inc(-deducted.addon_image);
    }
    if (deducted.addon_video > 0) {
      updatePayload["wallet.addon_video_balance"] = _.inc(-deducted.addon_video);
    }

    await db.collection("users").doc(userId).update(updatePayload);

    // 计算扣减后余额
    const remaining = {
      monthly_image_balance: wallet.monthly_image_balance - deducted.monthly_image,
      monthly_video_balance: wallet.monthly_video_balance - deducted.monthly_video,
      addon_image_balance: wallet.addon_image_balance - deducted.addon_image,
      addon_video_balance: wallet.addon_video_balance - deducted.addon_video,
    };

    console.log("[wallet][consume-quota]", {
      userId,
      requested: { imageCount, videoAudioCount },
      deducted,
      remaining,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      deducted,
      remaining,
    };
  } catch (error) {
    console.error("[wallet][consume-quota-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to consume quota",
    };
  }
}

/**
 * 获取钱包统计信息 (用于前端展示)
 */
export async function getWalletStats(userId: string): Promise<{
  monthly: { image: number; video: number; resetAt?: string };
  addon: { image: number; video: number };
  total: { image: number; video: number };
  dailyExternal?: { used: number; day?: string };
} | null> {
  const wallet = await getUserWallet(userId);

  if (!wallet) {
    return null;
  }

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
 * 
 * 当用户从低级套餐升级到高级套餐时调用
 * - 立即覆盖 monthly_balance 为新套餐的满额
 * - 更新 monthly_reset_at 为当前时间
 * - 不影响 addon_balance (加油包配额)
 * 
 * @param userId 用户ID
 * @param imageLimit 新套餐的图片配额
 * @param videoLimit 新套餐的视频/音频配额
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

    // 确保用户有 wallet 字段
    await ensureUserWallet(userId);

    // 直接覆盖月度配额为新套餐满额
    await db.collection("users").doc(userId).update({
      "wallet.monthly_image_balance": imageLimit,
      "wallet.monthly_video_balance": videoLimit,
      "wallet.monthly_reset_at": new Date().toISOString(),
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
 * 订阅续费时延长配额周期
 * 
 * 当用户续费同级套餐时调用
 * - 不重置月度配额余额
 * - 仅更新 monthly_reset_at
 * 
 * @param userId 用户ID
 */
export async function renewMonthlyQuota(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 确保用户有 wallet 字段
    await ensureUserWallet(userId);

    // 续费不重置配额，仅更新时间戳
    await db.collection("users").doc(userId).update({
      "wallet.monthly_reset_at": new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log("[wallet][renew-monthly-quota]", {
      userId,
      timestamp: new Date().toISOString(),
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
 * 订阅到期时清空月度配额
 * 
 * 当用户订阅过期且未续费时调用
 * - 将 monthly_balance 清零
 * - 不影响 addon_balance (加油包配额)
 * 
 * @param userId 用户ID
 */
export async function expireMonthlyQuota(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // 确保用户有 wallet 字段
    await ensureUserWallet(userId);

    // 清空月度配额
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
 * 计算升级补差价
 * 
 * 公式: ProPrice - (BasicPrice / 30 * RemainingDays)
 * 
 * @param currentPlanDailyPrice 当前套餐日均价格
 * @param remainingDays 当前套餐剩余天数
 * @param targetPlanPrice 目标套餐全价
 */
export function calculateUpgradePrice(
  currentPlanDailyPrice: number,
  remainingDays: number,
  targetPlanPrice: number
): number {
  const remainingValue = currentPlanDailyPrice * remainingDays;
  const upgradePrice = Math.max(0, targetPlanPrice - remainingValue);
  
  console.log("[wallet][calculate-upgrade-price]", {
    currentPlanDailyPrice,
    remainingDays,
    remainingValue,
    targetPlanPrice,
    upgradePrice,
  });
  
  return Math.round(upgradePrice * 100) / 100; // 保留两位小数
}
