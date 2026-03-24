// app/api/payment/alipay/create/route.ts - 支付宝支付创建API（国内版专用）
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { AlipayProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/alipay-provider";
import { type ProductType } from "@/constants/addon-packages";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { extractPlanAmount, resolvePlan } from "@/lib/payment/plan-resolver";
import { calculateDomesticUpgradePrice, PAYMENT_CONSTANTS } from "@/lib/payment/upgrade-calculator";
import { resolveCloudBaseUserId } from "@/lib/payment/auth-resolver";
import { handleAddonPurchase, isAddonPurchase } from "@/lib/payment/addon-handler";

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
      userId = await resolveCloudBaseUserId(request) || undefined;
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "用户未登录" },
        { status: 401 }
      );
    }

    // 判断是加油包还是订阅
    const isAddon = isAddonPurchase(productType, addonPackageId);

    let amount = 0;
    let description = "";
    let days = 0;
    let metadata: Record<string, any> = {};

    if (isAddon && addonPackageId) {
      // 加油包购买
      const addonResult = handleAddonPurchase(addonPackageId, userId, true);
      if (!addonResult.success) {
        return addonResult.response;
      }

      amount = addonResult.amount;
      description = addonResult.description;
      metadata = addonResult.metadata;

      console.log("📝 [Alipay Create] Creating addon payment:", {
        userId,
        addonPackageId,
        amount,
        imageCredits: addonResult.addonPackage.imageCredits,
        videoAudioCredits: addonResult.addonPackage.videoAudioCredits,
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
        const upgradeResult = await calculateDomesticUpgradePrice({
          userId,
          targetPlan: resolvedPlan,
          billingPeriod: effectiveBillingPeriod,
          baseAmount,
        });
        amount = upgradeResult.amount;
        days = upgradeResult.days;

        if (upgradeResult.isUpgrade) {
          console.log("📝 [Alipay Create] Upgrade calculation:", {
            currentPlan: "detected",
            targetPlan: resolvedPlanName,
            billingPeriod: effectiveBillingPeriod,
            freeUpgrade: upgradeResult.freeUpgrade,
            remainingDays: upgradeResult.remainingDays,
            remainingValue: upgradeResult.remainingValue,
            upgradeAmount: amount,
            newPlanDays: days,
          });
        }
      }

      // 只有在非升级情况下才设置默认天数
      if (days === 0) {
        days = effectiveBillingPeriod === "annual" ? PAYMENT_CONSTANTS.DAYS_PER_YEAR : PAYMENT_CONSTANTS.DAYS_PER_MONTH;
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
      source: "cn", // 国内版数据标识
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
