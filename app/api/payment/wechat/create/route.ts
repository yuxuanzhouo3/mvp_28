// app/api/payment/wechat/create/route.ts
// 微信支付创建 API - 支持订阅和加油包（国内版专用）
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { WechatProviderV3 } from "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider";
import { type ProductType } from "@/constants/addon-packages";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { extractPlanAmount, resolvePlan } from "@/lib/payment/plan-resolver";
import { calculateDomesticUpgradePrice, PAYMENT_CONSTANTS } from "@/lib/payment/upgrade-calculator";
import { resolveCloudBaseUserId } from "@/lib/payment/auth-resolver";
import { handleAddonPurchase, isAddonPurchase } from "@/lib/payment/addon-handler";

// ⚠️ 测试模式：将所有支付金额改为0.01元（1分）
// TODO: 测试完成后将此值改为 false
const WECHAT_PAY_TEST_MODE = false;
const TEST_AMOUNT_FEN = 1; // 测试金额：1分 = 0.01元

// 生成商户订单号
function generateOrderNo(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `WX${timestamp}${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { planName, billingPeriod, userId, productType, addonPackageId } =
      body as {
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

      console.log("📝 [WeChat Create] Creating addon payment:", {
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

      // 基础金额（人民币）
      const baseAmount = extractPlanAmount(resolvedPlan, effectiveBillingPeriod, true);
      amount = baseAmount;

      // 升级补差价逻辑（国内版专用）
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
          console.log("📝 [WeChat Create] Upgrade calculation:", {
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
        originalAmount: baseAmount, // 原始金额（用于记录）
      };

      console.log("📝 [WeChat Create] Creating subscription payment:", {
        userId,
        planName: resolvedPlanName,
        billingPeriod: effectiveBillingPeriod,
        amount,
        days,
        isUpgrade: amount !== baseAmount,
      });
    }

    // 生成商户订单号
    const out_trade_no = generateOrderNo();

    // 初始化微信支付提供商
    const wechatProvider = new WechatProviderV3({
      appId: process.env.WECHAT_PAY_APP_ID!,
      mchId: process.env.WECHAT_PAY_MCH_ID!,
      apiV3Key: process.env.WECHAT_PAY_API_V3_KEY!,
      privateKey: process.env.WECHAT_PAY_PRIVATE_KEY!,
      serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
      notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL}/api/payment/webhook/wechat`,
    });

    // 调用微信 API 创建 NATIVE 支付订单
    const wechatResponse = await wechatProvider.createNativePayment({
      out_trade_no,
      amount: WECHAT_PAY_TEST_MODE ? TEST_AMOUNT_FEN : Math.round(amount * 100), // 测试模式：1分
      description,
      attach: userId, // 附加用户ID，回调时返回
    });

    // 记录 pending 支付到数据库
    const nowIso = new Date().toISOString();
    const paymentData = {
      userId,
      provider: "wechat",
      providerOrderId: out_trade_no,
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

      console.log("✅ [WeChat Create] Payment record created:", {
        out_trade_no,
        amount,
        productType: isAddon ? "ADDON" : "SUBSCRIPTION",
      });
    } catch (dbError) {
      console.error("❌ [WeChat Create] Database error:", dbError);
      // 若无法落库 pending 支付单，则拒绝返回 code_url，避免"已支付但无法发放权益"
      return NextResponse.json(
        { success: false, error: "创建支付失败，请稍后重试" },
        { status: 500 }
      );
    }

    console.log("✅ [WeChat Create] Payment created successfully:", {
      out_trade_no,
      hasCodeUrl: !!wechatResponse.codeUrl,
    });

    // 返回二维码链接
    return NextResponse.json({
      success: true,
      out_trade_no,
      code_url: wechatResponse.codeUrl,
      amount,
      currency: "CNY",
      expires_in: 7200, // 二维码有效期：2小时
    });
  } catch (err) {
    console.error("❌ [WeChat Create] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "创建支付失败",
      },
      { status: 500 }
    );
  }
}
