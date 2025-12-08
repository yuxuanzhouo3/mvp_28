import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IS_DOMESTIC_VERSION } from "@/config";

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

export async function GET(_req: NextRequest) {
  // Domestic版未接 Supabase 额度表，直接返回 404 以便前端忽略
  if (IS_DOMESTIC_VERSION) {
    return new Response("Not applicable", { status: 404 });
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
