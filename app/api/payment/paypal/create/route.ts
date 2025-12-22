import { NextRequest, NextResponse } from "next/server";
import { createPayPalOrder, paypalErrorResponse } from "@/lib/paypal";
import { pricingPlans, type PricingPlan } from "@/constants/pricing";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { isAfter } from "date-fns";
import { calculateUpgradePrice } from "@/services/wallet";
import { calculateSupabaseUpgradePrice } from "@/services/wallet-supabase";
import {
  getAddonPackageById,
  getAddonDescription,
  type ProductType,
} from "@/constants/addon-packages";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PLAN_RANK: Record<string, number> = { Basic: 1, Pro: 2, Enterprise: 3 };

// 统一套餐名称，兼容中文/英文，返回英文 canonical key
const normalizePlanName = (p?: string) => {
  const lower = (p || "").toLowerCase();
  if (lower === "basic" || lower === "基础版") return "Basic";
  if (lower === "pro" || lower === "专业版") return "Pro";
  if (lower === "enterprise" || lower === "企业版") return "Enterprise";
  return p || "";
};

const extractPlanAmount = (
  plan: PricingPlan,
  period: "monthly" | "annual",
  useDomesticPrice: boolean
) => {
  const priceLabel =
    period === "annual"
      ? useDomesticPrice
        ? plan.annualPriceZh || plan.annualPrice
        : plan.annualPrice
      : useDomesticPrice
        ? plan.priceZh || plan.price
        : plan.price;
  const numeric = parseFloat(priceLabel.replace(/[^0-9.]/g, "") || "0");
  return period === "annual" ? numeric * 12 : numeric;
};

