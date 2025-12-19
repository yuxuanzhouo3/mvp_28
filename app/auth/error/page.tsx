"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";

function AuthErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";

  const error = searchParams.get("error") || "unknown_error";
  const errorDescription = searchParams.get("error_description") || (isZh ? "认证过程中发生错误" : "An error occurred during authentication");

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <div className="h-12 w-12 mx-auto text-red-500">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          {isZh ? "认证失败" : "Authentication Failed"}
        </h2>
        <p className="text-sm text-gray-500">
          {isZh ? "错误代码" : "Error code"}: {error}
        </p>
        <p className="text-sm text-red-600">{errorDescription}</p>
        <button
          onClick={() => router.push("/auth/login")}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {isZh ? "返回登录" : "Back to Login"}
        </button>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center p-6">
          <div className="text-center space-y-3">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-500 mx-auto" />
            <p className="text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
