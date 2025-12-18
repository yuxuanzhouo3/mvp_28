// app/api/payment/wechat/create/route.ts
// 微信支付创建 API - 支持订阅和加油包

import { NextRequest, NextResponse } from "next/server";
import { WechatProviderV3 } from "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider";
import { pricingPlans, type PricingPlan } from "@/constants/pricing";
import {
  getAddonPackageById,
  getAddonDescription,
  type ProductType,
} from "@/constants/addon-packages";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { isAfter } from "date-fns";
import { calculateUpgradePrice } from "@/services/wallet";

export const runtime = "nodejs";

const PLAN_RANK: Record<string, number> = { Basic: 1, Pro: 2, Enterprise: 3 };

// 统一套餐名称
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

    // 如果前端未传 userId，尝试从会话自动获取
    if (!userId) {
      if (IS_DOMESTIC_VERSION) {
        const cookieStore = await cookies();
        const token = cookieStore.get("auth-token")?.value;
        if (token) {
          const auth = new CloudBaseAuthService();
          const user = await auth.validateToken(token);
          if (user?.id) {
            userId = user.id;
          }
        }
      } else {
        const supabase = await createClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) {
          userId = data.user.id;
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
    const isAddon =
      productType === "ADDON" ||
      (addonPackageId && addonPackageId.startsWith("addon_"));

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

      console.log("📝 [WeChat Create] Creating addon payment:", {
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

      // 基础金额（人民币）
      const baseAmount = extractPlanAmount(resolvedPlan, effectiveBillingPeriod, true);

      // ⚠️ 国内版微信 Basic 月付测试价：0.01（测试阶段请勿修改）
      const isWechatBasicTest =
        resolvedPlanName === "Basic" && effectiveBillingPeriod === "monthly";
      amount = isWechatBasicTest ? 0.01 : baseAmount;

      // 升级补差价：目标价 - (当前价/30 * 剩余天数)
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
            const currentPlanPrice = extractPlanAmount(currentPlanDef, "monthly", true);

            amount = calculateUpgradePrice(
              currentPlanPrice / 30,
              remainingDays,
              amount
            );
          }
        } catch (error) {
          console.error("[wechat][create] upgrade price calc failed", error);
          amount = isWechatBasicTest ? 0.01 : baseAmount;
        }
      }

      days = effectiveBillingPeriod === "annual" ? 365 : 30;
      description = `${resolvedPlan.nameZh || resolvedPlan.name} - ${effectiveBillingPeriod === "annual" ? "年度订阅" : "月度订阅"}`;
      metadata = {
        userId,
        days,
        productType: "SUBSCRIPTION",
        paymentType: "onetime",
        billingCycle: effectiveBillingPeriod,
        planName: resolvedPlanName,
      };

      console.log("📝 [WeChat Create] Creating subscription payment:", {
        userId,
        planName: resolvedPlanName,
        billingPeriod: effectiveBillingPeriod,
        amount,
        days,
      });
    }

    // 生成商户订单号
    const out_trade_no = generateOrderNo();

    // 初始化微信支付提供商
    const wechatProvider = new WechatProviderV3({
      appId: process.env.WECHAT_APP_ID!,
      mchId: process.env.WECHAT_PAY_MCH_ID!,
      apiV3Key: process.env.WECHAT_PAY_API_V3_KEY!,
      privateKey: process.env.WECHAT_PAY_PRIVATE_KEY!,
      serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
      notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL}/api/payment/webhook/wechat`,
    });

    // 调用微信 API 创建 NATIVE 支付订单
    const wechatResponse = await wechatProvider.createNativePayment({
      out_trade_no,
      amount: Math.round(amount * 100), // 转换为分
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
    };

    try {
      if (IS_DOMESTIC_VERSION) {
        // CloudBase 插入
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        await db.collection("payments").add(paymentData);
      } else {
        // Supabase 插入
        const { error: insertError } = await supabaseAdmin
          .from("payments")
          .insert([
            {
              ...paymentData,
              provider_order_id: out_trade_no,
            },
          ]);

        if (insertError) {
          console.error("❌ [WeChat Create] Supabase insert error:", insertError);
          throw insertError;
        }
      }

      console.log("✅ [WeChat Create] Payment record created:", {
        out_trade_no,
        amount,
        productType: isAddon ? "ADDON" : "SUBSCRIPTION",
      });
    } catch (dbError) {
      console.error("❌ [WeChat Create] Database error:", dbError);
      // 若无法落库 pending 支付单，则拒绝返回 code_url，避免“已支付但无法发放权益”
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
