/**
 * Wallet Supabase 钱包服务 - 国际版
 * 统一管理用户的订阅配额和加油包配额
 * 
 * 数据库 Schema (user_wallets 表):
 * {
 *   user_id: uuid,
 *   plan: text,                    // 订阅套餐 (Free/Basic/Pro/Enterprise)
 *   subscription_tier: text,       // 订阅层级
 *   plan_exp: timestamptz,         // 订阅到期时间
 *   pro: boolean,                  // 是否为Pro用户
 *   pending_downgrade: text,       // 待降级信息
 *   monthly_image_balance: integer,// 月度图片余额
 *   monthly_video_balance: integer,// 月度视频/音频余额
 *   monthly_reset_at: timestamptz, // 月度配额重置时间
 *   addon_image_balance: integer,  // 加油包图片余额
 *   addon_video_balance: integer,  // 加油包视频/音频余额
 *   daily_external_day: date,      // 每日配额日期
 *   daily_external_plan: text,     // 每日配额对应套餐
 *   daily_external_used: integer,  // 每日外部模型使用量
 *   updated_at: timestamptz,
 * }
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
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

/**
 * Supabase 钱包数据结构
 */
export interface SupabaseUserWallet {
  user_id: string;
  plan: string;
  subscription_tier: string;
  plan_exp: string | null;
  pro: boolean;
  pending_downgrade: string | null;
  monthly_image_balance: number;
  monthly_video_balance: number;
  monthly_reset_at: string | null;
  addon_image_balance: number;
  addon_video_balance: number;
  daily_external_day: string | null;
  daily_external_plan: string | null;
  daily_external_used: number;
  updated_at: string;
}

/**
 * 配额扣减请求
 */
export interface SupabaseQuotaDeductionRequest {
  userId: string;
  imageCount?: number;
  videoAudioCount?: number;
}

/**
 * 配额扣减结果
 */
