"use client";

import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Page() {
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";

  return (
    <div className="flex min-h-svh items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-md rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur p-8 shadow-2xl">
        <div className="flex items-center justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        </div>
        <h1 className="text-xl font-semibold mb-2 text-white text-center">
          {isZh ? "注册成功" : "Registration Successful"}
        </h1>
        <p className="text-sm text-slate-300 text-center mb-6">
          {isZh
            ? "我们已向您的邮箱发送确认邮件，请查收并点击确认链接以完成注册。"
            : "We've sent a confirmation email to your inbox. Please check your email and click the confirmation link to complete registration."}
        </p>
        <div className="space-y-3">
          <Link
            href="/auth/login"
            className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isZh ? "返回登录" : "Back to Login"}
          </Link>
          <p className="text-xs text-slate-400 text-center">
            {isZh
              ? "没有收到邮件？请检查垃圾邮件文件夹。"
              : "Didn't receive the email? Check your spam folder."}
          </p>
        </div>
      </div>
    </div>
  );
}
