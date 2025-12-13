import { NextRequest, NextResponse } from "next/server";
import { createStripeCheckoutSession, stripeErrorResponse } from "@/lib/stripe";
import { pricingPlans } from "@/constants/pricing";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { planName, billingPeriod, userId } = body as {
      planName: string;
      billingPeriod: "monthly" | "annual";
      userId?: string;
    };

    // 如果前端未传 userId，尝试从会话自动获取
    if (!userId) {
      if (IS_DOMESTIC_VERSION) {
        const cookieStore = await cookies();
        const token = cookieStore.get("auth-token")?.value;
        if (token) {
          const auth = new CloudBaseAuthService();
          const user = await auth.validateToken(token);
          if (user?.id) {
            userId = user.id;
          }
        }
      } else {
        const supabase = await createClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) {
          userId = data.user.id;
        }
      }
    }

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


