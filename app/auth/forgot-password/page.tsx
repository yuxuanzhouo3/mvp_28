"use client";

import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { useState } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Page() {
  const supabase = createClient();
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) {
        setError(error.message);
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (isZh ? "发送失败" : "Failed to send"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full max-w-sm space-y-6 bg-slate-900/80 backdrop-blur border border-white/10 rounded-xl p-8 shadow-2xl">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            {isZh ? "重置密码" : "Reset Password"}
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            {isZh ? "输入邮箱以接收重置链接" : "Enter your email to receive a reset link"}
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSend}>
          <input
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {sent && (
            <p className="text-sm text-green-400">
              {isZh ? "邮件已发送，请查收。" : "Email sent! Please check your inbox."}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={loading || sent}
          >
            {loading
              ? (isZh ? "发送中..." : "Sending...")
              : (isZh ? "发送重置邮件" : "Send Reset Email")}
          </button>
        </form>
        <div className="text-center">
          <Link href="/auth/login" className="text-sm text-blue-400 hover:text-blue-300">
            {isZh ? "返回登录" : "Back to Login"}
          </Link>
        </div>
      </div>
    </div>
  );
}
