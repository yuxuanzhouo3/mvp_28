import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { isAfter } from "date-fns";
import { createClient } from "@/lib/supabase/server";
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
  const hasCloudToken = !!req.cookies.get("auth-token");

  // Domestic 版：使用 CloudBase 文档数据库（或请求显式携带 CloudBase token）
  if (IS_DOMESTIC_VERSION || hasCloudToken) {
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

  // 国际版：使用 Supabase
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = userData.user.id;
  const today = getTodayString();
  const dailyLimit = getFreeDailyLimit();
  const basicDailyLimit = getBasicDailyLimit();
  const photoLimit = getFreeMonthlyPhotoLimit();
  const videoAudioLimit = getFreeMonthlyVideoAudioLimit();
  const basicPhotoLimit = getBasicMonthlyPhotoLimit();
  const basicVideoAudioLimit = getBasicMonthlyVideoAudioLimit();
  const freeContextLimit = getFreeContextMsgLimit();
  const basicContextLimit = getBasicContextMsgLimit();

  const userPlan =
    (userData.user.user_metadata as any)?.plan ||
    ((userData.user.user_metadata as any)?.pro ? "Pro" : null);
  const planLower = typeof userPlan === "string" ? userPlan.toLowerCase() : "";
  const isFree = !planLower || planLower === "free";
  const isBasic = planLower === "basic";

  if (isBasic) {
    // Basic 每日文本
    const { data: dailyRow, error: dailyErr } = await supabase
      .from("basic_quotas")
      .select("used, limit_per_day")
      .eq("user_id", userId)
      .eq("day", today)
      .single();
    if (dailyErr && dailyErr.code !== "PGRST116") {
      console.error("Basic quota fetch error", dailyErr);
      return new Response("Failed to fetch quota", { status: 500 });
    }
    const dailyUsed = dailyRow?.used ?? 0;

    // Basic 月度媒体
    const currentMonth = getCurrentYearMonth();
    const { data: mediaRow, error: mediaErr } = await supabase
      .from("basic_quotas")
      .select("month_used_photo, month_used_video_audio")
      .eq("user_id", userId)
      .eq("month", currentMonth)
      .single();
    if (mediaErr && mediaErr.code !== "PGRST116") {
      console.error("Basic media quota fetch error", mediaErr);
      return new Response("Failed to fetch quota", { status: 500 });
    }
    const monthUsedPhoto = mediaRow?.month_used_photo ?? 0;
    const monthUsedVideoAudio = mediaRow?.month_used_video_audio ?? 0;

    if (modelId) {
      const modelCategory = getModelCategory(modelId);
      if (modelCategory === "general") {
        return Response.json({
          plan: "basic",
          quotaType: "unlimited",
          modelCategory: "general",
          contextMsgLimit: basicContextLimit,
        });
      }
      if (modelCategory === "external") {
        return Response.json({
          plan: "basic",
          period: today,
          used: dailyUsed,
          limit: basicDailyLimit,
          remaining: Math.max(0, basicDailyLimit - dailyUsed),
          quotaType: "daily",
          modelCategory: "external",
          contextMsgLimit: basicContextLimit,
        });
      }
      if (modelCategory === "advanced_multimodal") {
        return Response.json({
          plan: "basic",
          period: currentMonth,
          quotaType: "monthly_media",
          modelCategory: "advanced_multimodal",
          contextMsgLimit: basicContextLimit,
          daily: {
            period: today,
            used: dailyUsed,
            limit: basicDailyLimit,
            remaining: Math.max(0, basicDailyLimit - dailyUsed),
          },
          textConsumesDaily: true,
          photoUsed: monthUsedPhoto,
          photoLimit: basicPhotoLimit,
          photoRemaining: Math.max(0, basicPhotoLimit - monthUsedPhoto),
          videoAudioUsed: monthUsedVideoAudio,
          videoAudioLimit: basicVideoAudioLimit,
          videoAudioRemaining: Math.max(0, basicVideoAudioLimit - monthUsedVideoAudio),
          monthlyMedia: {
            period: currentMonth,
            photoUsed: monthUsedPhoto,
            photoLimit: basicPhotoLimit,
            photoRemaining: Math.max(0, basicPhotoLimit - monthUsedPhoto),
            videoAudioUsed: monthUsedVideoAudio,
            videoAudioLimit: basicVideoAudioLimit,
            videoAudioRemaining: Math.max(0, basicVideoAudioLimit - monthUsedVideoAudio),
          },
        });
      }
    }

    return Response.json({
      plan: "basic",
      modelCategory: modelId ? getModelCategory(modelId) : null,
      daily: {
        period: today,
        used: dailyUsed,
        limit: basicDailyLimit,
        remaining: Math.max(0, basicDailyLimit - dailyUsed),
      },
      monthlyMedia: {
        period: currentMonth,
        photoUsed: monthUsedPhoto,
        photoLimit: basicPhotoLimit,
        photoRemaining: Math.max(0, basicPhotoLimit - monthUsedPhoto),
        videoAudioUsed: monthUsedVideoAudio,
        videoAudioLimit: basicVideoAudioLimit,
        videoAudioRemaining: Math.max(0, basicVideoAudioLimit - monthUsedVideoAudio),
      },
      contextMsgLimit: basicContextLimit,
    });
  }

  // Free fallback
  const { data: quotaRow, error: quotaErr } = await supabase
    .from("free_quotas")
    .select("used, limit_per_day")
    .eq("user_id", userId)
    .eq("day", today)
    .single();

  if (quotaErr && quotaErr.code !== "PGRST116") {
    console.error("Quota fetch error", quotaErr);
    return new Response("Failed to fetch quota", { status: 500 });
  }

  const used = quotaRow?.used ?? 0;
  const limit = Number.isFinite(dailyLimit)
    ? dailyLimit
    : quotaRow?.limit_per_day ?? 10;

  return Response.json({
    plan: "free",
    period: today,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    contextMsgLimit: freeContextLimit,
  });
}
