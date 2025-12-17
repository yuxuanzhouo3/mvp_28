"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

function WechatPaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";

  const codeUrl = searchParams.get("code_url") || "";
  const outTradeNo = searchParams.get("out_trade_no") || "";
  const amount = parseFloat(searchParams.get("amount") || "0");

  const [status, setStatus] = useState<
    "pending" | "success" | "failed" | "expired"
  >("pending");
  const [pollingCount, setPollingCount] = useState(0);
  const maxPollingCount = 120; // 2分钟内，每秒轮询一次

  // 轮询支付状态
  const checkPaymentStatus = useCallback(async () => {
    if (!outTradeNo) return;

    try {
      const res = await fetch(
        `/api/payment/wechat/query?out_trade_no=${outTradeNo}`
      );
      const data = await res.json();

      if (data.success && data.trade_state === "SUCCESS") {
        setStatus("success");
        // 3秒后跳转，传递订单信息
        setTimeout(() => {
          router.push(`/payment/success?provider=wechat&out_trade_no=${outTradeNo}&total_amount=${amount}&transaction_id=${data.transaction_id || ""}`);
        }, 3000);
      } else if (
        data.trade_state === "CLOSED" ||
        data.trade_state === "PAYERROR"
      ) {
        setStatus("failed");
      }
    } catch (error) {
      console.error("Check payment status error:", error);
    }
  }, [outTradeNo, router]);

  useEffect(() => {
    if (status !== "pending") return;

    const interval = setInterval(() => {
      setPollingCount((prev) => {
        if (prev >= maxPollingCount) {
          setStatus("expired");
          return prev;
        }
        checkPaymentStatus();
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status, checkPaymentStatus]);

  // 刷新二维码
  const handleRefresh = () => {
    window.location.reload();
  };

  if (!codeUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {isZh ? "支付参数错误" : "Payment parameter error"}
          </h1>
          <Button onClick={() => router.back()} className="mt-4">
            {isZh ? "返回" : "Go Back"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">💚</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isZh ? "微信支付" : "WeChat Pay"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {isZh
              ? "请使用微信扫描下方二维码完成支付"
              : "Please scan the QR code with WeChat to pay"}
          </p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          {status === "pending" && (
            <div className="relative">
              <div className="p-4 bg-white rounded-xl shadow-inner">
                <QRCodeSVG value={codeUrl} size={200} level="H" />
              </div>
              {/* 倒计时 */}
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-3 py-1 rounded-full">
                {Math.floor((maxPollingCount - pollingCount) / 60)}:
                {String((maxPollingCount - pollingCount) % 60).padStart(2, "0")}
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4 animate-bounce" />
              <h2 className="text-xl font-bold text-green-600 dark:text-green-400">
                {isZh ? "支付成功！" : "Payment Successful!"}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                {isZh ? "正在跳转..." : "Redirecting..."}
              </p>
            </div>
          )}

          {status === "failed" && (
            <div className="text-center py-8">
              <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-red-600 dark:text-red-400">
                {isZh ? "支付失败" : "Payment Failed"}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                {isZh ? "请重试或选择其他支付方式" : "Please try again or choose another payment method"}
              </p>
              <Button onClick={() => router.back()} className="mt-4">
                {isZh ? "返回" : "Go Back"}
              </Button>
            </div>
          )}

          {status === "expired" && (
            <div className="text-center py-8">
              <RefreshCw className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                {isZh ? "二维码已过期" : "QR Code Expired"}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                {isZh ? "请刷新页面获取新的二维码" : "Please refresh to get a new QR code"}
              </p>
              <Button onClick={handleRefresh} className="mt-4">
                <RefreshCw className="w-4 h-4 mr-2" />
                {isZh ? "刷新" : "Refresh"}
              </Button>
            </div>
          )}
        </div>

        {/* Amount */}
        {status === "pending" && (
          <div className="text-center border-t border-gray-200 dark:border-gray-700 pt-6">
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
              {isZh ? "支付金额" : "Amount"}
            </p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              ￥{amount.toFixed(2)}
            </p>
          </div>
        )}

        {/* Footer */}
        {status === "pending" && (
          <div className="mt-6 text-center">
            <div className="flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {isZh ? "等待支付中..." : "Waiting for payment..."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WechatPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800">
          <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        </div>
      }
    >
      <WechatPaymentContent />
    </Suspense>
  );
}
