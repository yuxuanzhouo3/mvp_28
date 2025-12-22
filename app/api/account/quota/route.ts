import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { isAfter } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import {
  getFreeDailyLimit,
  getFreeMonthlyPhotoLimit,
  getFreeMonthlyVideoAudioLimit,
  getFreeContextMsgLimit,
  getBasicDailyLimit,
  getBasicMonthlyPhotoLimit,
  getBasicMonthlyVideoAudioLimit,
  getBasicContextMsgLimit,
  getProDailyLimit,
  getProMonthlyPhotoLimit,
  getProMonthlyVideoAudioLimit,
  getProContextMsgLimit,
  getEnterpriseDailyLimit,
  getEnterpriseMonthlyPhotoLimit,
  getEnterpriseMonthlyVideoAudioLimit,
  getEnterpriseContextMsgLimit,
  getTodayString,
  getCurrentYearMonth,
  getModelCategory,
  ModelCategory,
} from "@/utils/model-limits";
import { getWalletStats, seedWalletForPlan, checkDailyExternalQuota } from "@/services/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const QUOTA_LOG = false;

const getPlanInfo = (meta: any) => {
  const rawPlan =
    (meta?.plan as string | undefined) ||
    (meta?.subscriptionTier as string | undefined) ||
    "";
  const rawPlanLower = typeof rawPlan === "string" ? rawPlan.toLowerCase() : "";
  const planExp = meta?.plan_exp ? new Date(meta.plan_exp) : null;
  const planActive = planExp ? isAfter(planExp, new Date()) : true;
  const planLower = planActive ? rawPlanLower : "free";
  const isBasic = planLower === "basic";
  const isProPlan = planLower === "pro";
  const isEnterprise = planLower === "enterprise";
  const isUnlimitedFlag = !!meta?.pro && !isBasic && !isProPlan && !isEnterprise;
  const isFree = !isEnterprise && !isProPlan && !isBasic && !isUnlimitedFlag;
  return { planLower, isBasic, isProPlan, isEnterprise, isFree, isUnlimitedFlag, planExp, planActive };
};

/**
 * 新版配额 API
 * 根据请求参数中的 modelId 返回对应的配额信息
 * 
 * Query params:
 *   - modelId: 当前选中的模型 ID (可选，默认返回全部配额信息)
 */
