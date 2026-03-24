// app/api/payment/webhook/alipay/route.ts - 支付宝 Webhook 处理
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { IS_DOMESTIC_VERSION } from "@/config";
import { addAddonCredits } from "@/services/wallet";
import { trackPaymentEvent, trackSubscriptionEvent } from "@/services/analytics";
import { normalizePlanName } from "@/utils/plan-utils";
import { applySubscriptionPayment } from "@/lib/payment/apply-subscription";
import {
  queryPaymentRecord,
  updatePaymentRecord,
  isPaymentCompleted,
  validatePaymentAmount,
  extractUserId,
  extractAddonCredits,
  isAddonPayment,
} from "@/lib/payment/payment-record-helper";
import { alipaySuccess, alipayFail } from "@/lib/payment/webhook-response";

export async function POST(request: NextRequest) {
  try {
    if (!IS_DOMESTIC_VERSION) {
      return new NextResponse(null, { status: 404 });
    }
    console.log("🔔 [Alipay Webhook] 收到 webhook 请求");

    // 支付宝在POST body中以form-urlencoded格式传递数据
    const formData = await request.formData();
    const params: Record<string, string> = {};

    // 收集所有参数
    formData.forEach((value, key) => {
      params[key] = value as string;
    });

    console.log("📝 [Alipay Webhook] 接收到的参数:", {
      outTradeNo: params.out_trade_no,
      tradeNo: params.trade_no,
      tradeStatus: params.trade_status,
      totalAmount: params.total_amount,
      passbackParams: params.passback_params,
      hasSignature: !!params.sign,
    });

    // 验证支付宝签名
    const isValidSignature = verifyAlipaySignature(
      params,
      process.env.ALIPAY_ALIPAY_PUBLIC_KEY
    );

    console.log(
      "🔐 [Alipay Webhook] 签名验证:",
      isValidSignature ? "✅ 通过" : "❌ 失败"
    );

    if (!isValidSignature) {
      console.error("❌ [Alipay Webhook] Invalid Alipay webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 检查支付状态
    const tradeStatus = params.trade_status;
    console.log("💰 [Alipay Webhook] 支付状态:", tradeStatus);

    if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
      console.log(
        "⏭️  [Alipay Webhook] 支付状态不是最终状态，忽略:",
        tradeStatus
      );
      return NextResponse.json({ status: "ignored" });
    }

    console.log("✅ [Alipay Webhook] 支付成功，开始处理");

    const success = await processAlipayWebhook(tradeStatus, params);

    console.log(
      "📊 [Alipay Webhook] 处理结果:",
      success ? "✅ 成功" : "❌ 失败"
    );

    if (success) {
      // 支付宝要求返回success字符串
      console.log("✨ [Alipay Webhook] 返回 success");
      return new NextResponse("success");
    } else {
      console.error("❌ [Alipay Webhook] Failed to process Alipay webhook");
      return new NextResponse("failure");
    }
  } catch (error) {
    console.error("❌ [Alipay Webhook] 异常错误:", error);
    return new NextResponse("failure");
  }
}

async function processAlipayWebhook(
  _tradeStatus: string,
  params: Record<string, string>
): Promise<boolean> {
  const outTradeNo = params.out_trade_no || "";
  const tradeNo = params.trade_no || "";
  const totalAmount = parseFloat(params.total_amount || "0");

  if (!outTradeNo) {
    console.error("[Alipay Webhook] Missing out_trade_no");
    return false;
  }

  try {
    const paymentRecord = await queryPaymentRecord("alipay", outTradeNo);

    if (!paymentRecord) {
      console.error("[Alipay Webhook] Payment record not found:", outTradeNo);
      return false;
    }

    if (isPaymentCompleted(paymentRecord)) {
      return true;
    }

    const expectedAmount = Number(paymentRecord.amount || 0);
    if (!validatePaymentAmount(expectedAmount, totalAmount)) {
      console.error("[Alipay Webhook] amount mismatch", {
        outTradeNo,
        expectedAmount,
        paidAmount: totalAmount,
      });
      return false;
    }

    const userId = extractUserId(paymentRecord);
    if (!userId) {
      console.error("[Alipay Webhook] Missing userId in payment record:", outTradeNo);
      return false;
    }

    const isAddon = isAddonPayment(paymentRecord);

    if (isAddon) {
      const { imageCredits, videoAudioCredits } = extractAddonCredits(paymentRecord);

      const addRes = await addAddonCredits(userId, imageCredits, videoAudioCredits);
      if (!addRes.success) {
        console.error("[Alipay Webhook] Failed to add addon credits:", addRes.error);
        return false;
      }

      trackPaymentEvent(userId, {
        amount: totalAmount,
        currency: "CNY",
        plan: "ADDON",
        provider: "alipay",
        orderId: outTradeNo,
      }).catch((err) => console.warn("[Alipay Webhook] trackPaymentEvent error:", err));
    } else {
      const period = (paymentRecord.period || paymentRecord?.metadata?.billingCycle || "monthly") as
        | "monthly"
        | "annual";
      const days = Number(paymentRecord?.metadata?.days) || (period === "annual" ? 365 : 30);
      const planName =
        normalizePlanName(paymentRecord.plan || paymentRecord?.metadata?.planName || "Pro") ||
        "Pro";

      await applySubscriptionPayment({
        userId,
        providerOrderId: outTradeNo,
        provider: "alipay",
        period,
        days,
        planName,
      });

      trackPaymentEvent(userId, {
        amount: totalAmount,
        currency: "CNY",
        plan: planName,
        provider: "alipay",
        orderId: outTradeNo,
      }).catch((err) => console.warn("[Alipay Webhook] trackPaymentEvent error:", err));

      trackSubscriptionEvent(userId, {
        action: "subscribe",
        toPlan: planName,
        period,
      }).catch((err) => console.warn("[Alipay Webhook] trackSubscriptionEvent error:", err));
    }

    const updatePayload = {
      status: "COMPLETED",
      providerTransactionId: tradeNo || null,
      updatedAt: new Date().toISOString(),
    };

    await updatePaymentRecord("alipay", outTradeNo, updatePayload, paymentRecord._id);

    return true;
  } catch (error) {
    console.error("[Alipay Webhook] process error", error);
    return false;
  }
}

/**
 * 验证支付宝签名
 */
function verifyAlipaySignature(
  params: Record<string, string>,
  publicKey?: string
): boolean {
  try {
    // 仅在非生产环境或沙箱模式下跳过签名验证
    if (
      process.env.NODE_ENV !== "production" ||
      process.env.ALIPAY_SANDBOX === "true"
    ) {
      console.log("⚠️ [Alipay Webhook] 跳过签名验证 (非生产/沙箱环境)");
      return true;
    }

    if (!publicKey) {
      console.error("Missing Alipay public key");
      return false;
    }

    // 从参数中提取签名
    const sign = params.sign;
    const signType = params.sign_type;

    if (!sign || signType !== "RSA2") {
      console.error("Missing or invalid Alipay signature");
      return false;
    }

    // 移除签名相关参数
    const paramsToSign = { ...params };
    delete paramsToSign.sign;
    delete paramsToSign.sign_type;

    // 排序参数
    const sortedKeys = Object.keys(paramsToSign).sort();
    const signString = sortedKeys
      .map((key) => `${key}=${paramsToSign[key]}`)
      .join("&");

    // 验证RSA2签名
    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(signString, "utf8");

    const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;

    const isValid = verify.verify(publicKeyPem, sign, "base64");

    if (!isValid) {
      console.error("Alipay signature verification failed");
    }

    return isValid;
  } catch (error) {
    console.error("Alipay signature verification error:", error);
    return false;
  }
}
