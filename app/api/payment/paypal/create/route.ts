import { NextRequest, NextResponse } from "next/server";
import { createPayPalOrder, paypalErrorResponse } from "@/lib/paypal";
import { pricingPlans } from "@/constants/pricing";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planName, billingPeriod, userId } = body as {
      planName: string;
      billingPeriod: "monthly" | "annual";
      userId?: string;
    };

    const plan = pricingPlans.find((p) => p.name === planName) || pricingPlans[0];
    // Parse prices
    const monthlyPrice = parseFloat(plan.price.replace(/[^0-9.]/g, "") || "0");
    const annualMonthlyPrice = parseFloat(
      plan.annualPrice.replace(/[^0-9.]/g, "") || "0",
    );
    // Annual UI显示“$X.XX / month (billed annually)”，实际应一次性收取 12 个月
    const amount =
      billingPeriod === "annual" ? annualMonthlyPrice * 12 : monthlyPrice;

    // Build base URL with priority: env -> forwarded host -> request origin
    const envBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    const proto =
      request.headers.get("x-forwarded-proto") ||
      request.headers.get("x-forwarded-protocol") ||
      "https";
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const headerBase = host ? `${proto}://${host}` : null;
    const origin = envBase || headerBase || request.nextUrl.origin;

    const returnUrl = `${origin}/payment/paypal/success`;
    const cancelUrl = `${origin}/payment/paypal/cancel`;

    const order = await createPayPalOrder({
      amount,
      currency: "USD",
      returnUrl,
      cancelUrl,
      userId,
      customId: [userId || "anon", plan.name, billingPeriod].join("|"),
      description: `${plan.name} - ${billingPeriod}`,
    });

    if (!order.approvalUrl) {
      return NextResponse.json(
        { success: false, error: "No PayPal approval URL returned" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      orderId: order.orderId,
      approvalUrl: order.approvalUrl,
    });
  } catch (err) {
    return paypalErrorResponse(err);
  }
}