export async function GET(req: NextRequest) {
  const modelId = req.nextUrl.searchParams.get("modelId") || "";
  const modelCategory = modelId ? getModelCategory(modelId) : null;

  // 版本隔离：仅国内版走 CloudBase
  if (IS_DOMESTIC_VERSION) {
    const cookieStore = await cookies();
    const token =
      cookieStore.get("auth-token")?.value ||
      req.headers.get("x-auth-token") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      null;
    if (!token) {
      if (QUOTA_LOG) console.warn("[quota] no token for domestic request");
      return new Response("Unauthorized", { status: 401 });
    }

    const auth = new CloudBaseAuthService();
    const user = await auth.validateToken(token);
    if (!user) {
      if (QUOTA_LOG) console.warn("[quota] token invalid / user not found");
      return new Response("Unauthorized", { status: 401 });
    }

    const plan = getPlanInfo(user.metadata);
    if (QUOTA_LOG) console.log("[quota] user", user.id, "plan", plan.planLower, "isBasic", plan.isBasic, "isPro", plan.isPro, "isFree", plan.isFree);
    
    const today = getTodayString();
    const currentMonth = getCurrentYearMonth();
    const effectivePlanLower = plan.planActive ? plan.planLower : "free";

    const limits = (() => {
      switch (effectivePlanLower) {
        case "basic":
          return {
            dailyLimit: getBasicDailyLimit(),
            contextLimit: getBasicContextMsgLimit(),
            photoLimit: getBasicMonthlyPhotoLimit(),
            videoLimit: getBasicMonthlyVideoAudioLimit(),
            label: "basic",
          };
        case "pro":
          return {
            dailyLimit: getProDailyLimit(),
            contextLimit: getProContextMsgLimit(),
            photoLimit: getProMonthlyPhotoLimit(),
            videoLimit: getProMonthlyVideoAudioLimit(),
            label: "pro",
          };
        case "enterprise":
          return {
            dailyLimit: getEnterpriseDailyLimit(),
            contextLimit: getEnterpriseContextMsgLimit(),
            photoLimit: getEnterpriseMonthlyPhotoLimit(),
            videoLimit: getEnterpriseMonthlyVideoAudioLimit(),
            label: "enterprise",
          };
        default:
          return {
            dailyLimit: getFreeDailyLimit(),
            contextLimit: getFreeContextMsgLimit(),
            photoLimit: getFreeMonthlyPhotoLimit(),
            videoLimit: getFreeMonthlyVideoAudioLimit(),
            label: "free",
          };
      }
    })();

    // 同步 wallet，确保基础额度写入
    const walletSeed = await seedWalletForPlan(user.id, effectivePlanLower);
    const walletStats =
      (await getWalletStats(user.id)) || {
        monthly: {
          image: walletSeed.monthly_image_balance,
          video: walletSeed.monthly_video_balance,
          resetAt: walletSeed.monthly_reset_at,
        },
        addon: {
          image: walletSeed.addon_image_balance,
          video: walletSeed.addon_video_balance,
        },
        total: {
          image: walletSeed.monthly_image_balance + walletSeed.addon_image_balance,
          video: walletSeed.monthly_video_balance + walletSeed.addon_video_balance,
        },
      };

    const monthlyImageRemaining =
      (walletStats.monthly?.image ?? limits.photoLimit) + (walletStats.addon?.image ?? 0);
    const monthlyVideoRemaining =
      (walletStats.monthly?.video ?? limits.videoLimit) + (walletStats.addon?.video ?? 0);

    const dailyQuota = await checkDailyExternalQuota(user.id, effectivePlanLower, 0);
    const dailyLimit = dailyQuota?.limit ?? limits.dailyLimit;
    const dailyUsed = dailyQuota ? Math.max(0, dailyLimit - dailyQuota.remaining) : 0;

    const monthlyMedia = {
      period: currentMonth,
      photoUsed: Math.max(0, limits.photoLimit - (walletStats.monthly?.image ?? limits.photoLimit)),
      photoLimit: limits.photoLimit + (walletStats.addon?.image ?? 0),
      photoRemaining: monthlyImageRemaining,
      videoAudioUsed: Math.max(0, limits.videoLimit - (walletStats.monthly?.video ?? limits.videoLimit)),
      videoAudioLimit: limits.videoLimit + (walletStats.addon?.video ?? 0),
      videoAudioRemaining: monthlyVideoRemaining,
    };

    const daily = {
      period: today,
      used: dailyUsed,
      limit: dailyLimit,
      remaining: Math.max(0, dailyLimit - dailyUsed),
    };

    // 特殊无限制标记
    if (plan.isUnlimitedFlag) {
      return Response.json({
        plan: limits.label,
        period: null,
        used: 0,
        limit: null,
        remaining: null,
        quotaType: "unlimited",
        modelCategory: modelCategory || "all",
        contextMsgLimit: null,
      });
    }

    if (modelCategory === "general") {
      return Response.json({
        plan: limits.label,
        quotaType: "unlimited",
        modelCategory: "general",
        contextMsgLimit: limits.contextLimit,
        wallet: walletStats,
      });
    }

    if (modelCategory === "external") {
      return Response.json({
        plan: limits.label,
        period: today,
        used: daily.used,
        limit: daily.limit,
        remaining: daily.remaining,
        quotaType: "daily",
        modelCategory: "external",
        contextMsgLimit: limits.contextLimit,
        wallet: walletStats,
      });
    }

    if (modelCategory === "advanced_multimodal") {
      return Response.json({
        plan: limits.label,
        period: currentMonth,
        quotaType: "monthly_media",
        modelCategory: "advanced_multimodal",
        contextMsgLimit: limits.contextLimit,
        daily,
        textConsumesDaily: true,
        photoUsed: monthlyMedia.photoUsed,
        photoLimit: monthlyMedia.photoLimit,
        photoRemaining: monthlyMedia.photoRemaining,
        videoAudioUsed: monthlyMedia.videoAudioUsed,
        videoAudioLimit: monthlyMedia.videoAudioLimit,
        videoAudioRemaining: monthlyMedia.videoAudioRemaining,
        monthlyMedia,
        wallet: walletStats,
      });
    }

    // 默认返回全部配额信息（无特定模型）
    return Response.json({
      plan: limits.label,
      daily,
      monthlyMedia,
      contextMsgLimit: limits.contextLimit,
      modelCategory: modelCategory || null,
      wallet: walletStats,
    });
  }

  // 国际版：使用 Supabase 新表结构 (user_wallets)
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = userData.user.id;
  const today = getTodayString();
  const currentMonth = getCurrentYearMonth();

  // 先从 user_wallets 表获取钱包数据（权威数据源，避免 user_metadata 缓存问题）
  const { data: walletRowPre, error: walletErrPre } = await supabase
    .from("user_wallets")
    .select("*")
    .eq("user_id", userId)
    .single();

  // 从 user_wallets 获取套餐信息（优先），user_metadata 作为回退
  const userMeta = userData.user.user_metadata as any;
  const rawPlan = walletRowPre?.plan || walletRowPre?.subscription_tier || userMeta?.plan || userMeta?.subscriptionTier || "";
  const rawPlanLower = typeof rawPlan === "string" ? rawPlan.toLowerCase() : "";
  const planExp = walletRowPre?.plan_exp
    ? new Date(walletRowPre.plan_exp)
    : (userMeta?.plan_exp ? new Date(userMeta.plan_exp) : null);
  const planActive = planExp ? planExp > new Date() : true;
  const effectivePlanLower = planActive ? rawPlanLower : "free";

  const isBasic = effectivePlanLower === "basic";
  const isProPlan = effectivePlanLower === "pro";
  const isEnterprise = effectivePlanLower === "enterprise";
  const isFree = !isBasic && !isProPlan && !isEnterprise;

  // 获取套餐对应的限制
  const limits = (() => {
    switch (effectivePlanLower) {
      case "basic":
        return {
          dailyLimit: getBasicDailyLimit(),
          contextLimit: getBasicContextMsgLimit(),
          photoLimit: getBasicMonthlyPhotoLimit(),
          videoLimit: getBasicMonthlyVideoAudioLimit(),
          label: "basic",
        };
      case "pro":
        return {
          dailyLimit: getProDailyLimit(),
          contextLimit: getProContextMsgLimit(),
          photoLimit: getProMonthlyPhotoLimit(),
          videoLimit: getProMonthlyVideoAudioLimit(),
          label: "pro",
        };
      case "enterprise":
        return {
          dailyLimit: getEnterpriseDailyLimit(),
          contextLimit: getEnterpriseContextMsgLimit(),
          photoLimit: getEnterpriseMonthlyPhotoLimit(),
          videoLimit: getEnterpriseMonthlyVideoAudioLimit(),
          label: "enterprise",
        };
      default:
        return {
          dailyLimit: getFreeDailyLimit(),
          contextLimit: getFreeContextMsgLimit(),
          photoLimit: getFreeMonthlyPhotoLimit(),
          videoLimit: getFreeMonthlyVideoAudioLimit(),
          label: "free",
        };
    }
  })();

  // 复用前面已获取的 wallet 数据（避免重复查询）
  let wallet = walletRowPre;
  if (walletErrPre && walletErrPre.code === "PGRST116") {
    // 钱包不存在，使用 supabaseAdmin 创建（因为 RLS 限制）
    if (supabaseAdmin) {
      const { data: newWallet, error: createErr } = await supabaseAdmin
        .from("user_wallets")
        .insert({
          user_id: userId,
          plan: limits.label === 'free' ? 'Free' : limits.label.charAt(0).toUpperCase() + limits.label.slice(1),
          subscription_tier: limits.label === 'free' ? 'Free' : limits.label.charAt(0).toUpperCase() + limits.label.slice(1),
          monthly_image_balance: limits.photoLimit,
          monthly_video_balance: limits.videoLimit,
          monthly_reset_at: new Date().toISOString(),
          addon_image_balance: 0,
          addon_video_balance: 0,
          daily_external_day: today,
          daily_external_plan: effectivePlanLower,
          daily_external_used: 0,
          updated_at: new Date().toISOString(),
        })
        .select()
      .single();

      if (!createErr && newWallet) {
        wallet = newWallet;
      }
    }
  } else if (walletErrPre) {
    console.error("Wallet fetch error", walletErrPre);
  }

  // 构建钱包统计数据
  const walletStats = wallet ? {
    monthly: {
      image: wallet.monthly_image_balance ?? limits.photoLimit,
      video: wallet.monthly_video_balance ?? limits.videoLimit,
      resetAt: wallet.monthly_reset_at,
    },
    addon: {
      image: wallet.addon_image_balance ?? 0,
      video: wallet.addon_video_balance ?? 0,
    },
    total: {
      image: (wallet.monthly_image_balance ?? limits.photoLimit) + (wallet.addon_image_balance ?? 0),
      video: (wallet.monthly_video_balance ?? limits.videoLimit) + (wallet.addon_video_balance ?? 0),
    },
  } : {
    monthly: { image: limits.photoLimit, video: limits.videoLimit, resetAt: null },
    addon: { image: 0, video: 0 },
    total: { image: limits.photoLimit, video: limits.videoLimit },
  };

  // 计算每日配额
  const isNewDay = wallet?.daily_external_day !== today;
  const dailyUsed = isNewDay ? 0 : (wallet?.daily_external_used ?? 0);
  const dailyRemaining = Math.max(0, limits.dailyLimit - dailyUsed);

  // 计算月度配额
  const monthlyImageRemaining = walletStats.total.image;
  const monthlyVideoRemaining = walletStats.total.video;

  const monthlyMedia = {
    period: currentMonth,
    photoUsed: Math.max(0, limits.photoLimit - (walletStats.monthly.image)),
    photoLimit: limits.photoLimit + walletStats.addon.image,
    photoRemaining: monthlyImageRemaining,
    videoAudioUsed: Math.max(0, limits.videoLimit - (walletStats.monthly.video)),
    videoAudioLimit: limits.videoLimit + walletStats.addon.video,
    videoAudioRemaining: monthlyVideoRemaining,
  };

  const daily = {
    period: today,
    used: dailyUsed,
    limit: limits.dailyLimit,
    remaining: dailyRemaining,
  };

  // 订阅到期时间（用于前端显示）
  const planExpIso = planExp ? planExp.toISOString() : null;

  // 根据模型类型返回不同的配额信息
      if (modelCategory === "general") {
        return Response.json({
      plan: limits.label,
      planExp: planExpIso,
          quotaType: "unlimited",
          modelCategory: "general",
      contextMsgLimit: limits.contextLimit,
      wallet: walletStats,
        });
      }

      if (modelCategory === "external") {
        return Response.json({
      plan: limits.label,
      planExp: planExpIso,
          period: today,
      used: daily.used,
      limit: daily.limit,
      remaining: daily.remaining,
          quotaType: "daily",
          modelCategory: "external",
      contextMsgLimit: limits.contextLimit,
      daily,
      wallet: walletStats,
        });
      }

      if (modelCategory === "advanced_multimodal") {
        return Response.json({
      plan: limits.label,
      planExp: planExpIso,
          period: currentMonth,
          quotaType: "monthly_media",
          modelCategory: "advanced_multimodal",
      contextMsgLimit: limits.contextLimit,
      daily,
          textConsumesDaily: true,
      photoUsed: monthlyMedia.photoUsed,
      photoLimit: monthlyMedia.photoLimit,
      photoRemaining: monthlyMedia.photoRemaining,
      videoAudioUsed: monthlyMedia.videoAudioUsed,
      videoAudioLimit: monthlyMedia.videoAudioLimit,
      videoAudioRemaining: monthlyMedia.videoAudioRemaining,
      monthlyMedia,
      wallet: walletStats,
    });
  }

  // 默认返回全部配额信息
  return Response.json({
    plan: limits.label,
    planExp: planExpIso,
    daily,
    monthlyMedia,
    contextMsgLimit: limits.contextLimit,
    modelCategory: modelCategory || null,
    wallet: walletStats,
  });
}
