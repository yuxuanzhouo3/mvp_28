import { NextRequest, NextResponse } from "next/server";
import { addDays, isAfter } from "date-fns";
import { capturePayPalOrder, paypalErrorResponse } from "@/lib/paypal";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PLAN_RANK: Record<string, number> = { Basic: 1, Pro: 2, Enterprise: 3 };
const CYCLE_DAYS: Record<"monthly" | "annual", number> = {
  monthly: 30,
  annual: 365,
};

function parsePlanPeriod(customId?: string | null, description?: string | null) {
  let plan = "Pro";
  let period: "monthly" | "annual" = "monthly";

  if (customId) {
    const parts = customId.split("|");
    if (parts.length >= 3) {
      plan = parts[1] || plan;
      const p = (parts[2] || "").toLowerCase();
      period = p === "annual" || p === "yearly" ? "annual" : "monthly";
    }
  }

  if ((!plan || plan.trim() === "") && description) {
    const parts = description.split(" - ");
    if (parts[0]) plan = parts[0];
    if (parts[1]) {
      const p = parts[1].toLowerCase();
      period = p === "annual" || p === "yearly" ? "annual" : "monthly";
    }
  }

  plan = plan.trim() || "Pro";
  return { plan, period };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body as { orderId?: string };
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Missing orderId" },
        { status: 400 },
      );
    }

    const result = await capturePayPalOrder(orderId);
    const unit = result.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    const status = capture?.status || result.status;

    const amountValue = parseFloat(
      capture?.amount?.value ||
        unit?.amount?.value ||
        "0",
    );
    const currency =
      capture?.amount?.currency_code ||
      unit?.amount?.currency_code ||
      "USD";

    const customId = unit?.custom_id || capture?.custom_id || null;
    const description = unit?.description || null;
    const { plan, period } = parsePlanPeriod(customId, description);

    const userId =
      (customId && customId.split("|")[0]) ||
      (capture?.custom_id && capture.custom_id.split("|")[0]) ||
      null;

  // defaults in case we cannot reach database
  let effectivePlan = plan;
  let effectivePeriod: "monthly" | "annual" = period;
  let expiresAt = period === "annual" ? addDays(new Date(), 365) : addDays(new Date(), 30);

  // Persist subscription & payment
  if (supabaseAdmin && userId) {
    const now = new Date();
    // fetch all existing subs for this user/provider
    const { data: existingSubs } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, period, expires_at")
      .eq("user_id", userId)
      .eq("provider", "paypal");

    // extend or insert current plan entry
    const samePlan = existingSubs?.find((s) => s.plan === plan);
    const baseDate =
      samePlan?.expires_at && isAfter(new Date(samePlan.expires_at), now)
        ? new Date(samePlan.expires_at)
        : now;
    expiresAt = addDays(baseDate, CYCLE_DAYS[period] || 30);

    await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan,
          period,
          status: "active",
          provider: "paypal",
          provider_order_id: orderId,
          started_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: "user_id,provider,plan" },
      )
      .select();

    // insert payment record
    await supabaseAdmin.from("payments").insert({
      user_id: userId,
      provider: "paypal",
      provider_order_id: orderId,
      amount: amountValue,
      currency,
      status: status || "COMPLETED",
      plan,
      period,
    });

    // determine highest active plan by rank
    const nowIso = new Date();
    const candidates = [
      ...(existingSubs || []),
      { plan, period, expires_at: expiresAt.toISOString() },
    ].filter((s) => !s.expires_at || isAfter(new Date(s.expires_at), nowIso));

    if (candidates.length > 0) {
      candidates.sort((a, b) => (PLAN_RANK[b.plan] || 0) - (PLAN_RANK[a.plan] || 0));
      const top = candidates[0];
      effectivePlan = top.plan;
      effectivePeriod = (top.period as "monthly" | "annual") || period;
      expiresAt = top.expires_at ? new Date(top.expires_at) : expiresAt;
    }

    // mark user metadata as pro (for quick client reads)
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        pro: true,
        plan: effectivePlan,
        plan_exp: expiresAt.toISOString(),
      },
    });
  }

    return NextResponse.json({
      success: true,
      status,
      plan: effectivePlan,
      period: effectivePeriod,
      expiresAt: expiresAt.toISOString(),
      raw: result,
    });
  } catch (err) {
    return paypalErrorResponse(err);
  }
}
