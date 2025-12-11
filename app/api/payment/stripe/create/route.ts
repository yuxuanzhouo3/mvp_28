import { NextRequest, NextResponse } from "next/server";
import { createStripeCheckoutSession, stripeErrorResponse } from "@/lib/stripe";
import { pricingPlans } from "@/constants/pricing";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planName, billingPeriod, userId } = body as {
      planName: string;
      billingPeriod: "monthly" | "annual";
      userId?: string;
    };

    // 查找套餐
    const plan = pricingPlans.find((p) => p.name === planName) || pricingPlans[1]; // 默认 Pro

    // 解析价格 (美元)
    const monthlyPrice = parseFloat(plan.price.replace(/[^0-9.]/g, "") || "0");
    const annualMonthlyPrice = parseFloat(
      plan.annualPrice.replace(/[^0-9.]/g, "") || "0"
    );

    // 年付一次性收取12个月
    const amount =
      billingPeriod === "annual" ? annualMonthlyPrice * 12 : monthlyPrice;

    // 构建回调URL
    const envBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    const proto =
      request.headers.get("x-forwarded-proto") ||
      request.headers.get("x-forwarded-protocol") ||
      "https";
    const host =
      request.headers.get("x-forwarded-host") || request.headers.get("host");
    const headerBase = host ? `${proto}://${host}` : null;
    const origin = envBase || headerBase || request.nextUrl.origin;

    const successUrl = `${origin}/payment/stripe/success`;
    const cancelUrl = `${origin}/payment/stripe/cancel`;

    // 创建 Stripe Checkout Session
    const { sessionId, url } = await createStripeCheckoutSession({
      amount,
      currency: "USD",
      successUrl,
      cancelUrl,
      userId,
      customId: [userId || "anon", plan.name, billingPeriod].join("|"),
      description: `${plan.name} - ${billingPeriod === "annual" ? "Annual" : "Monthly"}`,
      billingCycle: billingPeriod,
      planName: plan.name,
    });

    if (!url) {
      return NextResponse.json(
        { success: false, error: "Failed to create Stripe checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
      url,
    });
  } catch (err) {
    console.error("Stripe create error:", err);
    return stripeErrorResponse(err);
  }
}


