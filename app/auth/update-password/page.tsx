"use client";

import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default function Page() {
  const supabase = createClient();
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        // 密码更新成功后,用户已经通过邮件链接认证,直接跳转到首页
        setTimeout(() => {
          router.push("/");
        }, 1500);
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : (isZh ? "更新失败" : "Update failed"));
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* 装饰性背景 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-blue-400/10 to-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-gradient-to-br from-emerald-400/10 to-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-gray-200/50 dark:border-white/10 rounded-2xl sm:rounded-3xl p-8 shadow-2xl">
        {/* 标题区域 */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-2.5 rounded-xl shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/25 mb-3">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isZh ? "设置新密码" : "Set New Password"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
            {isZh ? "请输入您的新密码以完成重置" : "Please enter your new password to complete the reset"}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleUpdate}>
          {/* 新密码输入 */}
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {isZh ? "新密码" : "New Password"}
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={isZh ? "新密码 (至少6位)" : "New password (min 6 chars)"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 h-11 bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                required
                disabled={status === "updating" || status === "success"}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* 确认密码输入 */}
          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {isZh ? "确认新密码" : "Confirm New Password"}
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder={isZh ? "确认新密码" : "Confirm new password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 pr-10 h-11 bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                required
                disabled={status === "updating" || status === "success"}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-3">
              {error}
            </div>
          )}

          {/* 成功提示 */}
          {status === "success" && (
            <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-lg p-3 space-y-1">
              <p className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {isZh ? "密码已更新成功！" : "Password updated successfully!"}
              </p>
              <p>{isZh ? "正在跳转到首页..." : "Redirecting to home..."}</p>
            </div>
          )}

          {/* 提交按钮 */}
          <Button
            type="submit"
            className="w-full h-11 font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-blue-500/25 hover:shadow-blue-500/40"
            disabled={status === "updating" || status === "success"}
          >
            {status === "updating"
              ? (isZh ? "更新中..." : "Updating...")
              : (isZh ? "确认更新" : "Update Password")}
          </Button>
        </form>

        {/* 返回登录链接 */}
        <div className="text-center mt-6">
          <Link
            href="/auth/login"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            {isZh ? "返回登录" : "Back to Login"}
          </Link>
        </div>
      </div>
    </div>
  );
}
