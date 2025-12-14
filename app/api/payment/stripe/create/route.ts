import { NextRequest, NextResponse } from "next/server";
import { createStripeCheckoutSession, stripeErrorResponse } from "@/lib/stripe";
import { pricingPlans } from "@/constants/pricing";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getAddonPackageById,
  getAddonDescription,
  type ProductType,
} from "@/constants/addon-packages";

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

    if (productType === "ADDON" && addonPackageId) {
      // === 加油包购买 ===
      const addonPkg = getAddonPackageById(addonPackageId);
      if (!addonPkg) {
        return NextResponse.json(
          { success: false, error: `Invalid addon package: ${addonPackageId}` },
          { status: 400 },
        );
      }

      // 国内版使用人民币价格，国际版使用美元价格
      // 注意：Stripe 使用美元，所以这里统一用美元价格
      amount = addonPkg.price;
      
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
      const effectivePlanName = resolvedPlan.name;
      const effectiveBillingPeriod = billingPeriod || "monthly";
      
      // 根据国内/国际版本选择价格并解析
      const monthlyLabel = IS_DOMESTIC_VERSION && resolvedPlan.priceZh ? resolvedPlan.priceZh : resolvedPlan.price;
      const annualLabel = IS_DOMESTIC_VERSION && resolvedPlan.annualPriceZh ? resolvedPlan.annualPriceZh : resolvedPlan.annualPrice;
      const monthlyPrice = parseFloat(monthlyLabel.replace(/[^0-9.]/g, "") || "0");
      const annualMonthlyPrice = parseFloat(annualLabel.replace(/[^0-9.]/g, "") || "0");

      // 年付一次性收取12个月
      amount = effectiveBillingPeriod === "annual" ? annualMonthlyPrice * 12 : monthlyPrice;
      
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
      billingCycle: billingPeriod,
      planName: productType === "ADDON" ? undefined : planName,
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
