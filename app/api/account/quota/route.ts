import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const QUOTA_LOG = false;

const getPlanInfo = (meta: any) => {
  const rawPlan =
    (meta?.plan as string | undefined) ||
    (meta?.subscriptionTier as string | undefined) ||
    "";
  const planLower = typeof rawPlan === "string" ? rawPlan.toLowerCase() : "";
  const isBasic = planLower === "basic";
  const isProPlan = planLower === "pro";
  const isEnterprise = planLower === "enterprise";
  const isUnlimitedFlag = !!meta?.pro && !isBasic && !isProPlan && !isEnterprise;
  const isFree = !isEnterprise && !isProPlan && !isBasic && !isUnlimitedFlag;
  return { planLower, isBasic, isProPlan, isEnterprise, isFree, isUnlimitedFlag };
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
    const dailyLimit = getFreeDailyLimit();
    const basicDailyLimit = getBasicDailyLimit();
    const proDailyLimit = getProDailyLimit();
    const enterpriseDailyLimit = getEnterpriseDailyLimit();
    const photoLimit = getFreeMonthlyPhotoLimit();
    const videoAudioLimit = getFreeMonthlyVideoAudioLimit();
    const contextMsgLimit = getFreeContextMsgLimit();
    const basicPhotoLimit = getBasicMonthlyPhotoLimit();
    const basicVideoAudioLimit = getBasicMonthlyVideoAudioLimit();
    const basicContextMsgLimit = getBasicContextMsgLimit();
    const proPhotoLimit = getProMonthlyPhotoLimit();
    const proVideoAudioLimit = getProMonthlyVideoAudioLimit();
    const proContextMsgLimit = getProContextMsgLimit();
    const enterprisePhotoLimit = getEnterpriseMonthlyPhotoLimit();
    const enterpriseVideoAudioLimit = getEnterpriseMonthlyVideoAudioLimit();
    const enterpriseContextMsgLimit = getEnterpriseContextMsgLimit();

    // 特殊无限制标记
    if (plan.isUnlimitedFlag) {
      return Response.json({
        plan: plan.planLower || "enterprise",
        period: null,
        used: 0,
        limit: null,
        remaining: null,
        // 新版配额信息
        quotaType: "unlimited",
        modelCategory: modelCategory || "all",
        contextMsgLimit: null, // 无限标记不做限制
      });
    }

    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // Basic 用户：每日文本 + 月度媒体
    if (plan.isBasic) {
      // 每日文本配额
      const dailyRes = await db
        .collection("basic_quotas")
        .where({ userId: user.id, day: today })
        .limit(1)
        .get();
      const dailyRow = dailyRes?.data?.[0] || null;
      const dailyUsed = dailyRow?.daily_count ?? dailyRow?.used ?? 0;

      // 月度媒体配额
      const monthlyMediaRes = await db
        .collection("basic_quotas")
        .where({ userId: user.id, month: currentMonth })
        .limit(1)
        .get();
      const monthlyMediaRow = monthlyMediaRes?.data?.[0] || null;
      const monthUsedPhoto = monthlyMediaRow?.month_used_photo ?? 0;
      const monthUsedVideoAudio = monthlyMediaRow?.month_used_video_audio ?? 0;

      if (modelCategory === "general") {
        return Response.json({
          plan: "basic",
          quotaType: "unlimited",
          modelCategory: "general",
          contextMsgLimit: basicContextMsgLimit,
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
          contextMsgLimit: basicContextMsgLimit,
        });
      }

      if (modelCategory === "advanced_multimodal") {
        return Response.json({
          plan: "basic",
          period: currentMonth,
          quotaType: "monthly_media",
          modelCategory: "advanced_multimodal",
          contextMsgLimit: basicContextMsgLimit,
          daily: {
            period: today,
            used: dailyUsed,
            limit: basicDailyLimit,
            remaining: Math.max(0, basicDailyLimit - dailyUsed),
          },
          textConsumesDaily: true,
          // 图片配额
          photoUsed: monthUsedPhoto,
          photoLimit: basicPhotoLimit,
          photoRemaining: Math.max(0, basicPhotoLimit - monthUsedPhoto),
          // 视频/音频配额
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

      // 默认：返回全部配额
      return Response.json({
        plan: "basic",
        modelCategory: modelCategory || null,
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
        contextMsgLimit: basicContextMsgLimit,
      });
    }

    // Pro 用户：每日文本 + 月度媒体（pro_quotas）
    if (plan.isProPlan) {
      const dailyRes = await db
        .collection("pro_quotas")
        .where({ userId: user.id, day: today })
        .limit(1)
        .get();
      const dailyRow = dailyRes?.data?.[0] || null;
      const dailyUsed = dailyRow?.daily_count ?? dailyRow?.used ?? 0;

      const monthlyMediaRes = await db
        .collection("pro_quotas")
        .where({ userId: user.id, month: currentMonth })
        .limit(1)
        .get();
      const monthlyMediaRow = monthlyMediaRes?.data?.[0] || null;
      const monthUsedPhoto = monthlyMediaRow?.month_used_photo ?? 0;
      const monthUsedVideoAudio = monthlyMediaRow?.month_used_video_audio ?? 0;

      if (modelCategory === "general") {
        return Response.json({
          plan: "pro",
          quotaType: "unlimited",
          modelCategory: "general",
          contextMsgLimit: proContextMsgLimit,
        });
      }

      if (modelCategory === "external") {
        return Response.json({
          plan: "pro",
          period: today,
          used: dailyUsed,
          limit: proDailyLimit,
          remaining: Math.max(0, proDailyLimit - dailyUsed),
          quotaType: "daily",
          modelCategory: "external",
          contextMsgLimit: proContextMsgLimit,
        });
      }

      if (modelCategory === "advanced_multimodal") {
        return Response.json({
          plan: "pro",
          period: currentMonth,
          quotaType: "monthly_media",
          modelCategory: "advanced_multimodal",
          contextMsgLimit: proContextMsgLimit,
          daily: {
            period: today,
            used: dailyUsed,
            limit: proDailyLimit,
            remaining: Math.max(0, proDailyLimit - dailyUsed),
          },
          textConsumesDaily: true,
          photoUsed: monthUsedPhoto,
          photoLimit: proPhotoLimit,
          photoRemaining: Math.max(0, proPhotoLimit - monthUsedPhoto),
          videoAudioUsed: monthUsedVideoAudio,
          videoAudioLimit: proVideoAudioLimit,
          videoAudioRemaining: Math.max(0, proVideoAudioLimit - monthUsedVideoAudio),
          monthlyMedia: {
            period: currentMonth,
            photoUsed: monthUsedPhoto,
            photoLimit: proPhotoLimit,
            photoRemaining: Math.max(0, proPhotoLimit - monthUsedPhoto),
            videoAudioUsed: monthUsedVideoAudio,
            videoAudioLimit: proVideoAudioLimit,
            videoAudioRemaining: Math.max(0, proVideoAudioLimit - monthUsedVideoAudio),
          },
        });
      }

      return Response.json({
        plan: "pro",
        modelCategory: modelCategory || null,
        daily: {
          period: today,
          used: dailyUsed,
          limit: proDailyLimit,
          remaining: Math.max(0, proDailyLimit - dailyUsed),
        },
        monthlyMedia: {
          period: currentMonth,
          photoUsed: monthUsedPhoto,
          photoLimit: proPhotoLimit,
          photoRemaining: Math.max(0, proPhotoLimit - monthUsedPhoto),
          videoAudioUsed: monthUsedVideoAudio,
          videoAudioLimit: proVideoAudioLimit,
          videoAudioRemaining: Math.max(0, proVideoAudioLimit - monthUsedVideoAudio),
        },
        contextMsgLimit: proContextMsgLimit,
      });
    }

    // Enterprise 用户：每日文本 + 月度媒体（enterprise_quotas）
    if (plan.isEnterprise) {
      const dailyRes = await db
        .collection("enterprise_quotas")
        .where({ userId: user.id, day: today })
        .limit(1)
        .get();
      const dailyRow = dailyRes?.data?.[0] || null;
      const dailyUsed = dailyRow?.daily_count ?? dailyRow?.used ?? 0;

      const monthlyMediaRes = await db
        .collection("enterprise_quotas")
        .where({ userId: user.id, month: currentMonth })
        .limit(1)
        .get();
      const monthlyMediaRow = monthlyMediaRes?.data?.[0] || null;
      const monthUsedPhoto = monthlyMediaRow?.month_used_photo ?? 0;
      const monthUsedVideoAudio = monthlyMediaRow?.month_used_video_audio ?? 0;

      if (modelCategory === "general") {
        return Response.json({
          plan: "enterprise",
          quotaType: "unlimited",
          modelCategory: "general",
          contextMsgLimit: enterpriseContextMsgLimit,
        });
      }

      if (modelCategory === "external") {
        return Response.json({
          plan: "enterprise",
          period: today,
          used: dailyUsed,
          limit: enterpriseDailyLimit,
          remaining: Math.max(0, enterpriseDailyLimit - dailyUsed),
          quotaType: "daily",
          modelCategory: "external",
          contextMsgLimit: enterpriseContextMsgLimit,
        });
      }

      if (modelCategory === "advanced_multimodal") {
        return Response.json({
          plan: "enterprise",
          period: currentMonth,
          quotaType: "monthly_media",
          modelCategory: "advanced_multimodal",
          contextMsgLimit: enterpriseContextMsgLimit,
          daily: {
            period: today,
            used: dailyUsed,
            limit: enterpriseDailyLimit,
            remaining: Math.max(0, enterpriseDailyLimit - dailyUsed),
          },
          textConsumesDaily: true,
          photoUsed: monthUsedPhoto,
          photoLimit: enterprisePhotoLimit,
          photoRemaining: Math.max(0, enterprisePhotoLimit - monthUsedPhoto),
          videoAudioUsed: monthUsedVideoAudio,
          videoAudioLimit: enterpriseVideoAudioLimit,
          videoAudioRemaining: Math.max(0, enterpriseVideoAudioLimit - monthUsedVideoAudio),
          monthlyMedia: {
            period: currentMonth,
            photoUsed: monthUsedPhoto,
            photoLimit: enterprisePhotoLimit,
            photoRemaining: Math.max(0, enterprisePhotoLimit - monthUsedPhoto),
            videoAudioUsed: monthUsedVideoAudio,
            videoAudioLimit: enterpriseVideoAudioLimit,
            videoAudioRemaining: Math.max(0, enterpriseVideoAudioLimit - monthUsedVideoAudio),
          },
        });
      }

      return Response.json({
        plan: "enterprise",
        modelCategory: modelCategory || null,
        daily: {
          period: today,
          used: dailyUsed,
          limit: enterpriseDailyLimit,
          remaining: Math.max(0, enterpriseDailyLimit - dailyUsed),
        },
        monthlyMedia: {
          period: currentMonth,
          photoUsed: monthUsedPhoto,
          photoLimit: enterprisePhotoLimit,
          photoRemaining: Math.max(0, enterprisePhotoLimit - monthUsedPhoto),
          videoAudioUsed: monthUsedVideoAudio,
          videoAudioLimit: enterpriseVideoAudioLimit,
          videoAudioRemaining: Math.max(0, enterpriseVideoAudioLimit - monthUsedVideoAudio),
        },
        contextMsgLimit: enterpriseContextMsgLimit,
      });
    }

    // Free 用户：分级配额系统
    // 获取每日外部模型配额
    const dailyRes = await db
      .collection("free_quotas")
      .where({ userId: user.id, day: today })
      .limit(1)
      .get();
    const dailyRow = dailyRes?.data?.[0] || null;
    const dailyUsed = dailyRow?.daily_count ?? dailyRow?.used ?? 0;

    // 获取月度媒体配额
    const monthlyMediaRes = await db
      .collection("free_quotas")
      .where({ userId: user.id, month: currentMonth })
      .limit(1)
      .get();
    const monthlyMediaRow = monthlyMediaRes?.data?.[0] || null;
    const monthUsedPhoto = monthlyMediaRow?.month_used_photo ?? 0;
    const monthUsedVideoAudio = monthlyMediaRow?.month_used_video_audio ?? 0;

    // 根据模型类型返回对应配额
    if (modelCategory === "general") {
      // 通用模型：无限制
      return Response.json({
        plan: "free",
        period: null,
        used: 0,
        limit: null,
        remaining: null,
        quotaType: "unlimited",
        modelCategory: "general",
        contextMsgLimit,
        displayText: "无限畅聊",
      });
    }

    if (modelCategory === "external") {
      // 外部模型：每日配额
      return Response.json({
        plan: "free",
        period: today,
        used: dailyUsed,
        limit: dailyLimit,
        remaining: Math.max(0, dailyLimit - dailyUsed),
        quotaType: "daily",
        modelCategory: "external",
        contextMsgLimit,
      });
    }

    if (modelCategory === "advanced_multimodal") {
      // 高级多模态模型：月度媒体配额
      return Response.json({
        plan: "free",
        period: currentMonth,
        quotaType: "monthly_media",
        modelCategory: "advanced_multimodal",
        contextMsgLimit,
        daily: {
          period: today,
          used: dailyUsed,
          limit: dailyLimit,
          remaining: Math.max(0, dailyLimit - dailyUsed),
        },
        textConsumesDaily: true,
        // 图片配额
        photoUsed: monthUsedPhoto,
        photoLimit: photoLimit,
        photoRemaining: Math.max(0, photoLimit - monthUsedPhoto),
        // 视频/音频配额
        videoAudioUsed: monthUsedVideoAudio,
        videoAudioLimit: videoAudioLimit,
        videoAudioRemaining: Math.max(0, videoAudioLimit - monthUsedVideoAudio),
        textConsumesDaily: true,
        monthlyMedia: {
          period: currentMonth,
          photoUsed: monthUsedPhoto,
          photoLimit: photoLimit,
          photoRemaining: Math.max(0, photoLimit - monthUsedPhoto),
          videoAudioUsed: monthUsedVideoAudio,
          videoAudioLimit: videoAudioLimit,
          videoAudioRemaining: Math.max(0, videoAudioLimit - monthUsedVideoAudio),
        },
      });
    }

    // 默认返回全部配额信息（无特定模型）
    return Response.json({
      plan: "free",
      // 每日外部模型配额
      daily: {
        period: today,
        used: dailyUsed,
        limit: dailyLimit,
        remaining: Math.max(0, dailyLimit - dailyUsed),
      },
      // 月度媒体配额
      monthlyMedia: {
        period: currentMonth,
        photoUsed: monthUsedPhoto,
        photoLimit: photoLimit,
        photoRemaining: Math.max(0, photoLimit - monthUsedPhoto),
        videoAudioUsed: monthUsedVideoAudio,
        videoAudioLimit: videoAudioLimit,
        videoAudioRemaining: Math.max(0, videoAudioLimit - monthUsedVideoAudio),
      },
      contextMsgLimit,
      modelCategory: null,
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
