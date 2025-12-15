import { NextRequest, NextResponse } from "next/server";
import { retrieveStripeSession, stripeErrorResponse } from "@/lib/stripe";
import { addDays, isAfter } from "date-fns";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { addAddonCredits, upgradeMonthlyQuota, renewMonthlyQuota, seedWalletForPlan, getPlanMediaLimits } from "@/services/wallet";
import {
  addSupabaseAddonCredits,
  upgradeSupabaseMonthlyQuota,
  renewSupabaseMonthlyQuota,
  seedSupabaseWalletForPlan,
  getSupabasePlanMediaLimits,
  updateSupabaseSubscription,
} from "@/services/wallet-supabase";
import { type ProductType } from "@/constants/addon-packages";

const PLAN_RANK: Record<string, number> = { Basic: 1, Pro: 2, Enterprise: 3 };

// 统一套餐名称，兼容中文/英文，返回英文 canonical key
const normalizePlanName = (p?: string) => {
  const lower = (p || "").toLowerCase();
  if (lower === "basic" || lower === "基础版") return "Basic";
  if (lower === "pro" || lower === "专业版") return "Pro";
  if (lower === "enterprise" || lower === "企业版") return "Enterprise";
  return p || "";
};

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
    const productType = (metadata.productType as ProductType) || "SUBSCRIPTION";
    const userId = metadata.userId || null;
    const amount = (session.amount_total || 0) / 100;
    const currency = session.currency?.toUpperCase() || "USD";

    // ========================================
    // 加油包 (ADDON) 处理分支
    // 注意：加油包购买不影响用户的 tier 和 expired_at
    // ========================================
    if (productType === "ADDON" && userId) {
      const addonPackageId = metadata.addonPackageId || "";
      const imageCredits = parseInt(metadata.imageCredits || "0", 10);
      const videoAudioCredits = parseInt(metadata.videoAudioCredits || "0", 10);

      console.log("[stripe][addon-confirm]", {
        userId,
        sessionId,
        addonPackageId,
        imageCredits,
        videoAudioCredits,
        amount,
        currency,
      });

      // 记录支付 (payments 集合)
      if (IS_DOMESTIC_VERSION) {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        
        // 检查是否已处理过
        const existingPayment = await db
          .collection("payments")
          .where({ providerOrderId: sessionId, provider: "stripe" })
          .limit(1)
          .get();
        
        if (!existingPayment?.data?.[0]) {
          await db.collection("payments").add({
            userId,
            provider: "stripe",
            providerOrderId: sessionId,
            amount,
            currency,
            status: "COMPLETED",
            type: "ADDON",
            addonPackageId,
            imageCredits,
            videoAudioCredits,
            createdAt: new Date().toISOString(),
          });
        }

        // 国内版：使用原子操作增加加油包额度
        const addResult = await addAddonCredits(userId, imageCredits, videoAudioCredits);

        if (!addResult.success) {
          console.error("[stripe][addon-credit-error]", addResult.error);
          return NextResponse.json({
            success: true,
            status: "COMPLETED",
            productType: "ADDON",
            addonPackageId,
            imageCredits,
            videoAudioCredits,
            creditError: addResult.error,
          });
        }
      } else if (supabaseAdmin) {
        // 国际版：使用 Supabase 新表结构
        // 检查是否已处理过
        const { data: existingPayment } = await supabaseAdmin
          .from("payments")
          .select("id")
          .eq("provider_order_id", sessionId)
          .eq("provider", "stripe")
          .maybeSingle();

        if (!existingPayment) {
          await supabaseAdmin.from("payments").insert({
            user_id: userId,
            provider: "stripe",
            provider_order_id: sessionId,
            amount,
            currency,
            status: "COMPLETED",
            type: "ADDON",
            addon_package_id: addonPackageId,
            image_credits: imageCredits,
            video_audio_credits: videoAudioCredits,
          });
        }

        // 国际版：使用 Supabase 钱包服务增加加油包额度
        const addResult = await addSupabaseAddonCredits(userId, imageCredits, videoAudioCredits);

        if (!addResult.success) {
          console.error("[stripe][addon-credit-error]", addResult.error);
          return NextResponse.json({
            success: true,
            status: "COMPLETED",
            productType: "ADDON",
            addonPackageId,
            imageCredits,
            videoAudioCredits,
            creditError: addResult.error,
          });
        }
      }

      return NextResponse.json({
        success: true,
        status: "COMPLETED",
        productType: "ADDON",
        addonPackageId,
        imageCredits,
        videoAudioCredits,
        amount,
        currency,
      });
    }

    // ========================================
    // 订阅 (SUBSCRIPTION) 处理分支 (原有逻辑)
    // ========================================
    const plan = normalizePlanName(metadata.planName || "Pro");
    const periodStr = (metadata.billingCycle || "monthly").toLowerCase();
    const period: "monthly" | "annual" =
      periodStr === "annual" || periodStr === "yearly" ? "annual" : "monthly";
    const days = parseInt(metadata.days || "30", 10);

    let effectivePlan = plan;
    let effectivePeriod: "monthly" | "annual" = period;
    let expiresAt = addDays(new Date(), days);
    let isProFlag = effectivePlan.toLowerCase() !== "basic";

    // 国际版：Supabase 新表结构
    if (!IS_DOMESTIC_VERSION && supabaseAdmin && userId) {
      const now = new Date();
      const nowIso = now.toISOString();

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

      // 获取用户当前钱包和订阅信息
      const { data: walletRow } = await supabaseAdmin
        .from("user_wallets")
        .select("*")
        .eq("user_id", userId)
        .single();

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

      const { imageLimit, videoLimit } = getSupabasePlanMediaLimits(plan.toLowerCase());
      const baseDate = isSameActive && currentPlanExp ? currentPlanExp : now;
      let purchaseExpiresAt = addDays(baseDate, days);
      let pendingDowngrade: string | null = null;

      // 记录支付
      await supabaseAdmin.from("payments").insert({
        user_id: userId,
        provider: "stripe",
        provider_order_id: sessionId,
        amount,
        currency,
        status: "COMPLETED",
        type: "SUBSCRIPTION",
      });

      if (isDowngrade) {
        // 降级处理：延迟生效
        const scheduledStart = currentPlanExp && currentPlanActive ? currentPlanExp : now;
        const scheduledExpire = addDays(scheduledStart, days);
        pendingDowngrade = JSON.stringify({
          targetPlan: plan,
          effectiveAt: scheduledStart.toISOString(),
        });

        // 创建待生效订阅
        await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: userId,
            plan,
            period,
            status: "pending",
            provider: "stripe",
            provider_order_id: sessionId,
            started_at: scheduledStart.toISOString(),
            expires_at: scheduledExpire.toISOString(),
            type: "SUBSCRIPTION",
          },
          { onConflict: "user_id" }
        );

        // 更新钱包的 pending_downgrade
        await supabaseAdmin
          .from("user_wallets")
          .update({
            pending_downgrade: pendingDowngrade,
            updated_at: nowIso,
          })
          .eq("user_id", userId);

        effectivePlan = currentPlanKey || plan;
        effectivePeriod = period;
        expiresAt = currentPlanExp || purchaseExpiresAt;
      } else {
        // 新购/续费/升级处理
        await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: userId,
            plan,
            period,
            status: "active",
            provider: "stripe",
            provider_order_id: sessionId,
            started_at: nowIso,
            expires_at: purchaseExpiresAt.toISOString(),
            type: "SUBSCRIPTION",
          },
          { onConflict: "user_id" }
        );

        effectivePlan = plan;
        effectivePeriod = period;
        expiresAt = purchaseExpiresAt;
        isProFlag = plan.toLowerCase() !== "basic" && plan.toLowerCase() !== "free";

        // 更新用户元数据
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            pro: isProFlag,
            plan: effectivePlan,
            plan_exp: expiresAt.toISOString(),
          },
        });

        // 更新钱包订阅信息
        await updateSupabaseSubscription(
          userId,
          effectivePlan,
          expiresAt.toISOString(),
          isProFlag,
          null
        );

        // 处理配额：升级或新购时重置，同级续费不重置
        if (isUpgrade || isNewOrExpired) {
          await upgradeSupabaseMonthlyQuota(userId, imageLimit, videoLimit);
        } else if (isSameActive) {
          await renewSupabaseMonthlyQuota(userId);
        }

        // 确保钱包结构存在
        await seedSupabaseWalletForPlan(userId, plan.toLowerCase(), {
          forceReset: isUpgrade || isNewOrExpired,
        });
      }
    }

    // 国内版：CloudBase
    if (IS_DOMESTIC_VERSION && userId) {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();

      const now = new Date();
      const nowIso = now.toISOString();

      const normalizePlanKey = (p: string) => normalizePlanName(p) || "";

      const purchasePlanLower = plan.toLowerCase();
      const purchasePlanKey = normalizePlanKey(plan);
      const userRes = await db.collection("users").doc(userId).get();
      const userDoc = userRes?.data?.[0] || null;
      const currentPlanLower = (userDoc?.plan || "").toLowerCase();
      const currentPlanKey = normalizePlanKey(userDoc?.plan || "");
      const currentPlanExp = userDoc?.plan_exp ? new Date(userDoc.plan_exp) : null;
      const currentPlanActive = currentPlanExp ? isAfter(currentPlanExp, now) : false;

      const purchaseRank = PLAN_RANK[purchasePlanKey] || 0;
      const currentRank = PLAN_RANK[currentPlanKey] || 0;
      const isUpgrade = purchaseRank > currentRank && currentPlanActive;
      const isDowngrade = purchaseRank < currentRank && currentPlanActive;
      const isSameActive = purchaseRank === currentRank && currentPlanActive;
      const isNewOrExpired = !currentPlanActive || !currentPlanKey;

      const { imageLimit, videoLimit } = getPlanMediaLimits(purchasePlanLower);
      const baseDate = isSameActive && currentPlanExp ? currentPlanExp : now;
      let purchaseExpiresAt = addDays(baseDate, days);
      let pendingDowngrade: { targetPlan: string; effectiveAt?: string } | null = null;

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
        type: "SUBSCRIPTION",
        createdAt: nowIso,
      });

      const subsColl = db.collection("subscriptions");

      if (isDowngrade) {
        const scheduledStart = currentPlanExp && currentPlanActive ? currentPlanExp : now;
        const scheduledExpire = addDays(scheduledStart, days);
        pendingDowngrade = {
          targetPlan: plan,
          effectiveAt: scheduledStart.toISOString(),
        };

        await subsColl.add({
          userId,
          plan,
          period,
          status: "pending",
          provider: "stripe",
          providerOrderId: sessionId,
          startedAt: scheduledStart.toISOString(),
          expiresAt: scheduledExpire.toISOString(),
          updatedAt: nowIso,
          createdAt: nowIso,
          type: "SUBSCRIPTION",
        });

        await db.collection("users").doc(userId).update({
          pendingDowngrade,
          updatedAt: nowIso,
        });

        effectivePlan = currentPlanKey || plan;
        effectivePeriod = period;
        expiresAt = currentPlanExp || purchaseExpiresAt;
      } else {
        const subPayload = {
          userId,
          plan,
          period,
          status: "active",
          provider: "stripe",
          providerOrderId: sessionId,
          startedAt: nowIso,
          expiresAt: purchaseExpiresAt.toISOString(),
          updatedAt: nowIso,
          type: "SUBSCRIPTION",
        };

        const existing = await subsColl
          .where({ userId, provider: "stripe", plan })
          .limit(1)
          .get();

        if (existing?.data?.[0]?._id) {
          await subsColl.doc(existing.data[0]._id).update(subPayload);
        } else {
          await subsColl.add({ ...subPayload, createdAt: nowIso });
        }

        effectivePlan = plan;
        effectivePeriod = period;
        expiresAt = purchaseExpiresAt;

        await db.collection("users").doc(userId).update({
          pro: purchasePlanLower !== "basic",
          plan,
          plan_exp: purchaseExpiresAt.toISOString(),
          subscriptionTier: plan,
          pendingDowngrade: null,
          updatedAt: nowIso,
        });

        if (isUpgrade || isNewOrExpired) {
          await upgradeMonthlyQuota(userId, imageLimit, videoLimit);
        } else if (isSameActive) {
          await renewMonthlyQuota(userId);
        }

        // 确保钱包结构存在，并在升级/新购时覆盖月度额度
        await seedWalletForPlan(userId, purchasePlanLower, {
          forceReset: isUpgrade || isNewOrExpired,
        });
      }
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
