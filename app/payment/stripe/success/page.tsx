"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

function StripeSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [result, setResult] = useState<{
    plan?: string;
    period?: string;
    expiresAt?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setError(isZh ? "缺少支付会话ID" : "Missing payment session ID");
      return;
    }

    const confirmPayment = async () => {
      try {
        const res = await fetch("/api/payment/stripe/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        const data = await res.json();

        if (data.success) {
          setResult({
            plan: data.plan,
            period: data.period,
            expiresAt: data.expiresAt,
          });
          setStatus("success");
        } else {
          setError(data.error || (isZh ? "支付确认失败" : "Payment confirmation failed"));
          setStatus("error");
        }
      } catch (err) {
        setError(isZh ? "网络错误，请稍后重试" : "Network error, please try again");
        setStatus("error");
      }
    };

    confirmPayment();
  }, [sessionId, isZh]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(isZh ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

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
              {isZh ? "请稍候，正在处理您的订单" : "Please wait while we process your order"}
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
              {isZh
                ? "感谢您的购买，您的订阅已激活"
                : "Thank you for your purchase. Your subscription is now active."}
            </p>

            {result && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6 text-left">
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-600">
                  <span className="text-gray-600 dark:text-gray-400">
                    {isZh ? "套餐" : "Plan"}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {result.plan}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-600">
                  <span className="text-gray-600 dark:text-gray-400">
                    {isZh ? "周期" : "Period"}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {result.period === "annual"
                      ? isZh
                        ? "年付"
                        : "Annual"
                      : isZh
                        ? "月付"
                        : "Monthly"}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 dark:text-gray-400">
                    {isZh ? "有效期至" : "Valid until"}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatDate(result.expiresAt)}
                  </span>
                </div>
              </div>
            )}

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
              {error || (isZh ? "请联系客服获取帮助" : "Please contact support for assistance")}
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

export default function StripeSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <StripeSuccessContent />
    </Suspense>
  );
}



