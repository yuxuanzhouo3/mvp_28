import { NextRequest, NextResponse } from "next/server";
import { createStripeCheckoutSession, stripeErrorResponse } from "@/lib/stripe";
import { pricingPlans, type PricingPlan } from "@/constants/pricing";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getAddonPackageById,
  getAddonDescription,
  type ProductType,
} from "@/constants/addon-packages";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { isAfter } from "date-fns";
import { calculateUpgradePrice } from "@/services/wallet";

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

      // 国内版：升级补差价公式
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
            const currentPlanPrice = extractPlanAmount(
              currentPlanDef,
              "monthly",
              true
            );

            // 公式：目标价 - (当前价/30 * 剩余天数)
            amount = calculateUpgradePrice(
              currentPlanPrice / 30,
              remainingDays,
              baseAmount
            );
          }
        } catch (error) {
          console.error("[stripe][create] upgrade price calc failed", error);
          amount = baseAmount;
        }
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
        days: effectiveBillingPeriod === "annual" ? "365" : "30",
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
