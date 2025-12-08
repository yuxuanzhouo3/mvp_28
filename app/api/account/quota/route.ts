import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getDailyLimit = () => {
  const raw = process.env.NEXT_PUBLIC_FREE_DAILY_LIMIT || "10";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(1000, n);
};

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

export async function GET(req: NextRequest) {
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
      console.warn("[quota] no token for domestic request");
      return new Response("Unauthorized", { status: 401 });
    }

    const auth = new CloudBaseAuthService();
    const user = await auth.validateToken(token);
    if (!user) {
      console.warn("[quota] token invalid / user not found");
      return new Response("Unauthorized", { status: 401 });
    }

    const plan = getPlanInfo(user.metadata);
    console.log("[quota] user", user.id, "plan", plan.planLower, "isBasic", plan.isBasic, "isPro", plan.isPro, "isFree", plan.isFree);
    const today = new Date().toISOString().split("T")[0];
    const dailyLimit = getDailyLimit();
    const monthlyLimit = getMonthlyLimit();

    // Pro/Enterprise：返回无限制
    if (plan.isPro && !plan.isBasic) {
      return Response.json({
        plan: plan.planLower || "pro",
        period: null,
        used: 0,
        limit: null,
        remaining: null,
      });
    }

    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

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
      console.log("[quota] basic row", quotaRow);
      const used = quotaRow?.used ?? 0;
      const limit = Number.isFinite(monthlyLimit)
        ? monthlyLimit
        : quotaRow?.limit_per_month ?? 100;

      console.log("[quota] basic response", {
        userId: user.id,
        plan: plan.planLower || "basic",
        period: monthStr,
        used,
        limit,
        remaining: Math.max(0, limit - used),
      });

      return Response.json({
        plan: "basic",
        period: monthStr,
        used,
        limit,
        remaining: Math.max(0, limit - used),
      });
    }

    // Free 用户
    const res = await db
      .collection("free_quotas")
      .where({ userId: user.id, day: today })
      .limit(1)
      .get();

    const quotaRow = res?.data?.[0] || null;
    console.log("[quota] free row", quotaRow);
    const used = quotaRow?.used ?? 0;
    const limit = Number.isFinite(dailyLimit)
      ? dailyLimit
      : quotaRow?.limit_per_day ?? 10;

    console.log("[quota] free response", {
      userId: user.id,
      plan: "free",
      period: today,
      used,
      limit,
      remaining: Math.max(0, limit - used),
    });

    return Response.json({
      plan: "free",
      period: today,
      used,
      limit,
      remaining: Math.max(0, limit - used),
    });
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = userData.user.id;
  const today = new Date().toISOString().split("T")[0];
  const dailyLimit = getDailyLimit();
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
