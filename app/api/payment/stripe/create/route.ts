export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { createStripeCheckoutSession, stripeErrorResponse } from "@/lib/stripe";
import { pricingPlans, type PricingPlan } from "@/constants/pricing";
import { IS_DOMESTIC_VERSION } from "@/config";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAddonPackageById, getAddonDescription, type ProductType } from "@/constants/addon-packages";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { isAfter } from "date-fns";
import { calculateUpgradePrice } from "@/services/wallet";
import { calculateSupabaseUpgradePrice } from "@/services/wallet-supabase";
import { PLAN_RANK, normalizePlanName } from "@/utils/plan-utils";
import { extractPlanAmount, resolvePlan } from "@/lib/payment/plan-resolver";
import { resolveUserId } from "@/lib/payment/auth-resolver";
import { handleAddonPurchase, isAddonPurchase } from "@/lib/payment/addon-handler";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let {
      planName,
      billingPeriod,
      userId,
      // 新增：支持加油包购买
      productType = "SUBSCRIPTION",
      addonPackageId,
    } = body as {
      planName?: string;
      billingPeriod?: "monthly" | "annual";
      userId?: string;
      productType?: ProductType;
      addonPackageId?: string;
    };

    // 如果前端未传 userId，尝试从会话自动获取
    if (!userId) {
      userId = await resolveUserId(request) || undefined;
    }

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

    // ========================================
    // 分支处理：加油包 (ADDON) vs 订阅 (SUBSCRIPTION)
    // ========================================
    let amount: number;
    let customId: string;
    let description: string;
    let metadata: Record<string, string>;
    let effectiveBillingPeriod: "monthly" | "annual" | undefined = billingPeriod;
    let resolvedPlanName: string | undefined = planName;

    if (productType === "ADDON" && addonPackageId) {
      // === 加油包购买 ===
      const addonPkg = getAddonPackageById(addonPackageId);
      if (!addonPkg) {
        return NextResponse.json(
          { success: false, error: `Invalid addon package: ${addonPackageId}` },
          { status: 400 },
        );
      }

      // 金额：国内用人民币价，国际用美元价
      amount = IS_DOMESTIC_VERSION ? addonPkg.priceZh : addonPkg.price;
      
      // customId 格式: userId|ADDON|packageId|imageCredits|videoCredits
      customId = [
        userId || "anon",
        "ADDON",
        addonPkg.id,
        addonPkg.imageCredits,
        addonPkg.videoAudioCredits,
      ].join("|");
      
      description = getAddonDescription(addonPkg, IS_DOMESTIC_VERSION);
      
      // Stripe metadata - 用于回调处理
      metadata = {
        userId: userId || "",
        customId,
        productType: "ADDON",
        addonPackageId: addonPkg.id,
        imageCredits: String(addonPkg.imageCredits),
        videoAudioCredits: String(addonPkg.videoAudioCredits),
        paymentType: "onetime",
      };
    } else {
      // === 订阅购买 (原有逻辑) ===
      const resolvedPlan = resolvePlan(planName);
      effectiveBillingPeriod = billingPeriod || "monthly";
      resolvedPlanName = resolvedPlan.name;
      const useDomesticPrice = IS_DOMESTIC_VERSION;

      // 基础金额（国内：人民币，国际：美元）
      const baseAmount = extractPlanAmount(
        resolvedPlan,
        effectiveBillingPeriod,
        useDomesticPrice
      );
      amount = baseAmount;

      // 国内版：升级补差价公式 (目标套餐日价 - 当前套餐日价) × 剩余天数
      if (IS_DOMESTIC_VERSION && userId) {
        try {
          const connector = new CloudBaseConnector();
          await connector.initialize();
          const db = connector.getClient();
          const userRes = await db.collection("users").doc(userId).get();
          const userDoc = userRes?.data?.[0] || null;

          const currentPlanKey = normalizePlanName(
            userDoc?.plan || userDoc?.subscriptionTier || ""
          );
          const currentPlanExp = userDoc?.plan_exp
            ? new Date(userDoc.plan_exp)
            : null;
          const now = new Date();
          const currentActive = currentPlanExp
            ? isAfter(currentPlanExp, now)
            : false;
          const purchaseRank = PLAN_RANK[normalizePlanName(resolvedPlan.name)] || 0;
          const currentRank = PLAN_RANK[currentPlanKey] || 0;
          const isUpgrade = currentActive && purchaseRank > currentRank;

          if (isUpgrade && currentPlanKey) {
            const remainingDays = Math.max(
              0,
              Math.ceil(
                ((currentPlanExp?.getTime() || 0) - now.getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            );
            const currentPlanDef = resolvePlan(currentPlanKey);
            // 使用月度价格计算日价
            const currentPlanMonthlyPrice = extractPlanAmount(currentPlanDef, "monthly", true);
            const targetPlanMonthlyPrice = extractPlanAmount(resolvedPlan, "monthly", true);

            // 计算升级差价：按日价差乘以剩余天数
            amount = calculateUpgradePrice(
              currentPlanMonthlyPrice / 30,  // 当前套餐日价
              targetPlanMonthlyPrice / 30,   // 目标套餐日价
              remainingDays                   // 剩余天数
            );

            console.log("📝 [Stripe Create] Domestic upgrade calculation:", {
              currentPlan: currentPlanKey,
              targetPlan: resolvedPlanName,
              currentPlanMonthlyPrice,
              targetPlanMonthlyPrice,
              remainingDays,
              upgradeAmount: amount,
            });
          }
        } catch (error) {
          console.error("[stripe][create] upgrade price calc failed", error);
          amount = baseAmount;
        }
      }

      // 国际版：升级补差价逻辑（与国内版一致）
      // 1. 如果剩余价值 >= 目标套餐价格：免费升级，剩余价值折算成目标套餐天数
      // 2. 如果剩余价值 < 目标套餐价格：补差价，获得目标套餐天数
      let days = 0;
      let isUpgradeOrder = false;

      if (!IS_DOMESTIC_VERSION && userId && supabaseAdmin) {
        try {
          const { data: walletRow } = await supabaseAdmin
            .from("user_wallets")
            .select("plan, plan_exp")
            .eq("user_id", userId)
            .maybeSingle();

          const currentPlanKey = normalizePlanName(walletRow?.plan || "");
          const currentPlanExp = walletRow?.plan_exp ? new Date(walletRow.plan_exp) : null;
          const now = new Date();
          const currentActive = currentPlanExp ? isAfter(currentPlanExp, now) : false;
          const purchaseRank = PLAN_RANK[normalizePlanName(resolvedPlan.name)] || 0;
          const currentRank = PLAN_RANK[currentPlanKey] || 0;
          const isUpgrade = currentActive && purchaseRank > currentRank && currentRank > 0;

          if (isUpgrade && currentPlanKey) {
            isUpgradeOrder = true;
            const remainingDays = Math.max(
              0,
              Math.ceil(((currentPlanExp?.getTime() || 0) - now.getTime()) / (1000 * 60 * 60 * 24))
            );
            const currentPlanDef = resolvePlan(currentPlanKey);
            // 使用月度价格计算日价（美元）
            const currentPlanMonthlyPrice = extractPlanAmount(currentPlanDef, "monthly", false);
            const targetPlanMonthlyPrice = extractPlanAmount(resolvedPlan, "monthly", false);
            // 目标套餐价格：根据用户选择的计费周期（月费或年费总价）
            const targetPrice = extractPlanAmount(resolvedPlan, effectiveBillingPeriod, false);
            const currentDailyPrice = currentPlanMonthlyPrice / 30;
            const targetDailyPrice = targetPlanMonthlyPrice / 30;

            // 计算当前套餐剩余价值
            const remainingValue = remainingDays * currentDailyPrice;

            // 目标套餐天数
            const targetDays = effectiveBillingPeriod === "annual" ? 365 : 30;

            // 升级逻辑：
            // 1. 如果剩余价值 >= 目标套餐价格：免费升级，折算天数
            // 2. 如果剩余价值 < 目标套餐价格：补差价，获得目标套餐天数
            const freeUpgrade = remainingValue >= targetPrice;

            if (freeUpgrade) {
              // 免费升级：剩余价值全部折算成目标套餐天数
              amount = 0.01; // 最低支付金额
              days = Math.floor(remainingValue / targetDailyPrice);
            } else {
              // 补差价：支付差额，获得目标套餐天数
              amount = Math.max(0.01, targetPrice - remainingValue);
              days = targetDays;
            }

            amount = Math.round(amount * 100) / 100;

            console.log("📝 [Stripe Create] International upgrade calculation:", {
              currentPlan: currentPlanKey,
              targetPlan: resolvedPlanName,
              billingPeriod: effectiveBillingPeriod,
              currentPlanMonthlyPrice,
              targetPrice,
              remainingDays,
              remainingValue: Math.round(remainingValue * 100) / 100,
              freeUpgrade,
              upgradeAmount: amount,
              newPlanDays: days,
            });
          }
        } catch (error) {
          console.error("[stripe][create] supabase upgrade price calc failed", error);
          amount = baseAmount;
        }
      }

      // 只有在非升级情况下才设置默认天数
      if (days === 0) {
        days = effectiveBillingPeriod === "annual" ? 365 : 30;
      }

      customId = [userId || "anon", resolvedPlan.name, effectiveBillingPeriod].join("|");
      description = `${resolvedPlan.name} - ${effectiveBillingPeriod === "annual" ? "Annual" : "Monthly"}`;

      metadata = {
        userId: userId || "",
        customId,
        productType: "SUBSCRIPTION",
        paymentType: "onetime",
        billingCycle: effectiveBillingPeriod,
        planName: resolvedPlan.name, // 始终使用英文 key，避免中文命中失败
        days: String(days),
        isUpgrade: isUpgradeOrder ? "true" : "false",
        originalAmount: String(baseAmount),
      };
    }

    // 创建 Stripe Checkout Session
    const { sessionId, url } = await createStripeCheckoutSession({
      amount,
      currency: IS_DOMESTIC_VERSION ? "CNY" : "USD",
      successUrl,
      cancelUrl,
      userId,
      customId,
      description,
      billingCycle: effectiveBillingPeriod,
      planName: productType === "ADDON" ? undefined : resolvedPlanName,
      // 传递额外的 metadata
      ...(productType === "ADDON" ? {
        addonPackageId,
        imageCredits: metadata.imageCredits,
        videoAudioCredits: metadata.videoAudioCredits,
      } : {}),
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
