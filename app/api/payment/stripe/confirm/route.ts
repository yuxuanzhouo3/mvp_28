import { NextRequest, NextResponse } from "next/server";
import { retrieveStripeSession, stripeErrorResponse } from "@/lib/stripe";
import { addDays, isAfter } from "date-fns";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { addAddonCredits, upgradeMonthlyQuota, renewMonthlyQuota, seedWalletForPlan, getPlanMediaLimits } from "@/services/wallet";
import {
  addSupabaseAddonCredits,
  addCalendarMonths,
  getBeijingYMD,
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
    // 用户ID：优先 invoice/metadata，其次 subscription/metadata 回落
    const userId = metadata.userId || (session.subscription as any)?.metadata?.userId || null;
    const amount = (session.amount_total || 0) / 100;
    const currency = session.currency?.toUpperCase() || "USD";

    // 金额一致性校验：期望金额写入 Stripe metadata（create 阶段），confirm 阶段严格对齐
    const expectedCentsStr =
      metadata.expectedAmountCents ||
      (metadata as any).expected_amount_cents ||
      (metadata as any).expected_amount ||
      null;
    const expectedAmountStr = metadata.expectedAmount || (metadata as any).expected_amount || null;
    const actualCents = session.amount_total || 0;

    if (expectedCentsStr != null) {
      const expectedCents = parseInt(String(expectedCentsStr), 10);
      if (!Number.isNaN(expectedCents) && expectedCents !== actualCents) {
        console.error("[stripe][amount-mismatch]", {
          sessionId,
          userId,
          expectedCents,
          actualCents,
          currency,
          productType,
          metadata,
        });
        return NextResponse.json(
          {
            success: false,
            error: "Amount mismatch",
            expectedAmount: expectedCents / 100,
            actualAmount: amount,
            currency,
          },
          { status: 400 }
        );
      }
    } else if (expectedAmountStr != null) {
      const expected = parseFloat(String(expectedAmountStr));
      const expectedCents = Math.round(expected * 100);
      if (!Number.isNaN(expected) && expectedCents !== actualCents) {
        console.error("[stripe][amount-mismatch]", {
          sessionId,
          userId,
          expectedCents,
          actualCents,
          currency,
          productType,
          metadata,
        });
        return NextResponse.json(
          {
            success: false,
            error: "Amount mismatch",
            expectedAmount: expected,
            actualAmount: amount,
            currency,
          },
          { status: 400 }
        );
      }
    }

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
        const existingPaymentRes = await db
          .collection("payments")
          .where({ providerOrderId: sessionId, provider: "stripe" })
          .limit(1)
          .get();
        const existingPayment = existingPaymentRes?.data?.[0] || null;
        
        if (existingPayment) {
          return NextResponse.json({
            success: true,
            status: "already_processed",
            productType: "ADDON",
            addonPackageId,
            imageCredits,
            videoAudioCredits,
            amount,
            currency,
          });
        }

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

        if (existingPayment) {
          return NextResponse.json({
            success: true,
            status: "already_processed",
            productType: "ADDON",
            addonPackageId,
            imageCredits,
            videoAudioCredits,
            amount,
            currency,
          });
        }

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
      const monthsToAdd = period === "annual" ? 12 : 1;
      const anchorDay =
        walletRow?.billing_cycle_anchor ||
        (walletRow?.monthly_reset_at
          ? getBeijingYMD(new Date(walletRow.monthly_reset_at)).day
          : getBeijingYMD(now).day);
      let purchaseExpiresAt = addCalendarMonths(baseDate, monthsToAdd, anchorDay);
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
        // 降级处理：延迟生效（支持多重降级队列，按等级排序：高级先生效）
        // 1. 查询用户所有待生效的 pending 订阅
        const { data: existingPendingSubs } = await supabaseAdmin
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "pending");

        // 2. 创建新的 pending 订阅记录（先用临时时间，后面会重新计算）
        const tempStart = currentPlanExp && currentPlanActive ? currentPlanExp : now;
        const { data: newSubData } = await supabaseAdmin
          .from("subscriptions")
          .insert({
            user_id: userId,
            plan,
            period,
            status: "pending",
            provider: "stripe",
            provider_order_id: sessionId,
            started_at: tempStart.toISOString(),
            expires_at: addCalendarMonths(tempStart, monthsToAdd, anchorDay).toISOString(),
            type: "SUBSCRIPTION",
          })
          .select("id")
          .single();

        // 3. 将所有 pending 订阅（包括新的）按等级降序排列，同等级按创建时间升序
        const allPendingSubs = [
          ...(existingPendingSubs || []).map((s: any) => ({
            id: s.id,
            plan: normalizePlanName(s.plan),
            period: s.period,
            rank: PLAN_RANK[normalizePlanName(s.plan)] || 0,
            createdAt: s.created_at || nowIso, // 用于同等级排序
          })),
          {
            id: newSubData?.id,
            plan,
            period,
            rank: purchaseRank,
            createdAt: nowIso, // 新订阅的创建时间
          },
        ].sort((a, b) => {
          // 先按等级降序（高级先生效）
          if (b.rank !== a.rank) return b.rank - a.rank;
          // 同等级按创建时间升序（先买的先生效）
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        // 4. 重新计算每个订阅的 startedAt 和 expiresAt
        let nextStartDate = currentPlanExp && currentPlanActive ? currentPlanExp : now;
        const updatedQueue: { targetPlan: string; effectiveAt: string; expiresAt: string }[] = [];

        for (const pendingSub of allPendingSubs) {
          const subPeriod = pendingSub.period === "annual" ? 12 : 1;
          const subExpires = addCalendarMonths(nextStartDate, subPeriod, anchorDay);

          // 更新订阅记录的时间
          if (pendingSub.id) {
            await supabaseAdmin
              .from("subscriptions")
              .update({
                started_at: nextStartDate.toISOString(),
                expires_at: subExpires.toISOString(),
                updated_at: nowIso,
              })
              .eq("id", pendingSub.id);
          }

          updatedQueue.push({
            targetPlan: pendingSub.plan,
            effectiveAt: nextStartDate.toISOString(),
            expiresAt: subExpires.toISOString(),
          });

          // 下一个订阅从这个订阅到期后开始
          nextStartDate = subExpires;
        }

        // 5. 更新用户的 pendingDowngrade 为数组（按生效顺序）
        pendingDowngrade = updatedQueue.length > 0 ? JSON.stringify(updatedQueue) : null;
        await supabaseAdmin
          .from("user_wallets")
          .update({
            pending_downgrade: pendingDowngrade,
            updated_at: nowIso,
          })
          .eq("user_id", userId);

        console.log("[Stripe Confirm] Downgrade queue updated:", {
          userId,
          newPlan: plan,
          queue: updatedQueue,
        });

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
      const _ = db.command; // CloudBase 命令对象，用于 set/remove 等操作

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

      // 降级：延期生效（支持多重降级队列，按等级排序：高级先生效）
      if (isDowngrade) {
        // 1. 查询用户所有待生效的 pending 订阅
        const pendingSubsRes = await subsColl
          .where({ userId, status: "pending" })
          .get();
        const existingPendingSubs = (pendingSubsRes?.data || []) as any[];

        // 2. 创建新的 pending 订阅记录（先用临时时间，后面会重新计算）
        const tempStart = currentPlanExp && currentPlanActive ? currentPlanExp : now;
        const newPendingSub = {
          userId,
          plan,
          period,
          status: "pending",
          provider: "stripe",
          providerOrderId: sessionId,
          startedAt: tempStart.toISOString(),
          expiresAt: addDays(tempStart, days).toISOString(),
          updatedAt: nowIso,
          createdAt: nowIso,
          type: "SUBSCRIPTION",
        };

        // 添加新订阅到数据库
        const addResult = await subsColl.add(newPendingSub);
        const newSubId = addResult?.id;

        // 3. 将所有 pending 订阅（包括新的）按等级降序排列，同等级按创建时间升序
        const allPendingSubs = [
          ...existingPendingSubs.map((s: any) => ({
            _id: s._id,
            plan: normalizePlanKey(s.plan),
            period: s.period,
            rank: PLAN_RANK[normalizePlanKey(s.plan)] || 0,
            createdAt: s.createdAt || s.created_at || nowIso, // 用于同等级排序
          })),
          {
            _id: newSubId,
            plan,
            period,
            rank: purchaseRank,
            createdAt: nowIso, // 新订阅的创建时间
          },
        ].sort((a, b) => {
          // 先按等级降序（高级先生效）
          if (b.rank !== a.rank) return b.rank - a.rank;
          // 同等级按创建时间升序（先买的先生效）
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        // 4. 重新计算每个订阅的 startedAt 和 expiresAt
        let nextStartDate = currentPlanExp && currentPlanActive ? currentPlanExp : now;
        const updatedQueue: { targetPlan: string; effectiveAt: string; expiresAt: string }[] = [];

        for (const pendingSub of allPendingSubs) {
          const subDays = pendingSub.period === "annual" ? 365 : 30;
          const subExpires = addDays(nextStartDate, subDays);

          // 更新订阅记录的时间
          if (pendingSub._id) {
            await subsColl.doc(pendingSub._id).update({
              startedAt: nextStartDate.toISOString(),
              expiresAt: subExpires.toISOString(),
              updatedAt: nowIso,
            });
          }

          updatedQueue.push({
            targetPlan: pendingSub.plan,
            effectiveAt: nextStartDate.toISOString(),
            expiresAt: subExpires.toISOString(),
          });

          // 下一个订阅从这个订阅到期后开始
          nextStartDate = subExpires;
        }

        // 5. 更新用户的 pendingDowngrade 为数组（按生效顺序）
        await db.collection("users").doc(userId).update({
          pendingDowngrade: _.set(updatedQueue.length > 0 ? updatedQueue : null),
          updatedAt: nowIso,
        });

        console.log("[Stripe Confirm] Downgrade queue updated:", {
          userId,
          newPlan: plan,
          queue: updatedQueue,
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
          pendingDowngrade: _.set(null),
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
