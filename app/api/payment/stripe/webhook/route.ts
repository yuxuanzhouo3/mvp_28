import { headers } from "next/headers";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  renewSupabaseMonthlyQuota,
  addSupabaseAddonCredits,
} from "@/services/wallet-supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`❌ Stripe Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // 订阅续费（Stripe 账期为权威）
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;

    // 1) 获取 userId，Invoice 优先，缺失则查 Subscription
    let userId = invoice.metadata?.userId as string | undefined;
    if (!userId && invoice.subscription) {
      if (typeof invoice.subscription === "string") {
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        userId = sub.metadata?.userId as string | undefined;
      } else {
        userId = (invoice.subscription as Stripe.Subscription).metadata?.userId as
          | string
          | undefined;
      }
    }

    if (!userId) {
      console.error("❌ Webhook Error: No userId found in invoice or subscription metadata");
      return new Response("No userId found", { status: 200 });
    }

    // 读取 plan 信息（metadata 优先，其次 subscription.items 的价格昵称）
    const metaPlan =
      invoice.metadata?.planName ||
      (typeof invoice.subscription !== "string"
        ? (invoice.subscription as Stripe.Subscription).metadata?.planName
        : undefined) ||
      (invoice.lines?.data?.[0]?.price?.nickname as string | undefined) ||
      "Pro";
    const plan = (() => {
      const lower = (metaPlan || "").toLowerCase();
      if (lower.includes("basic")) return "Basic";
      if (lower.includes("enterprise")) return "Enterprise";
      return "Pro";
    })();
    const isProFlag = plan.toLowerCase() !== "basic";

    // 2) 权威周期：直接使用 Stripe 的 period
    const lineItem = invoice.lines?.data?.[0];
    const periodEnd = lineItem?.period?.end || invoice.period_end;
    const periodStart = lineItem?.period?.start || invoice.period_start;

    if (!periodEnd) {
      console.error("❌ Webhook Error: Missing period end");
      return new Response("Missing period end", { status: 200 });
    }

    const planExpIso = new Date(periodEnd * 1000).toISOString();

    // 3) 补录锚点：使用 Stripe 周期开始日的日号
    let anchorDay: number | undefined;
    if (periodStart) {
      anchorDay = new Date(periodStart * 1000).getUTCDate();
    }

    // 4) 更新 wallet & 刷新额度
    try {
      // 更新订阅表
      if (supabaseAdmin) {
        await supabaseAdmin
          .from("subscriptions")
          .upsert(
            {
              user_id: userId,
              plan,
              period: "monthly",
              status: "active",
              provider: "stripe",
              provider_order_id: invoice.id,
              started_at: periodStart ? new Date(periodStart * 1000).toISOString() : null,
              expires_at: planExpIso,
            },
            { onConflict: "user_id" }
          );
      }

      await supabaseAdmin
        ?.from("user_wallets")
        .update({
          plan,
          subscription_tier: plan,
          pro: isProFlag,
          plan_exp: planExpIso,
          billing_cycle_anchor: anchorDay ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      await renewSupabaseMonthlyQuota(userId);

      console.log(`✅ [Stripe Webhook] Renewed for user ${userId}, exp: ${planExpIso}`);
    } catch (error) {
      console.error("❌ DB Update Error:", error);
      return new Response("DB Error", { status: 500 });
    }
  }

  // 新购/升级/加油包等：checkout.session.completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") {
      return new Response(null, { status: 200 });
    }

    const metadata = session.metadata || {};
    const productType = (metadata.productType as string) || "SUBSCRIPTION";
    const userId =
      metadata.userId ||
      (session.subscription as any)?.metadata?.userId ||
      (typeof session.subscription === "string"
        ? (await stripe.subscriptions.retrieve(session.subscription)).metadata?.userId
        : undefined);

    if (!userId) {
      console.error("❌ Webhook Error: No userId in checkout.session.completed");
      return new Response(null, { status: 200 });
    }

    const amount = (session.amount_total || 0) / 100;
    const currency = session.currency?.toUpperCase() || "USD";

    // 加油包
    if (productType === "ADDON") {
      const imageCredits = parseInt(metadata.imageCredits || "0", 10);
      const videoAudioCredits = parseInt(metadata.videoAudioCredits || "0", 10);
      try {
        await supabaseAdmin?.from("payments").insert({
          user_id: userId,
          provider: "stripe",
          provider_order_id: session.id,
          amount,
          currency,
          status: "COMPLETED",
          type: "ADDON",
          addon_package_id: metadata.addonPackageId || "",
          image_credits: imageCredits,
          video_audio_credits: videoAudioCredits,
        });
        await addSupabaseAddonCredits(userId, imageCredits, videoAudioCredits);
        console.log(`[Stripe][ADDON] credited for user ${userId}`);
      } catch (err) {
        console.error("[Stripe][ADDON] error", err);
        return new Response("DB Error", { status: 500 });
      }
      return new Response(null, { status: 200 });
    }

    // 订阅新购/升级：直接用 subscription 的 current_period_end 作为权威
    if (session.subscription) {
      const sub =
        typeof session.subscription === "string"
          ? await stripe.subscriptions.retrieve(session.subscription)
          : (session.subscription as Stripe.Subscription);

      const plan = (() => {
        const lower =
          (metadata.planName ||
            sub.metadata?.planName ||
            sub.items?.data?.[0]?.price?.nickname ||
            "Pro")?.toLowerCase() || "pro";
        if (lower.includes("basic")) return "Basic";
        if (lower.includes("enterprise")) return "Enterprise";
        return "Pro";
      })();
      const isProFlag = plan.toLowerCase() !== "basic";
      const periodEnd = sub.current_period_end;
      const periodStart = sub.current_period_start;
      const planExpIso = new Date(periodEnd * 1000).toISOString();
      const anchorDay = periodStart
        ? new Date(periodStart * 1000).getUTCDate()
        : undefined;

      try {
        await supabaseAdmin
          ?.from("subscriptions")
          .upsert(
            {
              user_id: userId,
              plan,
              period: sub.items?.data?.[0]?.plan?.interval === "year" ? "annual" : "monthly",
              status: "active",
              provider: "stripe",
              provider_order_id: session.id,
              started_at: periodStart ? new Date(periodStart * 1000).toISOString() : null,
              expires_at: planExpIso,
            },
            { onConflict: "user_id" }
          );

        await supabaseAdmin
          ?.from("user_wallets")
          .update({
            plan,
            subscription_tier: plan,
            pro: isProFlag,
            plan_exp: planExpIso,
            billing_cycle_anchor: anchorDay ?? undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        await supabaseAdmin?.from("payments").insert({
          user_id: userId,
          provider: "stripe",
          provider_order_id: session.id,
          amount,
          currency,
          status: "COMPLETED",
          type: "SUBSCRIPTION",
          plan,
          period: sub.items?.data?.[0]?.plan?.interval === "year" ? "annual" : "monthly",
        });

        await renewSupabaseMonthlyQuota(userId);
        console.log(`[Stripe][SUBSCRIPTION] processed for user ${userId}`);
      } catch (err) {
        console.error("[Stripe][SUBSCRIPTION] error", err);
        return new Response("DB Error", { status: 500 });
      }
    }
  }

  return new Response(null, { status: 200 });
}
