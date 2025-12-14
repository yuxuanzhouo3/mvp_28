import { NextRequest, NextResponse } from "next/server";
import { createPayPalOrder, paypalErrorResponse } from "@/lib/paypal";
import { pricingPlans } from "@/constants/pricing";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { IS_DOMESTIC_VERSION } from "@/config";
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
      const effectivePlanName = resolvedPlan.name;
      const effectiveBillingPeriod = billingPeriod || "monthly";
      
      // PayPal 不支持 CNY，订阅统一使用美元价格字段
      const monthlyLabel = resolvedPlan.price;
      const annualLabel = resolvedPlan.annualPrice;
      const monthlyPrice = parseFloat(monthlyLabel.replace(/[^0-9.]/g, "") || "0");
      const annualMonthlyPrice = parseFloat(annualLabel.replace(/[^0-9.]/g, "") || "0");
      
      // Annual UI 显示“每月折后价”，实际一次性收取 12 个月
      amount = effectiveBillingPeriod === "annual" ? annualMonthlyPrice * 12 : monthlyPrice;
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