export interface SupabaseQuotaDeductionResult {
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

/**
 * 配额检查结果
 */
export interface SupabaseQuotaCheckResult {
  hasEnoughQuota: boolean;
  totalImageBalance: number;
  totalVideoBalance: number;
  monthlyImageBalance: number;
  monthlyVideoBalance: number;
  addonImageBalance: number;
  addonVideoBalance: number;
}

// =============================================================================
// 默认钱包结构
// =============================================================================

/**
 * 创建默认钱包数据
 */
export function createDefaultSupabaseWallet(userId: string): Partial<SupabaseUserWallet> {
  return {
    user_id: userId,
    plan: 'Free',
    subscription_tier: 'Free',
    plan_exp: null,
    pro: false,
    pending_downgrade: null,
    monthly_image_balance: getFreeMonthlyPhotoLimit(),
    monthly_video_balance: getFreeMonthlyVideoAudioLimit(),
    monthly_reset_at: new Date().toISOString(),
    addon_image_balance: 0,
    addon_video_balance: 0,
    daily_external_day: getTodayString(),
    daily_external_plan: 'free',
    daily_external_used: 0,
    updated_at: new Date().toISOString(),
  };
}

// =============================================================================
// 钱包操作服务
// =============================================================================

/**
 * 按套餐获取基础配额
 */
export function getSupabasePlanMediaLimits(planLower: string): {
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
export function getSupabasePlanDailyLimit(planLower: string): number {
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
 * 获取用户钱包信息
 */
export async function getSupabaseUserWallet(userId: string): Promise<SupabaseUserWallet | null> {
  if (!supabaseAdmin) {
    console.warn("[wallet-supabase] supabaseAdmin not available");
    return null;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("user_wallets")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // 记录不存在
        return null;
      }
      console.error("[wallet-supabase] Error fetching wallet:", error);
      return null;
    }

    return data as SupabaseUserWallet;
  } catch (error) {
    console.error("[wallet-supabase] Error fetching wallet:", error);
    return null;
  }
}

/**
 * 确保用户钱包存在，如果不存在则创建
 */
export async function ensureSupabaseUserWallet(userId: string): Promise<SupabaseUserWallet | null> {
  if (!supabaseAdmin) {
    console.warn("[wallet-supabase] supabaseAdmin not available");
    return null;
  }

  let wallet = await getSupabaseUserWallet(userId);

  if (!wallet) {
    // 创建默认钱包
    const defaultWallet = createDefaultSupabaseWallet(userId);
    const { data, error } = await supabaseAdmin
      .from("user_wallets")
      .insert(defaultWallet)
      .select()
      .single();

    if (error) {
      console.error("[wallet-supabase] Error creating wallet:", error);
      return null;
    }

    wallet = data as SupabaseUserWallet;
  }

  return wallet;
}

/**
 * 确保钱包存在，并按套餐初始化/重置月度配额
 */
export async function seedSupabaseWalletForPlan(
  userId: string,
  planLower: string,
  options?: { forceReset?: boolean; expired?: boolean }
): Promise<SupabaseUserWallet | null> {
  if (!supabaseAdmin) {
    console.warn("[wallet-supabase] supabaseAdmin not available");
    return null;
  }

  let wallet = await getSupabaseUserWallet(userId);
  const baseLimits = getSupabasePlanMediaLimits(planLower);
  const now = new Date();
  const nowIso = now.toISOString();
  const currentMonthKey = getCurrentYearMonth();
  const isFreePlan = (planLower || "free").toLowerCase() === "free";

  if (!wallet) {
    // 创建新钱包
    const newWallet: Partial<SupabaseUserWallet> = {
      user_id: userId,
      plan: planLower === 'free' ? 'Free' : planLower.charAt(0).toUpperCase() + planLower.slice(1),
      subscription_tier: planLower === 'free' ? 'Free' : planLower.charAt(0).toUpperCase() + planLower.slice(1),
      plan_exp: null,
      pro: planLower !== 'free' && planLower !== 'basic',
      pending_downgrade: null,
      monthly_image_balance: baseLimits.imageLimit,
      monthly_video_balance: baseLimits.videoLimit,
      monthly_reset_at: nowIso,
      addon_image_balance: 0,
      addon_video_balance: 0,
      daily_external_day: getTodayString(),
      daily_external_plan: planLower,
      daily_external_used: 0,
      updated_at: nowIso,
    };

    const { data, error } = await supabaseAdmin
      .from("user_wallets")
      .insert(newWallet)
      .select()
      .single();

    if (error) {
      console.error("[wallet-supabase] Error creating wallet:", error);
      return null;
    }

    return data as SupabaseUserWallet;
  }

  // 检查是否需要更新
  const walletMonthKey = wallet.monthly_reset_at
    ? new Date(wallet.monthly_reset_at).toISOString().slice(0, 7)
    : null;

  let needUpdate = false;
  const updatePayload: Partial<SupabaseUserWallet> = {
    updated_at: nowIso,
  };

  if (options?.expired) {
    // 订阅过期，清空月度配额
    updatePayload.monthly_image_balance = 0;
    updatePayload.monthly_video_balance = 0;
    updatePayload.monthly_reset_at = nowIso;
    needUpdate = true;
  } else {
    const shouldResetFreeMonthly =
      isFreePlan && (options?.forceReset || walletMonthKey !== currentMonthKey);
    const shouldInitPaidMonthly = !isFreePlan && (!wallet.monthly_reset_at || options?.forceReset);

    if (shouldResetFreeMonthly || shouldInitPaidMonthly) {
      updatePayload.monthly_image_balance = baseLimits.imageLimit;
      updatePayload.monthly_video_balance = baseLimits.videoLimit;
      updatePayload.monthly_reset_at = nowIso;
      needUpdate = true;
    }
  }

  if (needUpdate) {
    const { data, error } = await supabaseAdmin
      .from("user_wallets")
      .update(updatePayload)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("[wallet-supabase] Error updating wallet:", error);
      return wallet;
    }

    return data as SupabaseUserWallet;
  }

  return wallet;
}

/**
 * 增加加油包额度
 */
