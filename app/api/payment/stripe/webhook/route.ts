import { NextRequest, NextResponse } from "next/server";
import { addDays, isAfter } from "date-fns";
import { verifyStripeWebhook } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { addAddonCredits } from "@/services/wallet";
import { type ProductType } from "@/constants/addon-packages";
import Stripe from "stripe";

// Stripe Webhook 必须使用 Node.js Runtime
export const runtime = "nodejs";

// 禁用默认 body parser，因为我们需要原始 body 来验证签名
export const dynamic = "force-dynamic";

const PLAN_RANK: Record<string, number> = { Basic: 1, Pro: 2, Enterprise: 3 };

// 统一套餐名称，兼容中文/英文，返回英文 canonical key
const normalizePlanName = (p?: string) => {
  const lower = (p || "").toLowerCase();
  if (lower === "basic" || lower === "基础版") return "Basic";
  if (lower === "pro" || lower === "专业版") return "Pro";
  if (lower === "enterprise" || lower === "企业版") return "Enterprise";
  return p || "";
};

function parseMetadata(metadata: Record<string, string>) {
  const plan = normalizePlanName(metadata.planName || "Pro");
  const periodStr = (metadata.billingCycle || "monthly").toLowerCase();
  const period: "monthly" | "annual" =
    periodStr === "annual" || periodStr === "yearly" ? "annual" : "monthly";
  const userId = metadata.userId || null;
  const days = parseInt(metadata.days || "30", 10);

  return { plan, period, userId, days };
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const { plan, period, userId, days } = parseMetadata(metadata as Record<string, string>);

  if (!userId) {
    console.error("Stripe webhook: Missing userId in metadata");
    return false;
  }

  const amount = (session.amount_total || 0) / 100;
  const currency = session.currency?.toUpperCase() || "USD";
  const sessionId = session.id;
  const productType = (metadata.productType as ProductType) || "SUBSCRIPTION";

  let effectivePlan = plan;
  let effectivePeriod: "monthly" | "annual" = period;
  let expiresAt = addDays(new Date(), days);
  let isProFlag = effectivePlan.toLowerCase() !== "basic";

  // 国内版：支付状态由前端 /confirm 接口处理，这里仅处理加油包追加
  if (IS_DOMESTIC_VERSION) {
    if (productType === "ADDON" && userId) {
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        const imageCredits = parseInt(metadata.imageCredits || "0", 10);
        const videoAudioCredits = parseInt(metadata.videoAudioCredits || "0", 10);

        await db.collection("payments").add({
          userId,
          provider: "stripe",
          providerOrderId: sessionId,
          amount,
          currency,
          status: "COMPLETED",
          type: "ADDON",
          addonPackageId: metadata.addonPackageId || "",
          imageCredits,
          videoAudioCredits,
          createdAt: new Date().toISOString(),
        });

        await addAddonCredits(userId, imageCredits, videoAudioCredits);
      } catch (err) {
        console.error("[stripe webhook][addon] error", err);
      }
    }
    return true;
  }

  // 国际版：使用 Supabase
  if (!IS_DOMESTIC_VERSION && supabaseAdmin) {
    const now = new Date();

    // 获取现有订阅
    const { data: existingSubs } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, period, expires_at")
      .eq("user_id", userId)
      .eq("provider", "stripe");

    // 延长现有订阅
    const samePlan = existingSubs?.find((s) => s.plan === plan);
    const baseDate =
      samePlan?.expires_at && isAfter(new Date(samePlan.expires_at), now)
        ? new Date(samePlan.expires_at)
        : now;
    expiresAt = addDays(baseDate, days);

    // 更新或插入订阅
    await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan,
          period,
          status: "active",
          provider: "stripe",
          provider_order_id: sessionId,
          started_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: "user_id,provider,plan" }
      )
      .select();

    // 记录支付
    await supabaseAdmin.from("payments").insert({
      user_id: userId,
      provider: "stripe",
      provider_order_id: sessionId,
      amount,
      currency,
      status: "COMPLETED",
      plan,
      period,
    });

    // 计算最高级别的有效订阅
    const nowIso = new Date();
    const candidates = [
      ...(existingSubs || []),
      { plan, period, expires_at: expiresAt.toISOString() },
    ].filter((s) => !s.expires_at || isAfter(new Date(s.expires_at), nowIso));

    if (candidates.length > 0) {
      candidates.sort(
        (a, b) => (PLAN_RANK[b.plan] || 0) - (PLAN_RANK[a.plan] || 0)
      );
      const top = candidates[0];
      effectivePlan = top.plan;
      effectivePeriod = (top.period as "monthly" | "annual") || period;
      expiresAt = top.expires_at ? new Date(top.expires_at) : expiresAt;
    }

    // 更新用户元数据
    isProFlag = effectivePlan.toLowerCase() !== "basic";
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        pro: isProFlag,
        plan: effectivePlan,
        plan_exp: expiresAt.toISOString(),
      },
    });

    console.log("Stripe webhook: Subscription updated for user", userId, {
      plan: effectivePlan,
      expiresAt: expiresAt.toISOString(),
    });
  }
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("Missing STRIPE_WEBHOOK_SECRET environment variable");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // 验证 webhook 签名
    const event = verifyStripeWebhook(body, signature, webhookSecret);
    if (!event) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    console.log("Stripe webhook received:", event.type, event.id);

    // 处理事件
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // 只处理支付成功的会话
        if (session.payment_status === "paid") {
          const success = await handleCheckoutSessionCompleted(session);
          if (!success) {
            return NextResponse.json(
              { error: "Failed to process checkout session" },
              { status: 500 }
            );
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        console.log("Payment intent succeeded:", event.data.object);
        break;
      }

      case "payment_intent.payment_failed": {
        console.log("Payment failed:", event.data.object);
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
