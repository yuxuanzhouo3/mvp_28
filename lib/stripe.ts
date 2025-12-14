import { NextResponse } from "next/server";
import Stripe from "stripe";

// 初始化 Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export function getStripe(): Stripe {
  if (!stripe) {
    throw new Error("Stripe not initialized - missing STRIPE_SECRET_KEY");
  }
  return stripe;
}

/**
 * 创建 Stripe Checkout Session（一次性支付）
 * 支持订阅和加油包两种商品类型
 */
export async function createStripeCheckoutSession(params: {
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  userId?: string;
  customId?: string;
  description?: string;
  billingCycle?: "monthly" | "annual";
  planName?: string;
  // 加油包专用参数
  addonPackageId?: string;
  imageCredits?: string;
  videoAudioCredits?: string;
}) {
  const stripeClient = getStripe();

  // 判断是加油包还是订阅
  const isAddon = !!params.addonPackageId;
  
  // 商品描述
  const productDescription = isAddon
    ? `${params.imageCredits || 0} images + ${params.videoAudioCredits || 0} video/audio credits`
    : `${params.billingCycle === "annual" ? "365 days" : "30 days"} premium access`;

  // 构建 metadata
  const metadata: Record<string, string> = {
    userId: params.userId || "",
    customId: params.customId || "",
    paymentType: "onetime",
  };

  if (isAddon) {
    // 加油包 metadata
    metadata.productType = "ADDON";
    metadata.addonPackageId = params.addonPackageId || "";
    metadata.imageCredits = params.imageCredits || "0";
    metadata.videoAudioCredits = params.videoAudioCredits || "0";
  } else {
    // 订阅 metadata
    metadata.productType = "SUBSCRIPTION";
    metadata.billingCycle = params.billingCycle || "monthly";
    metadata.planName = params.planName || "Pro";
    metadata.days = params.billingCycle === "annual" ? "365" : "30";
  }

  const session = await stripeClient.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: {
            name: params.description || "Premium Subscription",
            description: productDescription,
          },
          unit_amount: Math.round(params.amount * 100), // Stripe 使用分为单位
        },
        quantity: 1,
      },
    ],
    mode: "payment", // 一次性支付模式
    success_url: `${params.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: params.cancelUrl,
    metadata,
  });

  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * 获取 Stripe Checkout Session 详情
 */
export async function retrieveStripeSession(sessionId: string) {
  const stripeClient = getStripe();
  return await stripeClient.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent", "line_items"],
  });
}

/**
 * 验证 Stripe Webhook 签名
 */
export function verifyStripeWebhook(
  payload: string,
  signature: string,
  webhookSecret: string
): Stripe.Event | null {
  try {
    const stripeClient = getStripe();
    return stripeClient.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return null;
  }
}

/**
 * 错误响应生成器
 */
export function stripeErrorResponse(err: unknown) {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Stripe error";
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}



