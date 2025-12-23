"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { DEFAULT_LANGUAGE } from "@/config";
import { signInWithGoogle } from "@/actions/oauth";
import { PrivacyPolicyContent } from "@/components/legal";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter();
  const { currentLanguage, isDomesticVersion } = useLanguage();
  const isDomestic = isDomesticVersion;
  const isZhText = (currentLanguage || DEFAULT_LANGUAGE) === "zh";
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);

  const handleOAuth = async () => {
    if (isDomestic) return;
    setIsLoading(true);
    setError(null);
    try {
      // 使用 Server Action 启动 OAuth（Supabase 官方推荐方式）
      await signInWithGoogle("/");
    } catch (err: unknown) {
      // Server Action 中的 redirect() 会抛出 NEXT_REDIRECT 错误，这是正常行为
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
        return;
      }
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError(isZhText ? "两次密码不一致" : "Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      if (isDomestic) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password, name: null }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.error || (isZhText ? "注册失败" : "Sign up failed"),
          );
        }
        if (data.token) {
          localStorage.setItem("auth-token", data.token);
          document.cookie = `auth-token=${data.token}; path=/; max-age=604800`;
        }
        window.location.href = "/";
      } else {
        console.info("[SignUpForm] EN signup start", { email });
        const confirmRedirectTo = new URL("/auth/confirm", window.location.origin);
        confirmRedirectTo.searchParams.set("next", "/");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: confirmRedirectTo.toString(),
          },
        });
        if (error) {
          console.error("[SignUpForm] EN signup error", error);
          throw error;
        }
        console.info("[SignUpForm] EN signup success, redirecting to success page");
        router.push("/auth/sign-up-success");
      }
    } catch (err: unknown) {
      console.error("[SignUpForm] signup exception", err);
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
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {isZhText ? "注册" : "Sign up"}
          </CardTitle>
          <CardDescription>
            {isZhText ? "创建新账号以开始对话" : "Create a new account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">{isZhText ? "邮箱" : "Email"}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">{isZhText ? "密码" : "Password"}</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="repeat-password">
                  {isZhText ? "确认密码" : "Repeat Password"}
                </Label>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}

              {/* 隐私条款确认 */}
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="agree-privacy-signup"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="agree-privacy-signup" className="text-sm text-gray-600 dark:text-gray-400">
                  {isZhText ? "我已阅读并同意" : "I have read and agree to the "}
                  <button
                    type="button"
                    onClick={() => setShowPrivacyDialog(true)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                  >
                    {isZhText ? "《隐私条款》" : "Privacy Policy"}
                  </button>
                </label>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !agreePrivacy}>
                {isLoading
                  ? isZhText
                    ? "创建中..."
                    : "Creating..."
                  : isZhText
                    ? "注册"
                    : "Sign up"}
              </Button>
              {!isDomestic && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isLoading || !agreePrivacy}
                  onClick={handleOAuth}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 488 512"
                    className="mr-2 h-4 w-4"
                    fill="currentColor"
                  >
                    <path d="M488 261.8C488 403.3 391.1 504 248.4 504 111 504 0 393 0 255.5 0 118 111 7 248.4 7c66.8 0 123 24.5 166.3 64.9l-67.4 64.9C297 99.6 278.5 92 248.4 92c-86.2 0-156 70.9-156 163.5 0 92.6 69.8 163.5 156 163.5 99.5 0 136.8-71.6 142.6-108.9H248.4v-87.8h239.4c2.2 12.7 4.2 24.9 4.2 41.5z" />
                  </svg>
                  Continue with Google
                </Button>
              )}
            </div>
            <div className="mt-4 text-center text-sm">
              {isZhText ? "已有账号？" : "Already have an account?"}{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                {isZhText ? "去登录" : "Login"}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 隐私条款弹窗 */}
      <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl p-0 border-0 shadow-2xl">
          {/* 装饰性背景 */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-white to-purple-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-400/10 to-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-br from-emerald-400/10 to-teal-500/10 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col h-full max-h-[85vh]">
            <DialogHeader className="px-6 py-4 border-b border-gray-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex-shrink-0">
              <DialogTitle className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/25">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span>{isZhText ? "隐私条款" : "Privacy Policy"}</span>
              </DialogTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-12">
                {isZhText ? "请仔细阅读以下条款" : "Please read the following terms carefully"}
              </p>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4 bg-white/50 dark:bg-slate-800/50">
              <PrivacyPolicyContent isDomestic={isDomestic} />
            </div>

            <div className="px-6 py-4 border-t border-gray-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex-shrink-0">
              <button
                onClick={() => setShowPrivacyDialog(false)}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 hover:-translate-y-0.5"
              >
                {isZhText ? "我已阅读" : "I have read"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
