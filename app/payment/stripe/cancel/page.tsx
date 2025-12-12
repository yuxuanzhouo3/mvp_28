"use client";

import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

export default function StripeCancelPage() {
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
          <XCircle className="w-12 h-12 text-orange-500" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {isZh ? "支付已取消" : "Payment Cancelled"}
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {isZh
            ? "您已取消支付流程。如果这是一个错误，您可以重新开始支付。"
            : "You have cancelled the payment process. If this was a mistake, you can start again."}
        </p>

        <div className="space-y-3">
          <Button
            onClick={() => router.back()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isZh ? "重新选择套餐" : "Choose a Plan Again"}
          </Button>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="w-full"
          >
            {isZh ? "返回首页" : "Back to Home"}
          </Button>
        </div>

        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          {isZh
            ? "如有任何问题，请联系我们的客服团队"
            : "If you have any questions, please contact our support team"}
        </p>
      </div>
    </div>
  );
}



