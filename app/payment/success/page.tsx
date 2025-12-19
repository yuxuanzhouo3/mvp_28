"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const outTradeNo = searchParams.get("out_trade_no");
  const tradeNo = searchParams.get("trade_no");
  const transactionId = searchParams.get("transaction_id");
  const totalAmount = searchParams.get("total_amount");
  const provider = searchParams.get("provider") || "alipay"; // 默认支付宝
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";

  const isWechat = provider === "wechat";

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [result, setResult] = useState<{
    orderId?: string;
    tradeNo?: string;
    amount?: string;
    productType?: string;
    message?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirmedRef = useRef(false);

  useEffect(() => {
    // 支付完成后调用确认API处理业务逻辑
    async function confirmPayment() {
      if (!outTradeNo) {
        setError(isZh ? "缺少订单信息" : "Missing order information");
        setStatus("error");
        return;
      }

      // 防止重复确认
      if (confirmedRef.current) return;
      confirmedRef.current = true;

      try {
        console.log(`[Payment Success] Confirming ${provider} payment:`, outTradeNo);

        // 根据支付方式调用不同的确认API
        const confirmUrl = isWechat
          ? "/api/payment/wechat/confirm"
          : "/api/payment/alipay/confirm";

        const response = await fetch(confirmUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outTradeNo }),
        });

        const data = await response.json();
        console.log("[Payment Success] Confirm result:", data);

        if (data.success) {
          setResult({
            orderId: outTradeNo,
            tradeNo: isWechat ? (transactionId || undefined) : (tradeNo || undefined),
            amount: totalAmount || undefined,
            productType: data.productType,
            message: data.message,
          });
          setStatus("success");
        } else {
          // 如果是"支付未完成"，说明用户可能取消了支付
          if (data.error === "Payment not completed" || data.status === "WAIT_BUYER_PAY" || data.status === "NOTPAY") {
            setError(isZh ? "支付未完成，请重新支付" : "Payment not completed, please try again");
          } else {
            setError(data.error || (isZh ? "确认支付失败" : "Failed to confirm payment"));
          }
          setStatus("error");
        }
      } catch (err) {
        console.error("[Payment Success] Confirm error:", err);
        setError(isZh ? "网络错误，请刷新页面重试" : "Network error, please refresh and retry");
        setStatus("error");
      }
    }

    confirmPayment();
  }, [outTradeNo, tradeNo, transactionId, totalAmount, isZh, provider, isWechat]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-blue-500 animate-spin" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {isZh ? "正在确认支付..." : "Confirming payment..."}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {isZh
                ? "请稍候，正在处理您的订单"
                : "Please wait while we process your order"}
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {isZh ? "支付成功！" : "Payment Successful!"}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {result?.productType === "ADDON"
                ? (isZh ? "加油包额度已添加到您的账户" : "Addon credits have been added to your account")
                : (isZh ? "感谢您的购买，您的订阅已激活" : "Thank you for your purchase. Your subscription is activated.")}
            </p>

            {result && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6 text-left">
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-600">
                  <span className="text-gray-600 dark:text-gray-400">
                    {isZh ? "订单号" : "Order ID"}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">
                    {result.orderId}
                  </span>
                </div>
                {result.tradeNo && (
                  <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-gray-600 dark:text-gray-400">
                      {isWechat
                        ? (isZh ? "微信交易号" : "WeChat Transaction ID")
                        : (isZh ? "支付宝交易号" : "Alipay Trade No")}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">
                      {result.tradeNo}
                    </span>
                  </div>
                )}
                {result.amount && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600 dark:text-gray-400">
                      {isZh ? "支付金额" : "Amount"}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      ¥{result.amount}
                    </span>
                  </div>
                )}
              </div>
            )}

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {result?.productType === "ADDON"
                ? (isZh ? "额度已立即生效，可在账户中查看" : "Credits are effective immediately. Check your account.")
                : (isZh ? "订阅已立即生效，可在账户中查看" : "Subscription is effective immediately. Check your account.")}
            </p>

            <Button
              onClick={() => router.push("/")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isZh ? "开始使用" : "Start Using"}
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <AlertCircle className="w-12 h-12 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {isZh ? "支付确认失败" : "Payment Confirmation Failed"}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {error ||
                (isZh
                  ? "请联系客服获取帮助"
                  : "Please contact support for assistance")}
            </p>

            <div className="space-y-3">
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full"
              >
                {isZh ? "重试" : "Retry"}
              </Button>
              <Button
                onClick={() => router.push("/")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isZh ? "返回首页" : "Back to Home"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
