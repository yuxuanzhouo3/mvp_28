"use client";

import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function Page() {
  const supabase = createClient();
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "updating" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // 处理从邮件链接跳转过来的情况，设置 session
  useEffect(() => {
    const handleHashTokens = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token");
      
      if (access_token && refresh_token) {
        console.info("[UpdatePassword] Setting session from hash tokens");
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) {
          console.error("[UpdatePassword] Failed to set session:", error.message);
          setError(error.message);
          setStatus("error");
        }
        // 清除 URL hash
        window.history.replaceState(null, "", window.location.pathname);
      }
    };
    handleHashTokens();
  }, [supabase]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 验证密码
    if (password.length < 6) {
      setError(isZh ? "密码长度至少为6位" : "Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError(isZh ? "两次输入的密码不一致" : "Passwords do not match");
      return;
    }

    setStatus("updating");
    
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setStatus("error");
        setError(error.message);
      } else {
        setStatus("success");
        // 3秒后跳转到登录页
        setTimeout(() => {
          router.push("/auth/login");
        }, 3000);
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : (isZh ? "更新失败" : "Update failed"));
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full max-w-sm space-y-6 bg-slate-900/80 backdrop-blur border border-white/10 rounded-xl p-8 shadow-2xl">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            {isZh ? "设置新密码" : "Set New Password"}
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            {isZh ? "请输入您的新密码" : "Please enter your new password"}
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleUpdate}>
          <div>
            <input
              type="password"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={isZh ? "新密码 (至少6位)" : "New password (min 6 chars)"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={status === "updating" || status === "success"}
            />
          </div>
          <div>
            <input
              type="password"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={isZh ? "确认新密码" : "Confirm new password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={status === "updating" || status === "success"}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {status === "success" && (
            <div className="text-sm text-green-400 space-y-1">
              <p>{isZh ? "密码已更新成功！" : "Password updated successfully!"}</p>
              <p>{isZh ? "3秒后跳转到登录页..." : "Redirecting to login in 3 seconds..."}</p>
            </div>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={status === "updating" || status === "success"}
          >
            {status === "updating"
              ? (isZh ? "更新中..." : "Updating...")
              : (isZh ? "确认更新" : "Update Password")}
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
