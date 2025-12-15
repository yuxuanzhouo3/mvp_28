import { NextRequest, NextResponse } from "next/server";
import { addDays, isAfter } from "date-fns";
import { capturePayPalOrder, paypalErrorResponse } from "@/lib/paypal";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { addAddonCredits, upgradeMonthlyQuota, renewMonthlyQuota, getPlanMediaLimits, seedWalletForPlan } from "@/services/wallet";
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
 * - 订阅: userId|planName|billingPeriod
 * - 加油包: userId|ADDON|packageId|imageCredits|videoCredits
 */
interface ParsedCustomId {
  userId: string;
  productType: ProductType;
  // 订阅专用
  plan?: string;
  period?: "monthly" | "annual";
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
  } else if (parts.length >= 3) {
    // 订阅格式: userId|planName|billingPeriod
    result.productType = "SUBSCRIPTION";
    result.plan = parts[1] || "Pro";
    const p = (parts[2] || "").toLowerCase();
    result.period = p === "annual" || p === "yearly" ? "annual" : "monthly";
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
    const extendDays = CYCLE_DAYS[period] || 30;
    const baseDate = isSameActive && currentPlanExp ? currentPlanExp : now;
    let purchaseExpiresAt = addDays(baseDate, extendDays);
    let pendingDowngrade: string | null = null;

    // 记录支付
    await supabaseAdmin.from("payments").insert({
      user_id: userId,
      provider: "paypal",
      provider_order_id: orderId,
      amount: amountValue,
      currency,
      status: status || "COMPLETED",
      type: "SUBSCRIPTION",
    });

    if (isDowngrade) {
      // 降级处理：延迟生效
      const scheduledStart = currentPlanExp && currentPlanActive ? currentPlanExp : now;
      const scheduledExpire = addDays(scheduledStart, extendDays);
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
          provider: "paypal",
          provider_order_id: orderId,
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

    if (isDowngrade) {
      const scheduledStart = currentPlanExp && currentPlanActive ? currentPlanExp : now;
      const scheduledExpire = addDays(scheduledStart, extendDays);
      pendingDowngrade = {
        targetPlan: plan,
        effectiveAt: scheduledStart.toISOString(),
      };

      await subsColl.add({
        userId,
        plan,
        period,
        status: "pending",
        provider: "paypal",
        providerOrderId: orderId,
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
        pendingDowngrade: null,
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