// 根据英文/中文名称解析套餐，始终返回英文 name 作为 canonical key
function resolvePlan(planName?: string) {
  if (!planName) return pricingPlans[1]; // 默认 Pro
  const lower = planName.toLowerCase();
  const found = pricingPlans.find(
    (p) =>
      p.name.toLowerCase() === lower ||
      (p.nameZh && p.nameZh.toLowerCase() === lower),
  );
  return found || pricingPlans[1];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
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

    // 尝试从登录态获取 userId（优先 cookie/header，再回退 body 传入）
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      if (IS_DOMESTIC_VERSION) {
        const token =
          request.cookies.get("auth-token")?.value ||
          request.headers.get("x-auth-token") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
          null;
        if (token) {
          const auth = new CloudBaseAuthService();
          const user = await auth.validateToken(token);
          if (user?.id) resolvedUserId = user.id;
        }
      } else {
        const supabase = await createClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) resolvedUserId = data.user.id;
      }
    }
    if (!resolvedUserId) {
      return NextResponse.json(
        { success: false, error: "Missing userId (login required)" },
        { status: 401 },
      );
    }

    // Build base URL with priority: env -> forwarded host -> request origin
    const envBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    const proto =
      request.headers.get("x-forwarded-proto") ||
      request.headers.get("x-forwarded-protocol") ||
      "https";
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const headerBase = host ? `${proto}://${host}` : null;
    const origin = envBase || headerBase || request.nextUrl.origin;

    const returnUrl = `${origin}/payment/paypal/success`;
    const cancelUrl = `${origin}/payment/paypal/cancel`;

    // ========================================
    // 分支处理：加油包 (ADDON) vs 订阅 (SUBSCRIPTION)
    // ========================================
    let amount: number;
    let customId: string;
    let description: string;
    let currency: string;

    if (productType === "ADDON" && addonPackageId) {
      // === 加油包购买 ===
      const addonPkg = getAddonPackageById(addonPackageId);
      if (!addonPkg) {
        return NextResponse.json(
          { success: false, error: `Invalid addon package: ${addonPackageId}` },
          { status: 400 },
        );
      }

      // PayPal 默认用美元（CNY 可能不被支持）
      amount = addonPkg.price;
      currency = "USD";
      
      // customId 格式: userId|ADDON|packageId|imageCredits|videoCredits
      // 加油包购买后直接增加永久额度，不影响订阅等级和过期时间
      customId = [
        resolvedUserId,
        "ADDON",
        addonPkg.id,
        addonPkg.imageCredits,
        addonPkg.videoAudioCredits,
        amount.toFixed(2),
      ].join("|");
      
      description = getAddonDescription(addonPkg, IS_DOMESTIC_VERSION);
    } else {
      // === 订阅购买 (原有逻辑) ===
      const resolvedPlan = resolvePlan(planName);
      const effectiveBillingPeriod = billingPeriod || "monthly";
      const useDomesticPrice = false; // PayPal 始终按美元价格

      // Annual UI 显示"每月折后价"，实际一次性收取 12 个月
      const baseAmount = extractPlanAmount(
        resolvedPlan,
        effectiveBillingPeriod,
        useDomesticPrice
      );
      amount = baseAmount;

      // 国内版升级：差价计算 (目标套餐日价 - 当前套餐日价) × 剩余天数
      if (IS_DOMESTIC_VERSION) {
        try {
          const connector = new CloudBaseConnector();
          await connector.initialize();
          const db = connector.getClient();
          const userRes = await db.collection("users").doc(resolvedUserId).get();
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
            // 使用月度价格计算日价（美元）
            const currentPlanMonthlyPrice = extractPlanAmount(currentPlanDef, "monthly", useDomesticPrice);
            const targetPlanMonthlyPrice = extractPlanAmount(resolvedPlan, "monthly", useDomesticPrice);

            // 计算升级差价：按日价差乘以剩余天数
            amount = calculateUpgradePrice(
              currentPlanMonthlyPrice / 30,  // 当前套餐日价
              targetPlanMonthlyPrice / 30,   // 目标套餐日价
              remainingDays                   // 剩余天数
            );

            console.log("📝 [PayPal Create] Domestic upgrade calculation:", {
              currentPlan: currentPlanKey,
              targetPlan: resolvedPlan.name,
              currentPlanMonthlyPrice,
              targetPlanMonthlyPrice,
              remainingDays,
              upgradeAmount: amount,
            });
          }
        } catch (error) {
          console.error("[paypal][create] upgrade price calc failed", error);
          amount = baseAmount;
        }
      }

      // 国际版升级：完整升级补差价逻辑（与国内版一致）
      // 1. 如果剩余价值 >= 目标套餐价格：免费升级，剩余价值折算成目标套餐天数
      // 2. 如果剩余价值 < 目标套餐价格：补差价，获得目标套餐天数
      let days = 0;
      let isUpgradeOrder = false;

      if (!IS_DOMESTIC_VERSION && supabaseAdmin) {
        try {
          const { data: walletRow } = await supabaseAdmin
            .from("user_wallets")
            .select("plan, plan_exp")
            .eq("user_id", resolvedUserId)
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

            console.log("📝 [PayPal Create] International upgrade calculation:", {
              currentPlan: currentPlanKey,
              targetPlan: resolvedPlan.name,
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
          console.error("[paypal][create] supabase upgrade price calc failed", error);
          amount = baseAmount;
        }
      }

      // 只有在非升级情况下才设置默认天数
      if (days === 0) {
        days = effectiveBillingPeriod === "annual" ? 365 : 30;
      }

      currency = "USD";

      // customId 格式: userId|planName|billingPeriod|amount|days|isUpgrade (扩展格式支持升级)
      customId = [resolvedUserId, resolvedPlan.name, effectiveBillingPeriod, amount.toFixed(2), days, isUpgradeOrder ? "1" : "0"].join("|");
      description = `${resolvedPlan.name} - ${effectiveBillingPeriod}`;
    }

    const order = await createPayPalOrder({
      amount,
      currency,
      returnUrl,
      cancelUrl,
      userId: resolvedUserId,
      customId,
      description,
    });

    if (!order.approvalUrl) {
      return NextResponse.json(
        { success: false, error: "No PayPal approval URL returned" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      orderId: order.orderId,
      approvalUrl: order.approvalUrl,
    });
  } catch (err) {
    return paypalErrorResponse(err);
  }
}
