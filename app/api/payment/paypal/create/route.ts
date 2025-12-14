import { NextRequest, NextResponse } from "next/server";
import { createPayPalOrder, paypalErrorResponse } from "@/lib/paypal";
import { pricingPlans, type PricingPlan } from "@/constants/pricing";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { isAfter } from "date-fns";
import { calculateUpgradePrice } from "@/services/wallet";
import {
  getAddonPackageById,
  getAddonDescription,
  type ProductType,
} from "@/constants/addon-packages";

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

      // PayPal 不支持 CNY，统一使用美元价格
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
      ].join("|");
      
      description = getAddonDescription(addonPkg, IS_DOMESTIC_VERSION);
    } else {
      // === 订阅购买 (原有逻辑) ===
      const resolvedPlan = resolvePlan(planName);
      const effectiveBillingPeriod = billingPeriod || "monthly";
      const useDomesticPrice = false; // PayPal 始终用美元字段

      // Annual UI 显示“每月折后价”，实际一次性收取 12 个月
      const baseAmount = extractPlanAmount(
        resolvedPlan,
        effectiveBillingPeriod,
        useDomesticPrice
      );
      amount = baseAmount;

      // 国内版升级：差价计算（按剩余天数折算）
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
            const currentPlanPrice = extractPlanAmount(
              currentPlanDef,
              "monthly",
              useDomesticPrice
            );

            amount = calculateUpgradePrice(
              currentPlanPrice / 30,
              remainingDays,
              baseAmount
            );
          }
        } catch (error) {
          console.error("[paypal][create] upgrade price calc failed", error);
          amount = baseAmount;
        }
      }
      currency = "USD";
      
      // customId 格式: userId|planName|billingPeriod (保持兼容)
      customId = [resolvedUserId, resolvedPlan.name, effectiveBillingPeriod].join("|");
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
