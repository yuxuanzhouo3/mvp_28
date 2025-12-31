import { headers } from "next/headers";
import Stripe from "stripe";
import { isAfter } from "date-fns";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  addSupabaseAddonCredits,
  addCalendarMonths,
  getBeijingYMD,
  getSupabasePlanMediaLimits,
  renewSupabaseMonthlyQuota,
  seedSupabaseWalletForPlan,
  updateSupabaseSubscription,
  upgradeSupabaseMonthlyQuota,
} from "@/services/wallet-supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

const PLAN_RANK: Record<string, number> = { Basic: 1, Pro: 2, Enterprise: 3 };

// 统一套餐名称，兼容中文/英文，返回英文 canonical key
const normalizePlanName = (p?: string) => {
  const lower = (p || "").toLowerCase();
  if (lower === "basic" || lower === "基础版") return "Basic";
  if (lower === "pro" || lower === "专业版") return "Pro";
  if (lower === "enterprise" || lower === "企业版") return "Enterprise";
  return p || "";
};

export async function POST(req: Request) {
  // 如果未配置 Stripe 密钥，则跳过处理，避免构建/运行时报错
  if (!stripeKey || !webhookSecret) {
    console.warn("[stripe webhook] missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET, skipping");
    return new Response("stripe disabled", { status: 200 });
  }

  const stripe = new Stripe(stripeKey);

  const body = await req.text();
  const signature = (await headers()).get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`❌ Stripe Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // 当前实现使用 Checkout Session（mode=payment，一次性支付），以 checkout.session.completed 为权威
  if (event.type !== "checkout.session.completed") {
    return new Response(null, { status: 200 });
  }

  // 订阅续费（Stripe 账期为权威）
  if (false) {
    const invoice = event.data.object as any;

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

    if (!supabaseAdmin) {
      console.warn("[stripe webhook] supabaseAdmin not available, skipping");
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
    const actualCents = session.amount_total || 0;

    // 金额一致性校验：期望金额写入 Stripe metadata（create 阶段），webhook 阶段严格对齐
    const expectedCentsStr =
      metadata.expectedAmountCents ||
      (metadata as any).expected_amount_cents ||
      null;
    const expectedAmountStr =
      metadata.expectedAmount ||
      (metadata as any).expected_amount ||
      null;

    if (expectedCentsStr != null) {
      const expectedCents = parseInt(String(expectedCentsStr), 10);
      if (!Number.isNaN(expectedCents) && expectedCents !== actualCents) {
        console.error("[stripe webhook][amount-mismatch]", {
          sessionId: session.id,
          userId,
          expectedCents,
          actualCents,
          currency,
          productType,
          metadata,
        });
        return new Response(null, { status: 200 });
      }
    } else if (expectedAmountStr != null) {
      const expected = parseFloat(String(expectedAmountStr));
      if (!Number.isNaN(expected)) {
        const expectedCents = Math.round(expected * 100);
        if (expectedCents !== actualCents) {
          console.error("[stripe webhook][amount-mismatch]", {
            sessionId: session.id,
            userId,
            expectedCents,
            actualCents,
            currency,
            productType,
            metadata,
          });
          return new Response(null, { status: 200 });
        }
      }
    }

    // 幂等：按 provider + provider_order_id best-effort 去重（建议后续在 DB 加唯一约束）
    const { data: existingPayment } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("provider_order_id", session.id)
      .eq("provider", "stripe")
      .maybeSingle();

    // 加油包
    if (productType === "ADDON") {
      const imageCredits = parseInt(metadata.imageCredits || "0", 10);
      const videoAudioCredits = parseInt(metadata.videoAudioCredits || "0", 10);

      if (existingPayment) {
        console.log("[Stripe][ADDON] already processed", { sessionId: session.id, userId });
        return new Response(null, { status: 200 });
      }

      try {
        await supabaseAdmin.from("payments").insert({
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
          source: "global", // 国际版数据标识
        });
        await addSupabaseAddonCredits(userId, imageCredits, videoAudioCredits);
        console.log(`[Stripe][ADDON] credited for user ${userId}`);
      } catch (err) {
        console.error("[Stripe][ADDON] error", err);
        return new Response("DB Error", { status: 500 });
      }
      return new Response(null, { status: 200 });
    }

    // 订阅 (SUBSCRIPTION)：一次性支付，基于 metadata 计算到期与降级计划
    const plan = normalizePlanName((metadata.planName as string) || "Pro") || "Pro";
    const periodStr = String(metadata.billingCycle || "monthly").toLowerCase();
    const period: "monthly" | "annual" =
      periodStr === "annual" || periodStr === "yearly" ? "annual" : "monthly";

    // 从 metadata 读取升级信息
    const metaDays = parseInt(metadata.days || "0", 10);
    const isUpgradeOrder = metadata.isUpgrade === "true";

    try {
      const now = new Date();
      const nowIso = now.toISOString();

      const { data: walletRow } = await supabaseAdmin
        .from("user_wallets")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const currentPlanKey = normalizePlanName(walletRow?.plan || "");
      const currentPlanExp = walletRow?.plan_exp ? new Date(walletRow.plan_exp) : null;
      const currentPlanActive = currentPlanExp ? isAfter(currentPlanExp, now) : false;

      const purchasePlanKey = normalizePlanName(plan);
      const purchaseRank = PLAN_RANK[purchasePlanKey] || 0;
      const currentRank = PLAN_RANK[currentPlanKey] || 0;
      const isUpgrade = purchaseRank > currentRank && currentPlanActive;
      const isDowngrade = purchaseRank < currentRank && currentPlanActive;
      const isSameActive = purchaseRank === currentRank && currentPlanActive;
      const isNewOrExpired = !currentPlanActive || !currentPlanKey;

      const monthsToAdd = period === "annual" ? 12 : 1;
      const anchorDay =
        walletRow?.billing_cycle_anchor ||
        (walletRow?.monthly_reset_at
          ? getBeijingYMD(new Date(walletRow.monthly_reset_at)).day
          : getBeijingYMD(now).day);

      // 计算到期日期：升级订单使用 metadata.days（天数折算），否则使用月度计算
      let purchaseExpiresAt: Date;
      if (isUpgradeOrder && metaDays > 0) {
        // 升级订单：使用天数折算
        purchaseExpiresAt = new Date(now.getTime() + metaDays * 24 * 60 * 60 * 1000);
        console.log(`[Stripe][SUBSCRIPTION] upgrade with days: ${metaDays}, expires: ${purchaseExpiresAt.toISOString()}`);
      } else {
        // 普通订单：使用月度计算
        const baseDate = isSameActive && currentPlanExp ? currentPlanExp : now;
        purchaseExpiresAt = addCalendarMonths(baseDate, monthsToAdd, anchorDay);
      }

      if (!existingPayment) {
        await supabaseAdmin.from("payments").insert({
          user_id: userId,
          provider: "stripe",
          provider_order_id: session.id,
          amount,
          currency,
          status: "COMPLETED",
          type: "SUBSCRIPTION",
          source: "global", // 国际版数据标识
        });
      }

      const { imageLimit, videoLimit } = getSupabasePlanMediaLimits(plan.toLowerCase());

      if (isDowngrade) {
        const scheduledStart = currentPlanExp && currentPlanActive ? currentPlanExp : now;
        const scheduledExpire = addCalendarMonths(scheduledStart, monthsToAdd, anchorDay);
        const pendingDowngrade = JSON.stringify({
          targetPlan: plan,
          effectiveAt: scheduledStart.toISOString(),
        });

        await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: userId,
            plan,
            period,
            status: "pending",
            provider: "stripe",
            provider_order_id: session.id,
            started_at: scheduledStart.toISOString(),
            expires_at: scheduledExpire.toISOString(),
            type: "SUBSCRIPTION",
          },
          { onConflict: "user_id" }
        );

        await supabaseAdmin
          .from("user_wallets")
          .update({
            pending_downgrade: pendingDowngrade,
            updated_at: nowIso,
          })
          .eq("user_id", userId);

        console.log(`[Stripe][SUBSCRIPTION] downgrade scheduled for user ${userId}`);
        return new Response(null, { status: 200 });
      }

      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          plan,
          period,
          status: "active",
          provider: "stripe",
          provider_order_id: session.id,
          started_at: nowIso,
          expires_at: purchaseExpiresAt.toISOString(),
          type: "SUBSCRIPTION",
        },
        { onConflict: "user_id" }
      );

      const isProFlag = plan.toLowerCase() !== "basic" && plan.toLowerCase() !== "free";

      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          pro: isProFlag,
          plan,
          plan_exp: purchaseExpiresAt.toISOString(),
        },
      });

      await updateSupabaseSubscription(userId, plan, purchaseExpiresAt.toISOString(), isProFlag, null);

      if (isUpgrade || isNewOrExpired) {
        await upgradeSupabaseMonthlyQuota(userId, imageLimit, videoLimit);
      } else if (isSameActive) {
        await renewSupabaseMonthlyQuota(userId);
      }

      await seedSupabaseWalletForPlan(userId, plan.toLowerCase(), {
        forceReset: isUpgrade || isNewOrExpired,
      });

      console.log(`[Stripe][SUBSCRIPTION] processed for user ${userId}`);
    } catch (err) {
      console.error("[Stripe][SUBSCRIPTION] error", err);
      return new Response("DB Error", { status: 500 });
    }
  }

  return new Response(null, { status: 200 });
}
