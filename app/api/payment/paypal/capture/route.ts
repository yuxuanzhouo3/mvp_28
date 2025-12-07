import { NextRequest, NextResponse } from "next/server";
import { addDays } from "date-fns";
import { capturePayPalOrder, paypalErrorResponse } from "@/lib/paypal";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

    // Persist subscription & payment
    if (supabaseAdmin) {
      const now = new Date();
      const expiresAt = period === "annual" ? addDays(now, 365) : addDays(now, 30);

      const userId =
        (customId && customId.split("|")[0]) ||
        (capture?.custom_id && capture.custom_id.split("|")[0]) ||
        null;

      if (userId) {
        // upsert subscription
        await supabaseAdmin
          .from("subscriptions")
          .upsert({
            user_id: userId,
            plan,
            period,
            status: "active",
            provider: "paypal",
            provider_order_id: orderId,
            started_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          })
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

        // mark user metadata as pro (for quick client reads)
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: { pro: true, plan, plan_exp: expiresAt.toISOString() },
        });
      }
    }

    return NextResponse.json({
      success: true,
      status,
      plan,
      period,
      expiresAt:
        period === "annual"
          ? addDays(new Date(), 365).toISOString()
          : addDays(new Date(), 30).toISOString(),
      raw: result,
    });
  } catch (err) {
    return paypalErrorResponse(err);
  }
}