export async function addSupabaseAddonCredits(
  userId: string,
  imageCredits: number,
  videoAudioCredits: number
): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) {
    return { success: false, error: "supabaseAdmin not available" };
  }

  try {
    // 确保钱包存在
    await ensureSupabaseUserWallet(userId);

    // 使用 RPC 调用原子增加
    const { error } = await supabaseAdmin.rpc('increment_addon_credits', {
      p_user_id: userId,
      p_image_credits: imageCredits,
      p_video_credits: videoAudioCredits,
    });

    if (error) {
      // 如果 RPC 不存在，降级使用普通更新
      const wallet = await getSupabaseUserWallet(userId);
      if (!wallet) {
        return { success: false, error: "Wallet not found" };
      }

      const { error: updateError } = await supabaseAdmin
        .from("user_wallets")
        .update({
          addon_image_balance: wallet.addon_image_balance + imageCredits,
          addon_video_balance: wallet.addon_video_balance + videoAudioCredits,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("[wallet-supabase] Error adding addon credits:", updateError);
        return { success: false, error: updateError.message };
      }
    }

    console.log("[wallet-supabase][addon-added]", {
      userId,
      imageCredits,
      videoAudioCredits,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error("[wallet-supabase][addon-add-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add addon credits",
    };
  }
}

/**
 * 重置月度配额 (订阅续费或升级时调用)
 */
export async function resetSupabaseMonthlyQuota(
  userId: string,
  imageLimit: number,
  videoLimit: number
): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) {
    return { success: false, error: "supabaseAdmin not available" };
  }

  try {
    await ensureSupabaseUserWallet(userId);

    const { error } = await supabaseAdmin
      .from("user_wallets")
      .update({
        monthly_image_balance: imageLimit,
        monthly_video_balance: videoLimit,
        monthly_reset_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error("[wallet-supabase] Error resetting monthly quota:", error);
      return { success: false, error: error.message };
    }

    console.log("[wallet-supabase][monthly-reset]", {
      userId,
      imageLimit,
      videoLimit,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error("[wallet-supabase][monthly-reset-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reset monthly quota",
    };
  }
}

/**
 * 检查用户配额是否充足
 */
export async function checkSupabaseQuota(
  userId: string,
  requiredImages: number = 0,
  requiredVideoAudio: number = 0
): Promise<SupabaseQuotaCheckResult> {
  const wallet = await getSupabaseUserWallet(userId);

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
 * 校验外部模型每日配额
 */
export async function checkSupabaseDailyExternalQuota(
  userId: string,
  planLower: string,
  count: number = 1
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  if (!supabaseAdmin) {
    return { allowed: false, remaining: 0, limit: 0 };
  }

  const today = getTodayString();
  const limit = getSupabasePlanDailyLimit(planLower);

  const wallet = await getSupabaseUserWallet(userId);
  if (!wallet) {
    return { allowed: false, remaining: 0, limit };
  }

  const isNewDay = wallet.daily_external_day !== today;
  const isPlanChanged = !!wallet.daily_external_plan && wallet.daily_external_plan !== planLower;
  const used = isNewDay || isPlanChanged ? 0 : wallet.daily_external_used || 0;

  // 新的一天或套餐变更需要重置计数
  if (isNewDay || isPlanChanged) {
    await supabaseAdmin
      .from("user_wallets")
      .update({
        daily_external_used: 0,
        daily_external_day: today,
        daily_external_plan: planLower,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }

  return {
    allowed: used + count <= limit,
    remaining: Math.max(0, limit - used - count),
    limit,
  };
}

/**
 * 扣减外部模型每日配额
 */
export async function consumeSupabaseDailyExternalQuota(
  userId: string,
  planLower: string,
  count: number = 1
): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) {
    return { success: false, error: "supabaseAdmin not available" };
  }

  try {
    const today = getTodayString();
    const limit = getSupabasePlanDailyLimit(planLower);

    const wallet = await getSupabaseUserWallet(userId);
    if (!wallet) {
      return { success: false, error: "User wallet not found" };
    }

    const isNewDay = wallet.daily_external_day !== today;
    const isPlanChanged = !!wallet.daily_external_plan && wallet.daily_external_plan !== planLower;
    const used = isNewDay || isPlanChanged ? 0 : wallet.daily_external_used || 0;
    const nextUsed = used + count;

    if (nextUsed > limit) {
      return { success: false, error: "Insufficient daily quota" };
    }

    const { error } = await supabaseAdmin
      .from("user_wallets")
      .update({
        daily_external_used: nextUsed,
        daily_external_day: today,
        daily_external_plan: planLower,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error("[wallet-supabase] Error consuming daily quota:", error);
      return { success: false, error: error.message };
    }

    console.log("[wallet-supabase][consume-daily]", {
      userId,
      planLower,
      count,
      usedBefore: used,
      usedAfter: nextUsed,
      day: today,
    });

    return { success: true };
  } catch (error) {
    console.error("[wallet-supabase][consume-daily-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to consume daily quota",
    };
  }
}

/**
 * 智能扣费机制 - FEFO (最短有效期优先)
 * 先扣月度配额，不足时再扣加油包配额
 */
export async function consumeSupabaseQuota(
  request: SupabaseQuotaDeductionRequest
): Promise<SupabaseQuotaDeductionResult> {
  const { userId, imageCount = 0, videoAudioCount = 0 } = request;

  if (imageCount <= 0 && videoAudioCount <= 0) {
    return { success: true };
  }

  if (!supabaseAdmin) {
    return { success: false, error: "supabaseAdmin not available" };
  }

  try {
    const wallet = await getSupabaseUserWallet(userId);
    if (!wallet) {
      return { success: false, error: "User wallet not found" };
    }

    // 计算扣减分配 - FEFO 原则
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

    if (remainingImageToDeduct > 0) {
      return { success: false, error: "Insufficient image quota" };
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

    if (remainingVideoToDeduct > 0) {
      return { success: false, error: "Insufficient video/audio quota" };
    }

    // === 执行扣减 ===
    const { error } = await supabaseAdmin
      .from("user_wallets")
      .update({
        monthly_image_balance: wallet.monthly_image_balance - deducted.monthly_image,
        monthly_video_balance: wallet.monthly_video_balance - deducted.monthly_video,
        addon_image_balance: wallet.addon_image_balance - deducted.addon_image,
        addon_video_balance: wallet.addon_video_balance - deducted.addon_video,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error("[wallet-supabase] Error consuming quota:", error);
      return { success: false, error: error.message };
    }

    const remaining = {
      monthly_image_balance: wallet.monthly_image_balance - deducted.monthly_image,
      monthly_video_balance: wallet.monthly_video_balance - deducted.monthly_video,
      addon_image_balance: wallet.addon_image_balance - deducted.addon_image,
      addon_video_balance: wallet.addon_video_balance - deducted.addon_video,
    };

    console.log("[wallet-supabase][consume-quota]", {
      userId,
      requested: { imageCount, videoAudioCount },
      deducted,
      remaining,
      timestamp: new Date().toISOString(),
    });

    return { success: true, deducted, remaining };
  } catch (error) {
    console.error("[wallet-supabase][consume-quota-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to consume quota",
    };
  }
}

/**
 * 获取钱包统计信息 (用于前端展示)
 */
export async function getSupabaseWalletStats(userId: string): Promise<{
  monthly: { image: number; video: number; resetAt?: string };
  addon: { image: number; video: number };
  total: { image: number; video: number };
  dailyExternal?: { used: number; day?: string };
} | null> {
  const wallet = await getSupabaseUserWallet(userId);

  if (!wallet) {
    return null;
  }

  return {
    monthly: {
      image: wallet.monthly_image_balance,
      video: wallet.monthly_video_balance,
      resetAt: wallet.monthly_reset_at || undefined,
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
      day: wallet.daily_external_day || undefined,
    },
  };
}

/**
 * 订阅升级时重置月度配额
 */
export async function upgradeSupabaseMonthlyQuota(
  userId: string,
  imageLimit: number,
  videoLimit: number
): Promise<{ success: boolean; error?: string }> {
  return resetSupabaseMonthlyQuota(userId, imageLimit, videoLimit);
}

/**
 * 订阅续费时延长配额周期 (不重置余额)
 */
export async function renewSupabaseMonthlyQuota(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) {
    return { success: false, error: "supabaseAdmin not available" };
  }

  try {
    await ensureSupabaseUserWallet(userId);

    const { error } = await supabaseAdmin
      .from("user_wallets")
      .update({
        monthly_reset_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error("[wallet-supabase] Error renewing monthly quota:", error);
      return { success: false, error: error.message };
    }

    console.log("[wallet-supabase][renew-monthly-quota]", {
      userId,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error("[wallet-supabase][renew-monthly-quota-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to renew monthly quota",
    };
  }
}

/**
 * 订阅到期时清空月度配额
 */
export async function expireSupabaseMonthlyQuota(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) {
    return { success: false, error: "supabaseAdmin not available" };
  }

  try {
    await ensureSupabaseUserWallet(userId);

    const { error } = await supabaseAdmin
      .from("user_wallets")
      .update({
        monthly_image_balance: 0,
        monthly_video_balance: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error("[wallet-supabase] Error expiring monthly quota:", error);
      return { success: false, error: error.message };
    }

    console.log("[wallet-supabase][expire-monthly-quota]", {
      userId,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error("[wallet-supabase][expire-monthly-quota-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to expire monthly quota",
    };
  }
}

/**
 * 更新用户订阅信息
 */
export async function updateSupabaseSubscription(
  userId: string,
  plan: string,
  planExp: string | null,
  isPro: boolean,
  pendingDowngrade?: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) {
    return { success: false, error: "supabaseAdmin not available" };
  }

  try {
    await ensureSupabaseUserWallet(userId);

    const { error } = await supabaseAdmin
      .from("user_wallets")
      .update({
        plan,
        subscription_tier: plan,
        plan_exp: planExp,
        pro: isPro,
        pending_downgrade: pendingDowngrade || null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error("[wallet-supabase] Error updating subscription:", error);
      return { success: false, error: error.message };
    }

    console.log("[wallet-supabase][update-subscription]", {
      userId,
      plan,
      planExp,
      isPro,
      pendingDowngrade,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error("[wallet-supabase][update-subscription-error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update subscription",
    };
  }
}

/**
 * 计算升级补差价
 */
export function calculateSupabaseUpgradePrice(
  currentPlanDailyPrice: number,
  remainingDays: number,
  targetPlanPrice: number
): number {
  const remainingValue = currentPlanDailyPrice * remainingDays;
  const upgradePrice = Math.max(0, targetPlanPrice - remainingValue);

  console.log("[wallet-supabase][calculate-upgrade-price]", {
    currentPlanDailyPrice,
    remainingDays,
    remainingValue,
    targetPlanPrice,
    upgradePrice,
  });

  return Math.round(upgradePrice * 100) / 100;
}




