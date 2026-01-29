import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, UserPlus, Lock, Eye, EyeOff, Mail, User, Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { PrivacyPolicyContent } from "@/components/legal";
import { useIsIOSMobile } from "@/hooks";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authMode: "login" | "signup" | "reset";
  setAuthMode: (mode: "login" | "signup" | "reset") => void;
  authForm: {
    name: string;
    email: string;
    password: string;
  };
  setAuthForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      email: string;
      password: string;
    }>
  >;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  handleAuth: (e: React.FormEvent) => void;
  handleGoogleAuth: () => void;
  handleWechatAuth?: () => void;
  isMobile?: boolean; // 移动端标识，用于隐藏微信登录按钮
}

export const AuthDialog: React.FC<AuthDialogProps> = ({
  open,
  onOpenChange,
  authMode,
  setAuthMode,
  authForm,
  setAuthForm,
  showPassword,
  setShowPassword,
  handleAuth,
  handleGoogleAuth,
  handleWechatAuth,
  isMobile = false,
}) => {
  const { currentLanguage, isDomesticVersion } = useLanguage();
  const isIOSMobile = useIsIOSMobile();
  const isZh = currentLanguage === "zh";
  const isDomestic = isDomesticVersion;

  // 国内版显示微信登录按钮（iOS移动端隐藏，其他设备显示）
  const shouldShowWechatLogin = isDomestic && !isIOSMobile;

  // 国际版显示谷歌登录按钮（iOS移动端隐藏，其他设备显示）
  const shouldShowGoogleLogin = !isDomestic && !isIOSMobile;

  // 国内版移动端品牌名
  const brandName = isDomestic && isMobile ? "晨佑 AI" : "MornGPT";

  // 隐私条款确认状态
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-[#0f1015] dark:via-[#14151a] dark:to-[#0f1015] border-0 p-0 overflow-hidden shadow-2xl rounded-2xl sm:rounded-3xl">
        {/* 装饰性背景 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-blue-400/10 to-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-gradient-to-br from-emerald-400/10 to-teal-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 p-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center justify-center space-x-3 text-xl font-bold">
              <div className={`p-2.5 rounded-xl shadow-lg ${
                authMode === "login"
                  ? "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/25"
                  : authMode === "signup"
                    ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25"
                    : "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/25"
              }`}>
                {authMode === "login" ? (
                  <LogIn className="w-5 h-5 text-white" />
                ) : authMode === "signup" ? (
                  <UserPlus className="w-5 h-5 text-white" />
                ) : (
                  <Lock className="w-5 h-5 text-white" />
                )}
              </div>
              <span className="text-gray-900 dark:text-white font-bold">
                {authMode === "login"
                  ? isZh
                    ? "欢迎回来"
                    : "Welcome Back"
                  : authMode === "signup"
                    ? isZh
                      ? `加入 ${brandName}`
                      : `Join ${brandName}`
                    : isZh
                      ? "重置密码"
                      : "Reset Password"}
              </span>
            </DialogTitle>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
              {authMode === "login"
                ? isZh
                  ? "登录您的账户继续探索 AI 的无限可能"
                  : "Sign in to continue exploring AI possibilities"
                : authMode === "signup"
                  ? isZh
                    ? "创建账户，开启智能对话之旅"
                    : "Create an account to start your AI journey"
                  : isZh
                    ? "输入您的邮箱，我们将发送重置链接"
                    : "Enter your email to receive a reset link"}
            </p>
          </DialogHeader>

          {/* 隐私条款确认 */}
          <div className="flex items-start gap-2 mb-4 px-1">
            <input
              type="checkbox"
              id="agree-privacy-auth"
              checked={agreePrivacy}
              onChange={(e) => setAgreePrivacy(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="agree-privacy-auth" className="text-sm text-gray-600 dark:text-gray-400">
              {isZh ? "我已阅读并同意" : "I have read and agree to the "}
              <button
                type="button"
                onClick={() => setShowPrivacyDialog(true)}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
              >
                {isZh ? "《隐私条款》" : "Privacy Policy"}
              </button>
            </label>
          </div>

          {authMode !== "reset" && (
            <>
              {shouldShowWechatLogin ? (
                <Button
                  onClick={handleWechatAuth}
                  disabled={!agreePrivacy}
                  className={`w-full flex items-center justify-center space-x-2 mb-4 h-11 bg-gradient-to-r from-[#07c160] to-[#00a654] hover:from-[#06ad56] hover:to-[#009549] text-white border-none shadow-lg shadow-green-500/20 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/30 hover:-translate-y-0.5 ${!agreePrivacy ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M5.5 4C2.46 4 0 6.24 0 8.99c0 2 1.33 3.74 3.3 4.62-.12.45-.76 2.8-.79 3.02 0 0-.02.17.09.24.11.07.24.02.24.02.32-.05 3.04-1.99 3.47-2.31.4.06.8.09 1.19.09 3.04 0 5.5-2.23 5.5-4.99C13 6.24 10.54 4 7.5 4h-2Zm12 4c-2.49 0-4.5 1.8-4.5 4.02 0 1.34.7 2.53 1.78 3.31-.09.36-.53 2.04-.55 2.2 0 0-.02.13.07.19.09.06.2.02.2.02.26-.04 2.45-1.6 2.8-1.85.32.05.65.07.97.07 2.49 0 4.5-1.8 4.5-4.02C22 9.8 19.99 8 17.5 8Z"
                    />
                  </svg>
                  <span className="font-medium">{isZh ? "使用微信登录" : "Continue with WeChat"}</span>
                </Button>
              ) : shouldShowGoogleLogin ? (
                <Button
                  onClick={handleGoogleAuth}
                  variant="outline"
                  disabled={!agreePrivacy}
                  className={`w-full flex items-center justify-center space-x-2 mb-4 h-11 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/10 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${!agreePrivacy ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="font-medium">Continue with Google</span>
                </Button>
              ) : null}
            </>
          )}

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200 dark:border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-[#14151a] px-3 text-gray-400 dark:text-gray-500 font-medium">
                {isZh ? "或使用邮箱" : "Or continue with email"}
              </span>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === "signup" && (
              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {isZh ? "姓名" : "Name"}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder={isZh ? "请输入您的姓名" : "Enter your name"}
                    value={authForm.name}
                    onChange={(e) =>
                      setAuthForm({ ...authForm, name: e.target.value })
                    }
                    className="pl-10 h-11 bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    required
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {isZh ? "邮箱" : "Email"}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder={isZh ? "请输入邮箱地址" : "Enter your email"}
                  value={authForm.email}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, email: e.target.value })
                  }
                  className="pl-10 h-11 bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  required
                />
              </div>
            </div>
            {authMode !== "reset" && (
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {isZh ? "密码" : "Password"}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={isZh ? "请输入密码" : "Enter your password"}
                    value={authForm.password}
                    onChange={(e) =>
                      setAuthForm({ ...authForm, password: e.target.value })
                    }
                    className="pl-10 pr-10 h-11 bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    required
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
            )}
            <div className="flex flex-col space-y-3 pt-2">
              <Button
                type="submit"
                disabled={!agreePrivacy}
                className={`w-full h-11 font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 ${!agreePrivacy ? 'opacity-50 cursor-not-allowed' : ''} ${
                  authMode === "login"
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-blue-500/25 hover:shadow-blue-500/40"
                    : authMode === "signup"
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/25 hover:shadow-emerald-500/40"
                      : "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-500/25 hover:shadow-amber-500/40"
                }`}
              >
                {authMode === "login" ? (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    {isZh ? "登录" : "Sign In"}
                  </>
                ) : authMode === "signup" ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {isZh ? "创建账户" : "Create Account"}
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    {isZh ? "发送重置链接" : "Send Reset Link"}
                  </>
                )}
              </Button>
              <div className="flex justify-between text-sm">
                {authMode === "login" && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setAuthMode("reset")}
                      className="p-0 h-auto text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-transparent"
                    >
                      {isZh ? "忘记密码？" : "Forgot password?"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setAuthMode("signup")}
                      className="p-0 h-auto text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-transparent"
                    >
                      {isZh ? "注册新账户" : "Create account"}
                    </Button>
                  </>
                )}
                {authMode === "signup" && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setAuthMode("login")}
                    className="p-0 h-auto text-sm mx-auto text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-transparent"
                  >
                    {isZh ? "已有账号？立即登录" : "Already have an account? Sign in"}
                  </Button>
                )}
                {authMode === "reset" && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setAuthMode("login")}
                    className="p-0 h-auto text-sm mx-auto text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-transparent"
                  >
                    {isZh ? "返回登录" : "Back to sign in"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </DialogContent>

      {/* 隐私条款弹窗 */}
      <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <DialogContent className="w-[92vw] sm:max-w-2xl lg:max-w-4xl max-h-[85vh] sm:max-h-[85vh] overflow-hidden rounded-lg sm:rounded-2xl p-0 border-0 shadow-2xl">
          {/* 装饰性背景 */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-white to-purple-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900" />
          <div className="absolute top-0 right-0 w-32 sm:w-48 lg:w-64 h-32 sm:h-48 lg:h-64 bg-gradient-to-br from-blue-400/10 to-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 sm:w-48 lg:w-64 h-32 sm:h-48 lg:h-64 bg-gradient-to-br from-emerald-400/10 to-teal-500/10 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col h-full max-h-[85vh]">
            <DialogHeader className="px-3 sm:px-6 py-2.5 sm:py-4 border-b border-gray-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex-shrink-0">
              <DialogTitle className="flex items-center gap-2 sm:gap-3 text-sm sm:text-lg font-bold text-gray-900 dark:text-white">
                <div className="p-1 sm:p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/25">
                  <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span>{isZh ? "隐私条款" : "Privacy Policy"}</span>
              </DialogTitle>
              <p className="text-[10px] sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1 ml-7 sm:ml-12">
                {isZh ? "请仔细阅读以下条款" : "Please read the following terms carefully"}
              </p>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-4 bg-white/50 dark:bg-slate-800/50">
              <PrivacyPolicyContent isDomestic={isDomestic} />
            </div>

            <div className="px-3 sm:px-6 py-2.5 sm:py-4 border-t border-gray-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex-shrink-0">
              <button
                onClick={() => {
                  setAgreePrivacy(true);
                  setShowPrivacyDialog(false);
                }}
                className="w-full py-2 sm:py-2.5 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-xs sm:text-base font-medium rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 hover:-translate-y-0.5"
              >
                {isZh ? "我已阅读并同意" : "I have read and agree"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
