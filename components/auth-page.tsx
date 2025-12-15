"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DEFAULT_LANGUAGE } from "@/config";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Eye, 
  EyeOff, 
  LogIn, 
  UserPlus, 
  Loader2, 
  Mail, 
  Lock, 
  User, 
  Sparkles,
  Shield,
  Zap,
  Globe,
  CheckCircle2
} from "lucide-react";

type Mode = "login" | "signup";

// 动画粒子组件
const FloatingParticles = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 bg-gradient-to-r from-blue-400/30 to-purple-400/30 rounded-full animate-float"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${5 + Math.random() * 10}s`,
          }}
        />
      ))}
    </div>
  );
};

// 功能亮点卡片
const FeatureCard = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
  <div className="flex items-start space-x-3 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300">
    <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
      <Icon className="w-4 h-4 text-blue-400" />
    </div>
    <div>
      <h4 className="text-sm font-medium text-white">{title}</h4>
      <p className="text-xs text-slate-400 mt-0.5">{description}</p>
    </div>
  </div>
);

export function AuthPage({ mode }: { mode: Mode }) {
  const { currentLanguage, isDomesticVersion } = useLanguage();
  const isDomestic = isDomesticVersion;
  const isZhText = (currentLanguage || DEFAULT_LANGUAGE) === "zh";
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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isWechatLoading, setIsWechatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // 清除成功消息
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleTabChange = (val: Mode) => {
    setError(null);
    setSuccess(null);
    const target =
      val === "signup"
        ? `/auth/sign-up${next ? `?next=${encodeURIComponent(next)}` : ""}`
        : `/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;
    router.push(target);
  };

  const handleGoogle = async () => {
    if (isDomestic) return;
    setIsGoogleLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isZhText
            ? "Google 登录失败，请稍后重试"
            : "Google login failed. Please try again."
      );
      setIsGoogleLoading(false);
    }
  };

  const handleWechat = async () => {
    if (!isDomestic) return;
    setIsWechatLoading(true);
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
      setIsWechatLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === "signup") {
        if (form.password !== form.confirm) {
          setError(isZhText ? "两次密码不一致" : "Passwords do not match");
          setIsLoading(false);
          return;
        }

        if (form.password.length < 6) {
          setError(isZhText ? "密码至少需要6个字符" : "Password must be at least 6 characters");
          setIsLoading(false);
          return;
        }

        if (isDomestic) {
          const check = await fetch("/api/auth/check-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email }),
          });
          const checkData = await check.json();
          if (check.ok && checkData.exists) {
            setError(isZhText ? "该邮箱已被注册，请直接登录" : "This email is already registered. Please sign in instead.");
            setIsLoading(false);
            return;
          }

          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email, password: form.password, name: form.name }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || (isZhText ? "注册失败" : "Sign up failed"));
          }
          setSuccess(isZhText ? "注册成功！正在跳转..." : "Registration successful! Redirecting...");
          setTimeout(() => router.push("/auth/login"), 1500);
        } else {
          const { data, error } = await supabase.auth.signUp({
            email: form.email,
            password: form.password,
            options: {
              data: { full_name: form.name },
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            },
          });
          if (error) {
            if (error.message.includes("already registered")) {
              throw new Error(isZhText ? "该邮箱已被注册，请直接登录" : "This email is already registered. Please sign in instead.");
            }
            if (error.message.includes("Password")) {
              throw new Error(isZhText ? "密码不符合要求，至少需要6个字符" : "Password must be at least 6 characters.");
            }
            throw error;
          }
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
          const { data, error } = await supabase.auth.signInWithPassword({
            email: form.email,
            password: form.password,
          });
          if (error) {
            if (error.message.includes("Invalid login credentials")) {
              throw new Error(isZhText ? "邮箱或密码错误" : "Invalid email or password.");
            }
            if (error.message.includes("Email not confirmed")) {
              throw new Error(isZhText ? "请先验证您的邮箱" : "Please verify your email first.");
            }
            throw error;
          }
        }
        setSuccess(isZhText ? "登录成功！正在跳转..." : "Login successful! Redirecting...");
        setTimeout(() => router.push(next), 800);
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

  const features = isZh
    ? [
        { icon: Sparkles, title: "AI 驱动", description: "多模型支持，智能对话" },
        { icon: Shield, title: "安全可靠", description: "数据加密，隐私保护" },
        { icon: Zap, title: "极速响应", description: "毫秒级延迟，流畅体验" },
        { icon: Globe, title: "全球可用", description: "多语言支持，随时随地" },
      ]
    : [
        { icon: Sparkles, title: "AI Powered", description: "Multiple models, smart conversations" },
        { icon: Shield, title: "Secure", description: "Encrypted data, privacy first" },
        { icon: Zap, title: "Fast", description: "Low latency, smooth experience" },
        { icon: Globe, title: "Global", description: "Multi-language, anywhere access" },
      ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* 背景装饰 */}
      <FloatingParticles />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

      <div className="w-full max-w-5xl relative z-10">
        {/* Logo 和标题 */}
        <div className="mb-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur-xl opacity-50" />
              <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-2xl shadow-2xl">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
          
          <div className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-white/10 px-5 py-2 text-sm text-slate-200 backdrop-blur-sm">
            {isSignup ? <UserPlus className="h-4 w-4 text-blue-400" /> : <LogIn className="h-4 w-4 text-blue-400" />}
            {isZhText ? "邮箱认证 · 安全快捷" : "Secure Authentication"}
          </div>
          
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
            {isSignup
              ? isZhText ? "创建您的账号" : "Create Your Account"
              : isZhText ? "欢迎回到 MornGPT" : "Welcome Back to MornGPT"}
          </h1>
          
          <p className="text-slate-400 max-w-md mx-auto">
            {isZhText
              ? "在任意设备同步对话与配置，开启智能对话新体验。"
              : "Sync your conversations across devices. Start your AI journey today."}
          </p>
        </div>

        {/* 主卡片 */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur-xl" />
          <div className="relative bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 p-1">
              <div className="bg-slate-900/90 rounded-[22px] p-6 md:p-8">
                <Tabs value={mode} onValueChange={(v) => handleTabChange(v as Mode)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 p-1 rounded-xl">
                    <TabsTrigger 
                      value="login"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-lg transition-all duration-300"
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      {isZhText ? "登录" : "Sign in"}
                    </TabsTrigger>
                    <TabsTrigger 
                      value="signup"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg transition-all duration-300"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      {isZhText ? "注册" : "Sign up"}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="pt-8">
                    <div className="grid md:grid-cols-[1.2fr,0.8fr] gap-8">
                      <form className="space-y-5" onSubmit={handleSubmit}>
                        {/* Email Field */}
                        <div className="space-y-2">
                          <Label className="text-slate-200 flex items-center gap-2">
                            <Mail className="w-4 h-4 text-blue-400" />
                            {isZhText ? "邮箱" : "Email"}
                          </Label>
                          <div className={`relative transition-all duration-300 ${focusedField === 'email' ? 'scale-[1.02]' : ''}`}>
                            <Input
                              type="email"
                              value={form.email}
                              onChange={(e) => setForm({ ...form, email: e.target.value })}
                              onFocus={() => setFocusedField('email')}
                              onBlur={() => setFocusedField(null)}
                              placeholder={isZhText ? "请输入邮箱" : "you@example.com"}
                              className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 h-12 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300"
                              required
                            />
                          </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-slate-200 flex items-center gap-2">
                              <Lock className="w-4 h-4 text-blue-400" />
                              {isZhText ? "密码" : "Password"}
                            </Label>
                            {!isDomestic && (
                              <Link
                                href="/auth/forgot-password"
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                {isZhText ? "忘记密码？" : "Forgot password?"}
                              </Link>
                            )}
                          </div>
                          <div className={`relative transition-all duration-300 ${focusedField === 'password' ? 'scale-[1.02]' : ''}`}>
                            <Input
                              type={showPassword ? "text" : "password"}
                              value={form.password}
                              onChange={(e) => setForm({ ...form, password: e.target.value })}
                              onFocus={() => setFocusedField('password')}
                              onBlur={() => setFocusedField(null)}
                              className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 h-12 rounded-xl pr-12 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300"
                              required
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                              onClick={() => setShowPassword((v) => !v)}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        {/* Error/Success Messages */}
                        {error && (
                          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2 animate-shake">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            {error}
                          </div>
                        )}
                        {success && (
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            {success}
                          </div>
                        )}

                        {/* Submit Button */}
                        <Button 
                          type="submit" 
                          className="w-full h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02]" 
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>{isZhText ? "登录中..." : "Signing in..."}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <LogIn className="h-5 w-5" />
                              <span>{isZhText ? "登录" : "Sign in"}</span>
                            </div>
                          )}
                        </Button>

                        {/* Divider */}
                        <div className="relative py-2">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-slate-700" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-slate-900/90 px-4 text-slate-500">
                              {isZhText ? "或使用" : "or continue with"}
                            </span>
                          </div>
                        </div>

                        {/* Social Login */}
                        {isDomestic ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full h-12 bg-[#00c060] hover:bg-[#00a654] text-white border-none rounded-xl font-medium transition-all duration-300 hover:scale-[1.02]"
                            disabled={isWechatLoading}
                            onClick={handleWechat}
                          >
                            {isWechatLoading ? (
                              <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                className="mr-2 h-5 w-5"
                                fill="currentColor"
                              >
                                <path d="M5.5 4C2.46 4 0 6.24 0 8.99c0 2 1.33 3.74 3.3 4.62-.12.45-.76 2.8-.79 3.02 0 0-.02.17.09.24.11.07.24.02.24.02.32-.05 3.04-1.99 3.47-2.31.4.06.8.09 1.19.09 3.04 0 5.5-2.23 5.5-4.99C13 6.24 10.54 4 7.5 4h-2Zm12 4c-2.49 0-4.5 1.8-4.5 4.02 0 1.34.7 2.53 1.78 3.31-.09.36-.53 2.04-.55 2.2 0 0-.02.13.07.19.09.06.2.02.2.02.26-.04 2.45-1.6 2.8-1.85.32.05.65.07.97.07 2.49 0 4.5-1.8 4.5-4.02C22 9.8 19.99 8 17.5 8Z" />
                              </svg>
                            )}
                            {isZhText ? "微信登录" : "WeChat"}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full h-12 bg-white hover:bg-slate-100 text-slate-900 border-none rounded-xl font-medium transition-all duration-300 hover:scale-[1.02]"
                            disabled={isGoogleLoading}
                            onClick={handleGoogle}
                          >
                            {isGoogleLoading ? (
                              <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 488 512"
                                className="mr-2 h-4 w-4"
                                fill="currentColor"
                              >
                                <path d="M488 261.8C488 403.3 391.1 504 248.4 504 111 504 0 393 0 255.5 0 118 111 7 248.4 7c66.8 0 123 24.5 166.3 64.9l-67.4 64.9C297 99.6 278.5 92 248.4 92c-86.2 0-156 70.9-156 163.5 0 92.6 69.8 163.5 156 163.5 99.5 0 136.8-71.6 142.6-108.9H248.4v-87.8h239.4c2.2 12.7 4.2 24.9 4.2 41.5z" />
                              </svg>
                            )}
                            Google
                          </Button>
                        )}

                        {/* Sign up link */}
                        <p className="text-sm text-slate-400 text-center pt-2">
                          {isZhText ? "没有账号？" : "Need an account?"}{" "}
                          <Link 
                            href={`/auth/sign-up${next ? `?next=${encodeURIComponent(next)}` : ""}`} 
                            className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                          >
                            {isZhText ? "立即注册" : "Sign up"}
                          </Link>
                        </p>
                      </form>

                      {/* Features sidebar */}
                      <div className="hidden md:flex flex-col gap-3">
                        <h3 className="text-lg font-semibold text-white mb-2">
                          {isZh ? "为什么选择 MornGPT?" : "Why MornGPT?"}
                        </h3>
                        {features.map((feature, idx) => (
                          <FeatureCard key={idx} {...feature} />
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="signup" className="pt-8">
                    <div className="grid md:grid-cols-[1.2fr,0.8fr] gap-8">
                      <form className="space-y-4" onSubmit={handleSubmit}>
                        {/* Name Field */}
                        <div className="space-y-2">
                          <Label className="text-slate-200 flex items-center gap-2">
                            <User className="w-4 h-4 text-purple-400" />
                            {isZh ? "姓名" : "Name"}
                          </Label>
                          <div className={`relative transition-all duration-300 ${focusedField === 'name' ? 'scale-[1.02]' : ''}`}>
                            <Input
                              value={form.name}
                              onChange={(e) => setForm({ ...form, name: e.target.value })}
                              onFocus={() => setFocusedField('name')}
                              onBlur={() => setFocusedField(null)}
                              placeholder={isZh ? "请输入姓名" : "Your name"}
                              className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 h-12 rounded-xl focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300"
                              required
                            />
                          </div>
                        </div>

                        {/* Email Field */}
                        <div className="space-y-2">
                          <Label className="text-slate-200 flex items-center gap-2">
                            <Mail className="w-4 h-4 text-purple-400" />
                            {isZh ? "邮箱" : "Email"}
                          </Label>
                          <div className={`relative transition-all duration-300 ${focusedField === 'signup-email' ? 'scale-[1.02]' : ''}`}>
                            <Input
                              type="email"
                              value={form.email}
                              onChange={(e) => setForm({ ...form, email: e.target.value })}
                              onFocus={() => setFocusedField('signup-email')}
                              onBlur={() => setFocusedField(null)}
                              placeholder={isZh ? "请输入邮箱" : "you@example.com"}
                              className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 h-12 rounded-xl focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300"
                              required
                            />
                          </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-2">
                          <Label className="text-slate-200 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-purple-400" />
                            {isZh ? "密码" : "Password"}
                          </Label>
                          <div className={`relative transition-all duration-300 ${focusedField === 'signup-password' ? 'scale-[1.02]' : ''}`}>
                            <Input
                              type={showPassword ? "text" : "password"}
                              value={form.password}
                              onChange={(e) => setForm({ ...form, password: e.target.value })}
                              onFocus={() => setFocusedField('signup-password')}
                              onBlur={() => setFocusedField(null)}
                              placeholder={isZh ? "至少6个字符" : "At least 6 characters"}
                              className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 h-12 rounded-xl pr-12 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300"
                              required
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                              onClick={() => setShowPassword((v) => !v)}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        {/* Confirm Password Field */}
                        <div className="space-y-2">
                          <Label className="text-slate-200 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-purple-400" />
                            {isZh ? "确认密码" : "Confirm password"}
                          </Label>
                          <div className={`relative transition-all duration-300 ${focusedField === 'confirm' ? 'scale-[1.02]' : ''}`}>
                            <Input
                              type={showConfirm ? "text" : "password"}
                              value={form.confirm}
                              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                              onFocus={() => setFocusedField('confirm')}
                              onBlur={() => setFocusedField(null)}
                              placeholder={isZh ? "再次输入密码" : "Re-enter password"}
                              className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 h-12 rounded-xl pr-12 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300"
                              required
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                              onClick={() => setShowConfirm((v) => !v)}
                            >
                              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        {/* Error/Success Messages */}
                        {error && (
                          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2 animate-shake">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            {error}
                          </div>
                        )}
                        {success && (
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            {success}
                          </div>
                        )}

                        {/* Submit Button */}
                        <Button 
                          type="submit" 
                          className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-purple-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02]" 
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>{isZh ? "注册中..." : "Creating account..."}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <UserPlus className="h-5 w-5" />
                              <span>{isZh ? "创建账号" : "Create account"}</span>
                            </div>
                          )}
                        </Button>

                        {/* Divider */}
                        <div className="relative py-2">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-slate-700" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-slate-900/90 px-4 text-slate-500">
                              {isZh ? "或使用" : "or continue with"}
                            </span>
                          </div>
                        </div>

                        {/* Social Login */}
                        {isDomestic ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full h-12 bg-[#00c060] hover:bg-[#00a654] text-white border-none rounded-xl font-medium transition-all duration-300 hover:scale-[1.02]"
                            disabled={isWechatLoading}
                            onClick={handleWechat}
                          >
                            {isWechatLoading ? (
                              <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                className="mr-2 h-5 w-5"
                                fill="currentColor"
                              >
                                <path d="M5.5 4C2.46 4 0 6.24 0 8.99c0 2 1.33 3.74 3.3 4.62-.12.45-.76 2.8-.79 3.02 0 0-.02.17.09.24.11.07.24.02.24.02.32-.05 3.04-1.99 3.47-2.31.4.06.8.09 1.19.09 3.04 0 5.5-2.23 5.5-4.99C13 6.24 10.54 4 7.5 4h-2Zm12 4c-2.49 0-4.5 1.8-4.5 4.02 0 1.34.7 2.53 1.78 3.31-.09.36-.53 2.04-.55 2.2 0 0-.02.13.07.19.09.06.2.02.2.02.26-.04 2.45-1.6 2.8-1.85.32.05.65.07.97.07 2.49 0 4.5-1.8 4.5-4.02C22 9.8 19.99 8 17.5 8Z" />
                              </svg>
                            )}
                            {isZh ? "微信登录" : "WeChat"}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full h-12 bg-white hover:bg-slate-100 text-slate-900 border-none rounded-xl font-medium transition-all duration-300 hover:scale-[1.02]"
                            disabled={isGoogleLoading}
                            onClick={handleGoogle}
                          >
                            {isGoogleLoading ? (
                              <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 488 512"
                                className="mr-2 h-4 w-4"
                                fill="currentColor"
                              >
                                <path d="M488 261.8C488 403.3 391.1 504 248.4 504 111 504 0 393 0 255.5 0 118 111 7 248.4 7c66.8 0 123 24.5 166.3 64.9l-67.4 64.9C297 99.6 278.5 92 248.4 92c-86.2 0-156 70.9-156 163.5 0 92.6 69.8 163.5 156 163.5 99.5 0 136.8-71.6 142.6-108.9H248.4v-87.8h239.4c2.2 12.7 4.2 24.9 4.2 41.5z" />
                              </svg>
                            )}
                            Google
                          </Button>
                        )}

                        {/* Sign in link */}
                        <p className="text-sm text-slate-400 text-center pt-2">
                          {isZh ? "已有账号？" : "Already have an account?"}{" "}
                          <Link 
                            href={`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} 
                            className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                          >
                            {isZh ? "立即登录" : "Sign in"}
                          </Link>
                        </p>
                      </form>

                      {/* Features sidebar */}
                      <div className="hidden md:flex flex-col gap-3">
                        <h3 className="text-lg font-semibold text-white mb-2">
                          {isZh ? "注册即可获得" : "Get started with"}
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-white/10">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <span className="text-sm text-slate-200">{isZh ? "每日免费对话额度" : "Daily free conversation quota"}</span>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-white/10">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <span className="text-sm text-slate-200">{isZh ? "多设备同步" : "Multi-device sync"}</span>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-white/10">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <span className="text-sm text-slate-200">{isZh ? "对话历史云存储" : "Cloud conversation history"}</span>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-white/10">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <span className="text-sm text-slate-200">{isZh ? "访问所有基础模型" : "Access to all basic models"}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          {isZh 
                            ? "注册后会发送验证邮件，请注意查收。" 
                            : "A verification email will be sent after registration."}
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 mt-6">
          {isZh 
            ? "注册即表示您同意我们的服务条款和隐私政策" 
            : "By signing up, you agree to our Terms of Service and Privacy Policy"}
        </p>
      </div>

      {/* CSS for animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.3; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.6; }
        }
        .animate-float {
          animation: float 10s ease-in-out infinite;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}
