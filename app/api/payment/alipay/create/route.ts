// app/api/payment/alipay/create/route.ts - 支付宝支付创建API（国内版专用）
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { AlipayProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/alipay-provider";
import { pricingPlans, type PricingPlan } from "@/constants/pricing";
import { ADDON_PACKAGES, getAddonPackageById, getAddonDescription, type ProductType } from "@/constants/addon-packages";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { cookies } from "next/headers";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { isAfter } from "date-fns";

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
      (p.nameZh && p.nameZh.toLowerCase() === lower)
  );
  return found || pricingPlans[1];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { planName, billingPeriod, userId, productType, addonPackageId } = body as {
      planName?: string;
      billingPeriod?: "monthly" | "annual";
      userId?: string;
      productType?: ProductType;
      addonPackageId?: string;
    };

    // 如果前端未传 userId，尝试从会话自动获取（国内版使用 CloudBase）
    if (!userId) {
      const cookieStore = await cookies();
      const token = cookieStore.get("auth-token")?.value;
      if (token) {
        const auth = new CloudBaseAuthService();
        const user = await auth.validateToken(token);
        if (user?.id) {
          userId = user.id;
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "用户未登录" },
        { status: 401 }
      );
    }

    // 判断是加油包还是订阅
    const isAddon = productType === "ADDON" || (addonPackageId && addonPackageId.startsWith("addon_"));

    let amount = 0;
    let description = "";
    let days = 0;
    let metadata: Record<string, any> = {};

    if (isAddon && addonPackageId) {
      // 加油包购买
      const addonPackage = getAddonPackageById(addonPackageId);
      if (!addonPackage) {
        return NextResponse.json(
          { success: false, error: "无效的加油包ID" },
          { status: 400 }
        );
      }

      amount = addonPackage.priceZh; // 国内版使用人民币价格
      description = getAddonDescription(addonPackage, true);
      metadata = {
        userId,
        productType: "ADDON",
        addonPackageId: addonPackage.id,
        imageCredits: addonPackage.imageCredits,
        videoAudioCredits: addonPackage.videoAudioCredits,
      };

      console.log("📝 [Alipay Create] Creating addon payment:", {
        userId,
        addonPackageId,
        amount,
        imageCredits: addonPackage.imageCredits,
        videoAudioCredits: addonPackage.videoAudioCredits,
      });
    } else {
      // 订阅套餐购买
      const resolvedPlan = resolvePlan(planName);
      const effectiveBillingPeriod = billingPeriod || "monthly";
      const resolvedPlanName = resolvedPlan.name;

      const baseAmount = extractPlanAmount(resolvedPlan, effectiveBillingPeriod, true);
      amount = baseAmount;

      // 升级折算逻辑（国内版专用）
      if (userId) {
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
          const currentActive = currentPlanExp ? isAfter(currentPlanExp, now) : false;
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
            // 目标套餐价格：根据用户选择的计费周期（月费或年费总价）
            const targetPrice = extractPlanAmount(resolvedPlan, effectiveBillingPeriod, true);
            const currentDailyPrice = currentPlanMonthlyPrice / 30;
            const targetDailyPrice = targetPlanMonthlyPrice / 30;

            // 计算当前套餐剩余价值
            const remainingValue = remainingDays * currentDailyPrice;

            // 目标套餐天数
            const targetDays = effectiveBillingPeriod === "annual" ? 365 : 30;

            // 新升级逻辑：
            // 1. 如果剩余价值 ≥ 目标套餐价格：免费升级，折算天数
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

            console.log("📝 [Alipay Create] Upgrade calculation:", {
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
          console.error("[alipay][create] upgrade price calc failed", error);
          amount = baseAmount;
        }
      }
      // 只有在非升级情况下才设置默认天数
      if (days === 0) {
        days = effectiveBillingPeriod === "annual" ? 365 : 30;
      }
      description = `${resolvedPlan.nameZh || resolvedPlan.name} - ${effectiveBillingPeriod === "annual" ? "年度订阅" : "月度订阅"}`;
      metadata = {
        userId,
        days,
        productType: "SUBSCRIPTION",
        paymentType: "onetime",
        billingCycle: effectiveBillingPeriod,
        planName: resolvedPlanName,
        isUpgrade: amount !== baseAmount, // 标记是否为升级订单
        originalAmount: baseAmount,       // 原始金额（用于记录）
      };

      console.log("📝 [Alipay Create] Creating subscription payment:", {
        userId,
        planName: resolvedPlanName,
        billingPeriod: effectiveBillingPeriod,
        amount,
        days,
        isUpgrade: amount !== baseAmount,
      });
    }

    // 创建支付订单数据
    const order = {
      amount,
      currency: "CNY",
      description,
      userId,
      planType: isAddon ? "addon" : "subscription",
      billingCycle: isAddon ? undefined : (metadata.billingCycle || "monthly"),
      metadata,
    };

    console.log("📝 [Alipay Create] Order data:", order);

    // 创建 AlipayProvider 实例并创建支付
    const alipayProvider = new AlipayProvider(process.env);
    const result = await alipayProvider.createPayment(order);

    if (!result.success) {
      console.error("❌ [Alipay Create] Failed to create payment:", result.error);
      return NextResponse.json(
        { success: false, error: result.error || "创建支付失败" },
        { status: 500 }
      );
    }

    // 记录 pending 支付到数据库
    const nowIso = new Date().toISOString();
    const paymentData = {
      userId,
      provider: "alipay",
      providerOrderId: result.paymentId,
      amount,
      currency: "CNY",
      status: "PENDING",
      type: isAddon ? "ADDON" : "SUBSCRIPTION",
      plan: isAddon ? null : (metadata.planName || null),
      period: isAddon ? null : (metadata.billingCycle || null),
      addonPackageId: isAddon ? addonPackageId : null,
      imageCredits: isAddon ? (metadata.imageCredits || 0) : 0,
      videoAudioCredits: isAddon ? (metadata.videoAudioCredits || 0) : 0,
      metadata,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    try {
      // 国内版使用 CloudBase
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      await db.collection("payments").add(paymentData);

      console.log("✅ [Alipay Create] Payment record created:", {
        transactionId: result.paymentId,
        amount,
        productType: isAddon ? "ADDON" : "SUBSCRIPTION",
      });
    } catch (dbError) {
      console.error("❌ [Alipay Create] Database error:", dbError);
      // 若无法落库 pending 支付单，则拒绝返回 formHtml，避免"已支付但无法发放权益"
      return NextResponse.json(
        { success: false, error: "创建支付失败，请稍后重试" },
        { status: 500 }
      );
    }

    console.log("✅ [Alipay Create] Payment created successfully:", {
      paymentId: result.paymentId,
      hasPaymentUrl: !!result.paymentUrl,
    });

    // 返回支付宝 HTML 表单
    return NextResponse.json({
      success: true,
      paymentId: result.paymentId,
      formHtml: result.paymentUrl, // HTML 表单内容
      orderId: result.paymentId,
    });
  } catch (err) {
    console.error("❌ [Alipay Create] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "创建支付失败",
      },
      { status: 500 }
    );
  }
}
