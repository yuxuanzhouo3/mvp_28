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
  getTodayString,
  getCurrentYearMonth,
  getModelCategory,
  ModelCategory,
} from "@/utils/model-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const QUOTA_LOG = false;

const getMonthlyLimit = () => {
  const raw = process.env.NEXT_PUBLIC_BASIC_MONTHLY_LIMIT || "100";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(100000, n);
};

const getPlanInfo = (meta: any) => {
  const rawPlan =
    (meta?.plan as string | undefined) ||
    (meta?.subscriptionTier as string | undefined) ||
    "";
  const planLower = typeof rawPlan === "string" ? rawPlan.toLowerCase() : "";
  const isBasic = planLower === "basic";
  const isPro = planLower === "pro" || planLower === "enterprise" || (!!meta?.pro && !isBasic);
  const isFree = !isPro && !isBasic;
  return { planLower, isBasic, isPro, isFree };
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
    const monthlyLimit = getMonthlyLimit();
    const photoLimit = getFreeMonthlyPhotoLimit();
    const videoAudioLimit = getFreeMonthlyVideoAudioLimit();
    const contextMsgLimit = getFreeContextMsgLimit();

    // Pro/Enterprise：返回无限制
    if (plan.isPro && !plan.isBasic) {
      return Response.json({
        plan: plan.planLower || "pro",
        period: null,
        used: 0,
        limit: null,
        remaining: null,
        // 新版配额信息
        quotaType: "unlimited",
        modelCategory: modelCategory || "all",
        contextMsgLimit: null, // Pro 用户无上下文限制
      });
    }

    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    // Basic 用户：月度配额
    if (plan.isBasic) {
      const monthStart = new Date(today);
      monthStart.setDate(1);
      const monthStr = monthStart.toISOString().split("T")[0];

      const res = await db
        .collection("basic_quotas")
        .where({ userId: user.id, month: monthStr })
        .limit(1)
        .get();

      const quotaRow = res?.data?.[0] || null;
      if (QUOTA_LOG) console.log("[quota] basic row", quotaRow);
      const used = quotaRow?.used ?? 0;
      const limit = Number.isFinite(monthlyLimit)
        ? monthlyLimit
        : quotaRow?.limit_per_month ?? 100;

      return Response.json({
        plan: "basic",
        period: monthStr,
        used,
        limit,
        remaining: Math.max(0, limit - used),
        quotaType: "monthly",
        modelCategory: modelCategory || "all",
        contextMsgLimit: 50, // Basic 用户 50 条上下文
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
  const monthlyLimit = getMonthlyLimit();

  const userPlan =
    (userData.user.user_metadata as any)?.plan ||
    ((userData.user.user_metadata as any)?.pro ? "Pro" : null);
  const planLower = typeof userPlan === "string" ? userPlan.toLowerCase() : "";
  const isFree = !planLower || planLower === "free";
  const isBasic = planLower === "basic";

  if (isBasic) {
    const monthStart = new Date(today);
    monthStart.setDate(1);
    const monthStr = monthStart.toISOString().split("T")[0];

    const { data: quotaRow, error: quotaErr } = await supabase
      .from("basic_quotas")
      .select("used, limit_per_month")
      .eq("user_id", userId)
      .eq("month", monthStr)
      .single();

    if (quotaErr && quotaErr.code !== "PGRST116") {
      console.error("Basic quota fetch error", quotaErr);
      return new Response("Failed to fetch quota", { status: 500 });
    }

    const used = quotaRow?.used ?? 0;
    const limit = Number.isFinite(monthlyLimit)
      ? monthlyLimit
      : quotaRow?.limit_per_month ?? 100;

    return Response.json({
      plan: "basic",
      period: monthStr,
      used,
      limit,
      remaining: Math.max(0, limit - used),
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
  });
}
