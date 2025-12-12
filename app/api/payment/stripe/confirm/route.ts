import { NextRequest, NextResponse } from "next/server";
import { retrieveStripeSession, stripeErrorResponse } from "@/lib/stripe";
import { addDays, isAfter } from "date-fns";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

const PLAN_RANK: Record<string, number> = { Basic: 1, Pro: 2, Enterprise: 3 };

/**
 * POST /api/payment/stripe/confirm
 * 确认 Stripe 支付状态并更新订阅
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body as { sessionId?: string };

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Missing sessionId" },
        { status: 400 }
      );
    }

    // 获取 Session 详情
    const session = await retrieveStripeSession(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        {
          success: false,
          error: "Payment not completed",
          status: session.payment_status,
        },
        { status: 400 }
      );
    }

    // 解析 metadata
    const metadata = session.metadata || {};
    const plan = metadata.planName || "Pro";
    const periodStr = (metadata.billingCycle || "monthly").toLowerCase();
    const period: "monthly" | "annual" =
      periodStr === "annual" || periodStr === "yearly" ? "annual" : "monthly";
    const userId = metadata.userId || null;
    const days = parseInt(metadata.days || "30", 10);

    const amount = (session.amount_total || 0) / 100;
    const currency = session.currency?.toUpperCase() || "USD";

    let effectivePlan = plan;
    let effectivePeriod: "monthly" | "annual" = period;
    let expiresAt = addDays(new Date(), days);
    let isProFlag = effectivePlan.toLowerCase() !== "basic";

    // 国际版：Supabase
    if (!IS_DOMESTIC_VERSION && supabaseAdmin && userId) {
      const now = new Date();

      // 检查是否已处理过此支付
      const { data: existingPayment } = await supabaseAdmin
        .from("payments")
        .select("id")
        .eq("provider_order_id", sessionId)
        .eq("provider", "stripe")
        .maybeSingle();

      if (existingPayment) {
        // 已处理过，直接返回当前订阅状态
        const { data: subs } = await supabaseAdmin
          .from("subscriptions")
          .select("plan, period, expires_at")
          .eq("user_id", userId)
          .eq("status", "active");

        if (subs && subs.length > 0) {
          subs.sort(
            (a, b) => (PLAN_RANK[b.plan] || 0) - (PLAN_RANK[a.plan] || 0)
          );
          const top = subs[0];
          return NextResponse.json({
            success: true,
            status: "already_processed",
            plan: top.plan,
            period: top.period,
            expiresAt: top.expires_at,
          });
        }
      }

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
    }

    // 国内版：CloudBase
    if (IS_DOMESTIC_VERSION && userId) {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();

      const now = new Date();
      const subsColl = db.collection("subscriptions");
      const existing = await subsColl
        .where({ userId, provider: "stripe", plan })
        .limit(1)
        .get();

      const nowIso = new Date().toISOString();
      const subPayload = {
        userId,
        plan,
        period,
        status: "active",
        provider: "stripe",
        providerOrderId: sessionId,
        startedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        updatedAt: nowIso,
      };

      if (existing?.data?.[0]?._id) {
        await subsColl.doc(existing.data[0]._id).update(subPayload);
      } else {
        await subsColl.add({ ...subPayload, createdAt: nowIso });
      }

      // 记录支付
      await db.collection("payments").add({
        userId,
        provider: "stripe",
        providerOrderId: sessionId,
        amount,
        currency,
        status: "COMPLETED",
        plan,
        period,
        createdAt: nowIso,
      });

      // 更新用户
      isProFlag = effectivePlan.toLowerCase() !== "basic";
      await db.collection("users").doc(userId).update({
        pro: isProFlag,
        plan: effectivePlan,
        plan_exp: expiresAt.toISOString(),
        subscriptionTier: effectivePlan,
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      status: "COMPLETED",
      plan: effectivePlan,
      period: effectivePeriod,
      expiresAt: expiresAt.toISOString(),
      amount,
      currency,
    });
  } catch (err) {
    console.error("Stripe confirm error:", err);
    return stripeErrorResponse(err);
  }
}



