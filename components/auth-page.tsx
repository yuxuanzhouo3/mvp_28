"use client";

import { useState } from "react";
import Link from "next/link";
import { DEFAULT_LANGUAGE } from "@/config";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";

type Mode = "login" | "signup";

export function AuthPage({ mode }: { mode: Mode }) {
  const { currentLanguage, isDomesticVersion } = useLanguage();
  const isDomestic = isDomesticVersion; // 后端/版本判定
  const isZhText = (currentLanguage || DEFAULT_LANGUAGE) === "zh"; // UI 文案
  const isZh = isZhText;
  const isSignup = mode === "signup";
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleTabChange = (val: Mode) => {
    const target =
      val === "signup"
        ? `/auth/sign-up${next ? `?next=${encodeURIComponent(next)}` : ""}`
        : `/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;
    router.push(target);
  };

  const handleGoogle = async () => {
    if (isDomestic) return;
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isZhText
            ? "发生错误，请稍后重试"
            : "An error occurred"
      );
      setIsLoading(false);
    }
  };

  const handleWechat = async () => {
    if (!isDomestic) return;
    setIsLoading(true);
    setError(null);
    try {
      const qs = next ? `?next=${encodeURIComponent(next)}` : "";
      const res = await fetch(`/api/auth/wechat/qrcode${qs}`);
      const data = await res.json();
      if (!res.ok || !data.qrcodeUrl) {
        throw new Error(data.error || (isZhText ? "微信登录失败" : "WeChat login failed"));
      }
      window.location.href = data.qrcodeUrl as string;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isZhText
            ? "微信登录失败，请稍后再试"
            : "WeChat login failed. Please try again."
      );
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        if (form.password !== form.confirm) {
          setError(isZhText ? "两次密码不一致" : "Passwords do not match");
          setIsLoading(false);
          return;
        }

        if (isDomestic) {
          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email, password: form.password, name: form.name }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || (isZhText ? "注册失败" : "Sign up failed"));
          }
          router.push("/auth/login");
        } else {
          const { error } = await supabase.auth.signUp({
            email: form.email,
            password: form.password,
            options: {
              data: { full_name: form.name },
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            },
          });
          if (error) throw error;
          router.push("/auth/sign-up-success");
        }
      } else {
        if (isDomestic) {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email, password: form.password }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || (isZhText ? "登录失败" : "Login failed"));
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email: form.email,
            password: form.password,
          });
          if (error) throw error;
        }
        router.push(next);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isZhText
            ? "发生错误，请稍后重试"
            : "An error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-5xl">
        <div className="mb-8 text-center space-y-2">
          <p className="inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-1.5 text-xs text-slate-200">
            {isSignup ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            {isZhText ? "邮箱认证 · 安全快捷" : "Email · Secure · or Google"}
          </p>
          <h1 className="text-3xl font-semibold">
            {isSignup
              ? isZhText
                ? "创建账号"
                : "Create your account"
              : isZhText
                ? "欢迎回来"
                : "Welcome back"}
          </h1>
          <p className="text-slate-300">
            {isZhText
              ? "在任意设备同步对话与配置，邮箱登录始终可用。"
              : "Sign in with email or continue with Google."}
          </p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur border border-white/10 rounded-3xl shadow-2xl p-2">
          <div className="bg-slate-900/60 rounded-2xl border border-white/10 p-6">
            <Tabs value={mode} onValueChange={(v) => handleTabChange(v as Mode)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">
                  {isZhText ? "登录" : "Sign in"}
                </TabsTrigger>
                <TabsTrigger value="signup">
                  {isZhText ? "注册" : "Sign up"}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="pt-6">
                <div className="grid md:grid-cols-[1.2fr,0.8fr] gap-8">
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                      <Label className="text-slate-200">{isZhText ? "邮箱" : "Email"}</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder={isZhText ? "邮箱@example.com" : "you@example.com"}
                        className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Label className="text-slate-200">{isZhText ? "密码" : "Password"}</Label>
                        {!isDomestic && (
                          <Link
                            href="/auth/forgot-password"
                            className="ml-auto text-xs text-blue-200 hover:text-blue-100"
                          >
                            {isZhText ? "忘记密码？" : "Forgot password?"}
                          </Link>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500 pr-10"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-200"
                          onClick={() => setShowPassword((v) => !v)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {error && <p className="text-sm text-red-400">{error}</p>}

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading
                        ? isZhText
                          ? "登录中..."
                          : "Signing in..."
                        : isZhText
                          ? "登录"
                          : "Sign in"}
                    </Button>

                    <>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-slate-900/60 px-2 text-slate-400">
                            {isZhText ? "或" : "or"}
                          </span>
                        </div>
                      </div>

                      {isDomestic ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full bg-white text-slate-900 hover:bg-slate-100"
                          disabled={isLoading}
                          onClick={handleWechat}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            className="mr-2 h-5 w-5"
                            fill="currentColor"
                          >
                            <path d="M5.5 4C2.46 4 0 6.24 0 8.99c0 2 1.33 3.74 3.3 4.62-.12.45-.76 2.8-.79 3.02 0 0-.02.17.09.24.11.07.24.02.24.02.32-.05 3.04-1.99 3.47-2.31.4.06.8.09 1.19.09 3.04 0 5.5-2.23 5.5-4.99C13 6.24 10.54 4 7.5 4h-2Zm12 4c-2.49 0-4.5 1.8-4.5 4.02 0 1.34.7 2.53 1.78 3.31-.09.36-.53 2.04-.55 2.2 0 0-.02.13.07.19.09.06.2.02.2.02.26-.04 2.45-1.6 2.8-1.85.32.05.65.07.97.07 2.49 0 4.5-1.8 4.5-4.02C22 9.8 19.99 8 17.5 8Z" />
                          </svg>
                          {isZhText ? "使用微信登录" : "Continue with WeChat"}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full bg-white text-slate-900 hover:bg-slate-100"
                          disabled={isLoading}
                          onClick={handleGoogle}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 488 512"
                            className="mr-2 h-4 w-4"
                            fill="currentColor"
                          >
                            <path d="M488 261.8C488 403.3 391.1 504 248.4 504 111 504 0 393 0 255.5 0 118 111 7 248.4 7c66.8 0 123 24.5 166.3 64.9l-67.4 64.9C297 99.6 278.5 92 248.4 92c-86.2 0-156 70.9-156 163.5 0 92.6 69.8 163.5 156 163.5 99.5 0 136.8-71.6 142.6-108.9H248.4v-87.8h239.4c2.2 12.7 4.2 24.9 4.2 41.5z" />
                          </svg>
                          {isZhText ? "使用 Google 登录" : "Continue with Google"}
                        </Button>
                      )}
                    </>

                    <p className="text-sm text-slate-300 text-center">
                      {isZhText ? "没有账号？" : "Need an account?"}{" "}
                      <Link href={`/auth/sign-up${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-blue-200 hover:text-blue-100">
                        {isZhText ? "去注册" : "Sign up"}
                      </Link>
                    </p>
                  </form>

                  <div className="hidden md:flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200">
                    <div className="font-semibold text-white">
                      {isZh ? "登录提示" : "Tips"}
                    </div>
                    <p className="text-slate-300">
                      {isZh
                        ? "使用邮箱登录在任何语言环境下都可用；切换到英文版可解锁 Google 登录。"
                        : "Email sign-in always works. Switch to English build (NEXT_PUBLIC_DEFAULT_LANGUAGE=en) to enable Google."}
                    </p>
                    <p className="text-slate-400">
                      {isZh ? "完成登录后会跳转到上次访问的页面。" : "After signing in you'll return to where you left off."}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="signup" className="pt-6">
                <div className="grid md:grid-cols-[1.2fr,0.8fr] gap-8">
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                      <Label className="text-slate-200">{isZh ? "姓名" : "Name"}</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder={isZh ? "张三" : "Jane Doe"}
                        className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-200">{isZh ? "邮箱" : "Email"}</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder={isZh ? "邮箱@example.com" : "you@example.com"}
                        className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-200">{isZh ? "密码" : "Password"}</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500 pr-10"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-200"
                          onClick={() => setShowPassword((v) => !v)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-200">{isZh ? "确认密码" : "Confirm password"}</Label>
                      <div className="relative">
                        <Input
                          type={showConfirm ? "text" : "password"}
                          value={form.confirm}
                          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                          className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500 pr-10"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-200"
                          onClick={() => setShowConfirm((v) => !v)}
                        >
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {error && <p className="text-sm text-red-400">{error}</p>}

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading
                        ? isZh
                          ? "处理中..."
                          : "Working..."
                        : isZh
                          ? "注册"
                          : "Sign up"}
                    </Button>

                    <>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-slate-900/60 px-2 text-slate-400">
                            {isZh ? "或" : "or"}
                          </span>
                        </div>
                      </div>

                      {isDomestic ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full bg-white text-slate-900 hover:bg-slate-100"
                          disabled={isLoading}
                          onClick={handleWechat}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            className="mr-2 h-5 w-5"
                            fill="currentColor"
                          >
                            <path d="M5.5 4C2.46 4 0 6.24 0 8.99c0 2 1.33 3.74 3.3 4.62-.12.45-.76 2.8-.79 3.02 0 0-.02.17.09.24.11.07.24.02.24.02.32-.05 3.04-1.99 3.47-2.31.4.06.8.09 1.19.09 3.04 0 5.5-2.23 5.5-4.99C13 6.24 10.54 4 7.5 4h-2Zm12 4c-2.49 0-4.5 1.8-4.5 4.02 0 1.34.7 2.53 1.78 3.31-.09.36-.53 2.04-.55 2.2 0 0-.02.13.07.19.09.06.2.02.2.02.26-.04 2.45-1.6 2.8-1.85.32.05.65.07.97.07 2.49 0 4.5-1.8 4.5-4.02C22 9.8 19.99 8 17.5 8Z" />
                          </svg>
                          {isZh ? "使用微信登录" : "Continue with WeChat"}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full bg-white text-slate-900 hover:bg-slate-100"
                          disabled={isLoading}
                          onClick={handleGoogle}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 488 512"
                            className="mr-2 h-4 w-4"
                            fill="currentColor"
                          >
                            <path d="M488 261.8C488 403.3 391.1 504 248.4 504 111 504 0 393 0 255.5 0 118 111 7 248.4 7c66.8 0 123 24.5 166.3 64.9l-67.4 64.9C297 99.6 278.5 92 248.4 92c-86.2 0-156 70.9-156 163.5 0 92.6 69.8 163.5 156 163.5 99.5 0 136.8-71.6 142.6-108.9H248.4v-87.8h239.4c2.2 12.7 4.2 24.9 4.2 41.5z" />
                          </svg>
                          {isZh ? "使用 Google 登录" : "Continue with Google"}
                        </Button>
                      )}
                    </>

                    <p className="text-sm text-slate-300 text-center">
                      {isZh ? "已有账号？" : "Already have an account?"}{" "}
                      <Link href={`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-blue-200 hover:text-blue-100">
                        {isZh ? "去登录" : "Sign in"}
                      </Link>
                    </p>
                  </form>

                  <div className="hidden md:flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200">
                    <div className="font-semibold text-white">
                      {isZh ? "注册须知" : "Registration notes"}
                    </div>
                    <p className="text-slate-300">
                      {isZh
                        ? "完成注册后会发送验证邮件，请注意查收。"
                        : "We’ll email you a verification link after sign-up."}
                    </p>
                    <p className="text-slate-400">
                      {isZh
                        ? "英文版可使用 Google 登录；中文版保持邮箱注册以符合国内策略。"
                        : "Google sign-up is available only when DEFAULT_LANGUAGE=en; Chinese build stays email-only."}
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
