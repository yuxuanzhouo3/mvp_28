export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { addDays, isAfter } from "date-fns";
import { capturePayPalOrder, paypalErrorResponse } from "@/lib/paypal";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { addAddonCredits, upgradeMonthlyQuota, renewMonthlyQuota, getPlanMediaLimits, seedWalletForPlan } from "@/services/wallet";
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
const CYCLE_DAYS: Record<"monthly" | "annual", number> = {
  monthly: 30,
  annual: 365,
};

// 统一套餐名称，兼容中文/英文，返回英文 canonical key
const normalizePlanName = (p?: string) => {
  const lower = (p || "").toLowerCase();
  if (lower === "basic" || lower === "基础版") return "Basic";
  if (lower === "pro" || lower === "专业版") return "Pro";
  if (lower === "enterprise" || lower === "企业版") return "Enterprise";
  return p || "";
};

/**
 * 解析 customId，判断是订阅还是加油包
 *
 * customId 格式:
 * - 订阅(旧格式): userId|planName|billingPeriod|expectedAmount(可选)
 * - 订阅(新格式): userId|planName|billingPeriod|amount|days|isUpgrade
 * - 加油包: userId|ADDON|packageId|imageCredits|videoCredits|expectedAmount(可选)
 */
interface ParsedCustomId {
  userId: string;
  productType: ProductType;
  // 订阅专用
  plan?: string;
  period?: "monthly" | "annual";
  expectedAmount?: number;
  days?: number; // 升级天数折算
  isUpgradeOrder?: boolean; // 是否为升级订单
  // 加油包专用
  addonPackageId?: string;
  imageCredits?: number;
  videoAudioCredits?: number;
}

function parseCustomId(customId?: string | null, description?: string | null): ParsedCustomId {
  const result: ParsedCustomId = {
    userId: "",
    productType: "SUBSCRIPTION",
    plan: "Pro",
    period: "monthly",
  };

  if (!customId) {
    // 从 description 回退解析
    if (description) {
      const parts = description.split(" - ");
      if (parts[0]) result.plan = parts[0];
      if (parts[1]) {
        const p = parts[1].toLowerCase();
        result.period = p === "annual" || p === "yearly" ? "annual" : "monthly";
      }
    }
    return result;
  }

  const parts = customId.split("|");
  result.userId = parts[0] || "";

  // 判断是加油包还是订阅
  if (parts[1] === "ADDON" && parts.length >= 5) {
    // 加油包格式: userId|ADDON|packageId|imageCredits|videoCredits
    result.productType = "ADDON";
    result.addonPackageId = parts[2];
    result.imageCredits = parseInt(parts[3], 10) || 0;
    result.videoAudioCredits = parseInt(parts[4], 10) || 0;
    if (parts[5]) {
      const expected = parseFloat(parts[5]);
      if (!Number.isNaN(expected)) result.expectedAmount = expected;
    }
  } else if (parts.length >= 3) {
    // 订阅格式:
    // 旧格式: userId|planName|billingPeriod|expectedAmount
    // 新格式: userId|planName|billingPeriod|amount|days|isUpgrade
    result.productType = "SUBSCRIPTION";
    result.plan = parts[1] || "Pro";
    const p = (parts[2] || "").toLowerCase();
    result.period = p === "annual" || p === "yearly" ? "annual" : "monthly";

    if (parts[3]) {
      const expected = parseFloat(parts[3]);
      if (!Number.isNaN(expected)) result.expectedAmount = expected;
    }

    // 新格式：解析 days 和 isUpgrade
    if (parts[4]) {
      const days = parseInt(parts[4], 10);
      if (!Number.isNaN(days) && days > 0) result.days = days;
    }
    if (parts[5]) {
      result.isUpgradeOrder = parts[5] === "1";
    }
  }

  // 确保 plan 有值
  if (!result.plan || result.plan.trim() === "") {
    result.plan = "Pro";
  }

  return result;
}

