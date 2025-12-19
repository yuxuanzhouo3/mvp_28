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
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { DEFAULT_LANGUAGE } from "@/config";

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

  const handleOAuth = async () => {
    if (isDomestic) return;
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Use implicit flow to avoid PKCE verifier issues
          flowType: "implicit",
          redirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
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
              <Button type="submit" className="w-full" disabled={isLoading}>
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
                  disabled={isLoading}
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
    </div>
  );
}
