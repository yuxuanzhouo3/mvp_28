// app/api/payment/webhook/wechat/route.ts
// 微信支付 Webhook 回调处理 (API v3)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { WechatProviderV3 } from "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider";
import { IS_DOMESTIC_VERSION } from "@/config";
import { addAddonCredits as addWalletAddonCredits } from "@/services/wallet";
import { trackPaymentEvent, trackSubscriptionEvent } from "@/services/analytics";
import { normalizePlanName } from "@/utils/plan-utils";
import { applySubscriptionPayment } from "@/lib/payment/apply-subscription";
import {
  queryPaymentRecord,
  updatePaymentRecord,
  isWebhookEventProcessed,
  saveWebhookEvent,
  markWebhookEventProcessed,
  isPaymentCompleted,
  validatePaymentAmount,
  extractUserId,
  extractAddonCredits,
  isAddonPayment,
} from "@/lib/payment/payment-record-helper";
import { wechatSuccess, wechatFail } from "@/lib/payment/webhook-response";

export async function POST(request: NextRequest) {
  try {
    if (!IS_DOMESTIC_VERSION) {
      return new NextResponse(null, { status: 404 });
    }

    // 1. 获取 Webhook 签名信息
    const signature = request.headers.get("Wechatpay-Signature") || "";
    const timestamp = request.headers.get("Wechatpay-Timestamp") || "";
    const nonce = request.headers.get("Wechatpay-Nonce") || "";

    // 2. 读取请求体
    const body = await request.text();

    console.log("📥 [WeChat Webhook] Received:", {
      timestamp,
      nonce,
      bodyLength: body.length,
    });

    // 3. 初始化微信支付提供商用于验证签名
    const wechatProvider = new WechatProviderV3({
      appId: process.env.WECHAT_PAY_APP_ID!,
      mchId: process.env.WECHAT_PAY_MCH_ID!,
      apiV3Key: process.env.WECHAT_PAY_API_V3_KEY!,
      privateKey: process.env.WECHAT_PAY_PRIVATE_KEY!,
      serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
      notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL}/api/payment/webhook/wechat`,
    });

    // 4. 验证签名（生产环境启用）
    if (process.env.NODE_ENV === "production") {
      const isValidSignature = wechatProvider.verifyWebhookSignature(body, signature, timestamp, nonce);
      if (!isValidSignature) {
        console.error("❌ [WeChat Webhook] Signature verification failed");
        return NextResponse.json(
          { code: "FAIL", message: "Invalid signature" },
          { status: 401 }
        );
      }
      console.log("✅ [WeChat Webhook] Signature verified");
    } else {
      console.log("⚠️ [WeChat Webhook] Skipping signature verification (non-production)");
    }

    // 5. 解析 Webhook 数据
    const webhookData = JSON.parse(body);

    console.log("📥 [WeChat Webhook] Event type:", webhookData.event_type);

    // 6. 仅处理支付成功事件
    if (webhookData.event_type !== "TRANSACTION.SUCCESS") {
      console.log(
        "⏭️ [WeChat Webhook] Ignoring event:",
        webhookData.event_type
      );
      return NextResponse.json(
        { code: "SUCCESS", message: "Ok" },
        { status: 200 }
      );
    }

    // 7. 解密回调数据
    let paymentData: any;
    try {
      paymentData = await wechatProvider.handleWebhookNotification(webhookData);
    } catch (error) {
      console.error("❌ [WeChat Webhook] Failed to decrypt data:", error);
      return NextResponse.json(
        { code: "FAIL", message: "Decryption failed" },
        { status: 400 }
      );
    }

    console.log("🔓 [WeChat Webhook] Decrypted payment data:", {
      out_trade_no: paymentData.out_trade_no,
      transaction_id: paymentData.transaction_id,
      trade_state: paymentData.trade_state,
      amount: paymentData.amount?.total,
      attach: paymentData.attach,
    });

    // 8. 检查交易状态
    if (paymentData.trade_state !== "SUCCESS") {
      console.log(
        "⏭️ [WeChat Webhook] Payment not successful:",
        paymentData.trade_state
      );
      return NextResponse.json(
        { code: "SUCCESS", message: "Ok" },
        { status: 200 }
      );
    }

    // 9. 幂等性检查：防止重复处理
    const webhookEventId = `wechat_${paymentData.transaction_id}`;
    const eventProcessed = await isWebhookEventProcessed(webhookEventId);

    if (eventProcessed) {
      console.log("⏭️ [WeChat Webhook] Event already processed:", webhookEventId);
      return wechatSuccess();
    }

    // 10. 记录 Webhook 事件
    await saveWebhookEvent({
      id: webhookEventId,
      provider: "wechat",
      event_type: "TRANSACTION.SUCCESS",
      event_data: paymentData,
      processed: false,
      created_at: new Date().toISOString(),
    });

    // 11. 获取支付订单信息
    const amount = paymentData.amount?.total
      ? paymentData.amount.total / 100
      : 0;
    const userId = paymentData.attach || ""; // 从附加数据获取用户ID

    const paymentRecord = await queryPaymentRecord("wechat", paymentData.out_trade_no);

    if (!paymentRecord) {
      console.error("[WeChat Webhook] Payment record not found:", {
        out_trade_no: paymentData.out_trade_no,
      });
      return wechatFail("Payment record not found");
    }

    const effectiveUserId = extractUserId(paymentRecord, userId);

    if (!effectiveUserId) {
      console.error("❌ [WeChat Webhook] Payment record not found or missing user_id");
      return wechatFail("Payment record not found");
    }

    if (isPaymentCompleted(paymentRecord)) {
      return wechatSuccess();
    }

    // 交易金额校验
    const expectedAmount = Number(paymentRecord?.amount || 0);
    if (!validatePaymentAmount(expectedAmount, amount)) {
      console.error("[WeChat Webhook] amount mismatch", {
        out_trade_no: paymentData.out_trade_no,
        expectedAmount,
        paidAmount: amount,
      });
      return wechatFail("Amount mismatch");
    }

    // 12. 检查是否是加油包购买
    const isAddon = isAddonPayment(paymentRecord);

    if (isAddon) {
      // 加油包购买 - 增加用户额度
      const { imageCredits, videoAudioCredits } = extractAddonCredits(paymentRecord);

      console.log("📦 [WeChat Webhook] Processing addon purchase:", {
        userId: effectiveUserId,
        imageCredits,
        videoAudioCredits,
      });

      const addResult = await addWalletAddonCredits(
        effectiveUserId,
        Number(imageCredits) || 0,
        Number(videoAudioCredits) || 0
      );

      if (!addResult.success) {
        console.error("❌ [WeChat Webhook] Failed to add addon credits");
        return wechatFail("Failed to add addon credits", 500);
      }

      // 埋点：记录加油包支付事件
      trackPaymentEvent(effectiveUserId, {
        amount,
        currency: "CNY",
        plan: "ADDON",
        provider: "wechat",
        orderId: paymentData.out_trade_no,
      }).catch((err) => console.warn("[WeChat Webhook] trackPaymentEvent error:", err));
    } else {
      // 订阅购买 - 更新订阅状态
      const period = (paymentRecord?.period || paymentRecord?.metadata?.billingCycle || "monthly") as
        | "monthly"
        | "annual";
      const days = Number(paymentRecord?.metadata?.days) || (period === "annual" ? 365 : 30);
      const planName = normalizePlanName(paymentRecord?.plan || paymentRecord?.metadata?.planName || "Pro") || "Pro";

      console.log("📦 [WeChat Webhook] Processing subscription:", {
        userId: effectiveUserId,
        days,
        planName,
        paymentRecordFound: !!paymentRecord,
        metadata: paymentRecord?.metadata,
      });

      await applySubscriptionPayment({
        userId: effectiveUserId,
        providerOrderId: paymentData.out_trade_no,
        provider: "wechat",
        period,
        days,
        planName,
      });

      // 埋点：记录订阅支付和订阅变更事件
      trackPaymentEvent(effectiveUserId, {
        amount,
        currency: "CNY",
        plan: planName,
        provider: "wechat",
        orderId: paymentData.out_trade_no,
      }).catch((err) => console.warn("[WeChat Webhook] trackPaymentEvent error:", err));

      trackSubscriptionEvent(effectiveUserId, {
        action: "subscribe",
        toPlan: planName,
        period,
      }).catch((err) => console.warn("[WeChat Webhook] trackSubscriptionEvent error:", err));
    }

    // 13. 更新支付订单状态
    const updateData = {
      status: "COMPLETED",
      providerTransactionId: paymentData.transaction_id,
      updatedAt: new Date().toISOString(),
    };

    const updated = await updatePaymentRecord("wechat", paymentData.out_trade_no, updateData);
    if (updated) {
      console.log("✅ [WeChat Webhook] Updated payment:", paymentData.out_trade_no);
    }

    // 14. 标记 Webhook 事件为已处理
    await markWebhookEventProcessed(webhookEventId);

    console.log("✅ [WeChat Webhook] Successfully processed:", webhookEventId);

    // 15. 返回成功响应给微信
    return wechatSuccess();
  } catch (error) {
    console.error("❌ [WeChat Webhook] Processing error:", error);
    return wechatFail("Internal server error", 500);
  }
}