// 保留旧函数以兼容现有代码
function parsePlanPeriod(customId?: string | null, description?: string | null) {
  const parsed = parseCustomId(customId, description);
  return { plan: parsed.plan || "Pro", period: parsed.period || "monthly" };
}

async function upsertCloudbaseSubscription(params: {
  userId: string;
  plan: string;
  period: "monthly" | "annual";
  provider: string;
  providerOrderId: string;
  expiresAt: Date;
  startedAt: Date;
  amount: number;
  currency: string;
  status: string;
}) {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();
  const {
    userId,
    plan,
    period,
    provider,
    providerOrderId,
    expiresAt,
    startedAt,
    amount,
    currency,
    status,
  } = params;

  // subscriptions: update if same user+provider+plan exists, else add
  const subsColl = db.collection("subscriptions");
  const existing = await subsColl
    .where({ userId, provider, plan })
    .limit(1)
    .get();
  const nowIso = new Date().toISOString();
  const subPayload = {
    userId,
    plan,
    period,
    status,
    provider,
    providerOrderId,
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    updatedAt: nowIso,
  };
  if (existing?.data?.[0]?._id) {
    await subsColl.doc(existing.data[0]._id).update(subPayload);
  } else {
    await subsColl.add({ ...subPayload, createdAt: nowIso });
  }

  // payments: always insert
  const payColl = db.collection("payments");
  await payColl.add({
    userId,
    provider,
    providerOrderId,
    amount,
    currency,
    status,
    plan,
    period,
    createdAt: nowIso,
  });

  // return all active subscriptions for ranking
  const all = await subsColl.where({ userId, provider }).get();
  return all?.data || [];
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body as { orderId?: string };
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Missing orderId" },
        { status: 400 },
      );
    }

    const result = await capturePayPalOrder(orderId);
    const unit = result.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    const status = capture?.status || result.status;

    const amountValue = parseFloat(
      capture?.amount?.value ||
        unit?.amount?.value ||
        "0",
    );
    const currency =
      capture?.amount?.currency_code ||
      unit?.amount?.currency_code ||
      "USD";

    const customId = unit?.custom_id || capture?.custom_id || null;
    const description = unit?.description || null;
    
    // 解析 customId，判断是订阅还是加油包
    const parsed = parseCustomId(customId, description);
    const { plan: rawPlan, period } = parsePlanPeriod(customId, description);
    const plan = normalizePlanName(rawPlan);

    const userId =
      parsed.userId ||
      (customId && customId.split("|")[0]) ||
      (capture?.custom_id && capture.custom_id.split("|")[0]) ||
      null;

    // 金额一致性校验：期望金额写入 customId（create 阶段），capture 阶段严格对齐
    if (parsed.expectedAmount != null) {
      const expectedCents = Math.round(parsed.expectedAmount * 100);
      const actualCents = Math.round(amountValue * 100);
      if (expectedCents !== actualCents) {
        console.error("[paypal][amount-mismatch]", {
          orderId,
          expectedAmount: parsed.expectedAmount,
          actualAmount: amountValue,
          currency,
          customId,
        });
        return NextResponse.json(
          {
            success: false,
            error: "Amount mismatch",
            expectedAmount: parsed.expectedAmount,
            actualAmount: amountValue,
            currency,
          },
          { status: 400 },
        );
      }
    }

    // ========================================
    // 加油包 (ADDON) 处理分支
    // 注意：加油包购买不影响用户的 tier 和 expired_at
    // ========================================
    if (parsed.productType === "ADDON" && userId) {
      console.log("[paypal][addon-capture]", {
        userId,
        packageId: parsed.addonPackageId,
        imageCredits: parsed.imageCredits,
        videoAudioCredits: parsed.videoAudioCredits,
        amount: amountValue,
        currency,
        orderId,
      });

      // 记录支付 (payments 集合)
      if (IS_DOMESTIC_VERSION) {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        
        await db.collection("payments").add({
          userId,
          provider: "paypal",
          providerOrderId: orderId,
          amount: amountValue,
          currency,
          status: status || "COMPLETED",
          type: "ADDON",
          addonPackageId: parsed.addonPackageId,
          imageCredits: parsed.imageCredits,
          videoAudioCredits: parsed.videoAudioCredits,
          createdAt: new Date().toISOString(),
        });

        // 国内版：使用原子操作增加加油包额度
        const addResult = await addAddonCredits(
          userId,
          parsed.imageCredits || 0,
          parsed.videoAudioCredits || 0
        );

        if (!addResult.success) {
          console.error("[paypal][addon-credit-error]", addResult.error);
          return NextResponse.json({
            success: true,
            status,
            productType: "ADDON",
            addonPackageId: parsed.addonPackageId,
            imageCredits: parsed.imageCredits,
            videoAudioCredits: parsed.videoAudioCredits,
            creditError: addResult.error,
            raw: result,
          });
        }
      } else if (supabaseAdmin) {
        // 国际版：使用 Supabase 新表结构
        const { data: existingPayment } = await supabaseAdmin
          .from("payments")
          .select("id")
          .eq("provider_order_id", orderId)
          .eq("provider", "paypal")
          .maybeSingle();

        if (!existingPayment) {
          await supabaseAdmin.from("payments").insert({
            user_id: userId,
            provider: "paypal",
            provider_order_id: orderId,
            amount: amountValue,
            currency,
            status: status || "COMPLETED",
            type: "ADDON",
            addon_package_id: parsed.addonPackageId,
            image_credits: parsed.imageCredits,
            video_audio_credits: parsed.videoAudioCredits,
          });

          // 国际版：使用 Supabase 钱包服务增加加油包额度
          const addResult = await addSupabaseAddonCredits(
            userId,
            parsed.imageCredits || 0,
            parsed.videoAudioCredits || 0
          );

          if (!addResult.success) {
            console.error("[paypal][addon-credit-error]", addResult.error);
            return NextResponse.json({
              success: true,
              status,
              productType: "ADDON",
              addonPackageId: parsed.addonPackageId,
              imageCredits: parsed.imageCredits,
              videoAudioCredits: parsed.videoAudioCredits,
              creditError: addResult.error,
              raw: result,
            });
          }
        } else {
          console.log("[paypal][addon-capture] already processed:", {
            orderId,
            userId,
          });
        }
      }

      return NextResponse.json({
        success: true,
        status,
        productType: "ADDON",
        addonPackageId: parsed.addonPackageId,
        imageCredits: parsed.imageCredits,
        videoAudioCredits: parsed.videoAudioCredits,
        raw: result,
      });
    }

    // ========================================
    // 订阅 (SUBSCRIPTION) 处理分支 (原有逻辑)
    // ========================================

  // defaults in case we cannot reach database
  let effectivePlan = plan;
  let effectivePeriod: "monthly" | "annual" = period;
  let expiresAt = period === "annual" ? addDays(new Date(), 365) : addDays(new Date(), 30);
  let isProFlag = effectivePlan.toLowerCase() !== "basic";

  // 国际版：使用 Supabase 新表结构
  if (!IS_DOMESTIC_VERSION && supabaseAdmin && userId) {
    const now = new Date();
    const nowIso = now.toISOString();

    // 幂等：防止重复 capture 导致重复发放权益
    const { data: existingPayment } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("provider_order_id", orderId)
      .eq("provider", "paypal")
      .maybeSingle();
    const skipPaymentInsert = !!existingPayment;

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
    const monthsToAdd = period === "annual" ? 12 : 1;
    const anchorDay =
      walletRow?.billing_cycle_anchor ||
      (walletRow?.monthly_reset_at
        ? getBeijingYMD(new Date(walletRow.monthly_reset_at)).day
        : getBeijingYMD(now).day);

    // 计算到期日期：升级订单使用天数折算，否则使用月度计算
    let purchaseExpiresAt: Date;
    if (parsed.isUpgradeOrder && parsed.days && parsed.days > 0) {
      // 升级订单：使用天数折算
      purchaseExpiresAt = new Date(now.getTime() + parsed.days * 24 * 60 * 60 * 1000);
      console.log(`[PayPal Capture] upgrade with days: ${parsed.days}, expires: ${purchaseExpiresAt.toISOString()}`);
    } else {
      // 普通订单：使用月度计算
      const baseDate = isSameActive && currentPlanExp ? currentPlanExp : now;
      purchaseExpiresAt = addCalendarMonths(baseDate, monthsToAdd, anchorDay);
    }
    let pendingDowngrade: string | null = null;

    // 记录支付
    if (!skipPaymentInsert) {
      await supabaseAdmin.from("payments").insert({
        user_id: userId,
        provider: "paypal",
        provider_order_id: orderId,
        amount: amountValue,
        currency,
        status: status || "COMPLETED",
        type: "SUBSCRIPTION",
      });
    }

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
          provider: "paypal",
          provider_order_id: orderId,
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

      console.log("[PayPal Capture] Downgrade queue updated:", {
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
          provider: "paypal",
          provider_order_id: orderId,
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

  // Domestic版：写入 CloudBase
  if (IS_DOMESTIC_VERSION && userId) {
    const now = new Date();
    const nowIso = now.toISOString();
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();
    const _ = db.command; // CloudBase 命令对象，用于 set/remove 等操作
    const userRes = await db.collection("users").doc(userId).get();
    const userDoc = userRes?.data?.[0] || null;

    const normalizePlanKey = (p: string) => normalizePlanName(p) || "";

    const purchasePlanLower = plan.toLowerCase();
    const purchasePlanKey = normalizePlanKey(plan);
    const currentPlanKey = normalizePlanKey(userDoc?.plan || "");
    const currentPlanExp = userDoc?.plan_exp
      ? new Date(userDoc.plan_exp)
      : null;
    const currentPlanActive = currentPlanExp ? isAfter(currentPlanExp, now) : false;
    const purchaseRank = PLAN_RANK[purchasePlanKey] || 0;
    const currentRank = PLAN_RANK[currentPlanKey] || 0;
    const isUpgrade = purchaseRank > currentRank && currentPlanActive;
    const isDowngrade = purchaseRank < currentRank && currentPlanActive;
    const isSameActive = purchaseRank === currentRank && currentPlanActive;
    const isNewOrExpired = !currentPlanActive || !currentPlanKey;

    const extendDays = CYCLE_DAYS[period] || 30;
    const { imageLimit, videoLimit } = getPlanMediaLimits(purchasePlanLower);
    const baseDate = isSameActive && currentPlanExp ? currentPlanExp : now;
    let purchaseExpiresAt = addDays(baseDate, extendDays);
    let pendingDowngrade: { targetPlan: string; effectiveAt?: string } | null = null;

    // 记录支付
    await db.collection("payments").add({
      userId,
      provider: "paypal",
      providerOrderId: orderId,
      amount: amountValue,
      currency,
      status: status || "COMPLETED",
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
        provider: "paypal",
        providerOrderId: orderId,
        startedAt: tempStart.toISOString(),
        expiresAt: addDays(tempStart, extendDays).toISOString(),
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

      console.log("[PayPal Capture] Downgrade queue updated:", {
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
        provider: "paypal",
        providerOrderId: orderId,
        startedAt: nowIso,
        expiresAt: purchaseExpiresAt.toISOString(),
        updatedAt: nowIso,
        type: "SUBSCRIPTION",
      };

      const existing = await subsColl
        .where({ userId, provider: "paypal", plan })
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

      await seedWalletForPlan(userId, purchasePlanLower, {
        forceReset: isUpgrade || isNewOrExpired,
      });
    }
  }

    return NextResponse.json({
      success: true,
      status,
      plan: effectivePlan,
      period: effectivePeriod,
      expiresAt: expiresAt.toISOString(),
      raw: result,
    });
  } catch (err) {
    return paypalErrorResponse(err);
  }
}
