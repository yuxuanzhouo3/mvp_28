import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, UserPlus, Lock, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

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
}) => {
  const { currentLanguage, isDomesticVersion } = useLanguage();
  const isZh = currentLanguage === "zh";
  const isDomestic = isDomesticVersion;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] data-[state=open]:animate-none data-[state=closed]:animate-none">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            {authMode === "login" ? (
              <LogIn className="w-5 h-5" />
            ) : authMode === "signup" ? (
              <UserPlus className="w-5 h-5" />
            ) : (
              <Lock className="w-5 h-5" />
            )}
            <span>
              {authMode === "login"
                ? isZh
                  ? "登录 MornGPT"
                  : "Login to MornGPT"
                : authMode === "signup"
                  ? isZh
                    ? "注册 MornGPT"
                    : "Sign up for MornGPT"
                  : isZh
                    ? "重置密码"
                    : "Reset Password"}
            </span>
          </DialogTitle>
        </DialogHeader>

        {authMode !== "reset" && (
          <>
            {isDomestic ? (
              <Button
                onClick={handleWechatAuth}
                variant="default"
                className="w-full flex items-center space-x-2 mb-4 bg-[#00c060] hover:bg-[#00a654] text-white border-none"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M5.5 4C2.46 4 0 6.24 0 8.99c0 2 1.33 3.74 3.3 4.62-.12.45-.76 2.8-.79 3.02 0 0-.02.17.09.24.11.07.24.02.24.02.32-.05 3.04-1.99 3.47-2.31.4.06.8.09 1.19.09 3.04 0 5.5-2.23 5.5-4.99C13 6.24 10.54 4 7.5 4h-2Zm12 4c-2.49 0-4.5 1.8-4.5 4.02 0 1.34.7 2.53 1.78 3.31-.09.36-.53 2.04-.55 2.2 0 0-.02.13.07.19.09.06.2.02.2.02.26-.04 2.45-1.6 2.8-1.85.32.05.65.07.97.07 2.49 0 4.5-1.8 4.5-4.02C22 9.8 19.99 8 17.5 8Z"
                  />
                </svg>
                <span>{isZh ? "使用微信登录" : "Continue with WeChat"}</span>
              </Button>
            ) : (
              <Button
                onClick={handleGoogleAuth}
                variant="outline"
                className="w-full flex items-center space-x-2 mb-4 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </Button>
            )}
          </>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-200 dark:border-[#565869]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-[#40414f] px-2 text-gray-500 dark:text-gray-400">
              {isZh ? "使用邮箱登录" : "Or continue with email"}
            </span>
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === "signup" && (
            <div>
            <Label
              htmlFor="name"
              className="text-gray-900 dark:text-[#ececf1]"
            >
              {isZh ? "姓名" : "Name"}
            </Label>
            <Input
              id="name"
              type="text"
              value={authForm.name}
              onChange={(e) =>
                  setAuthForm({ ...authForm, name: e.target.value })
                }
                className="bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
                required
              />
            </div>
          )}
          <div>
            <Label
              htmlFor="email"
              className="text-gray-900 dark:text-[#ececf1]"
            >
              {isZh ? "邮箱" : "Email"}
            </Label>
            <Input
              id="email"
              type="email"
              value={authForm.email}
              onChange={(e) =>
                setAuthForm({ ...authForm, email: e.target.value })
              }
              className="bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
              required
            />
          </div>
          {authMode !== "reset" && (
            <div>
            <Label
              htmlFor="password"
              className="text-gray-900 dark:text-[#ececf1]"
            >
              {isZh ? "密码" : "Password"}
            </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={authForm.password}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, password: e.target.value })
                  }
                  className="bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-500 dark:text-gray-400"
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
          <div className="flex flex-col space-y-2">
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {authMode === "login"
                ? isZh
                  ? "登录"
                  : "Login"
                : authMode === "signup"
                  ? isZh
                    ? "注册"
                    : "Sign Up"
                  : isZh
                    ? "发送重置链接"
                    : "Send Reset Link"}
            </Button>
            <div className="flex justify-between text-sm">
              {authMode === "login" && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setAuthMode("reset")}
                    className="p-0 h-auto text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-[#ececf1]"
                  >
                    {isZh ? "忘记密码？" : "Forgot password?"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setAuthMode("signup")}
                    className="p-0 h-auto text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-[#ececf1]"
                  >
                    {isZh ? "注册" : "Sign up"}
                  </Button>
                </>
              )}
              {authMode === "signup" && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAuthMode("login")}
                  className="p-0 h-auto text-sm mx-auto text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-[#ececf1]"
                >
                  {isZh ? "已有账号？登录" : "Already have an account? Login"}
                </Button>
              )}
              {authMode === "reset" && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAuthMode("login")}
                  className="p-0 h-auto text-sm mx-auto text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-[#ececf1]"
                >
                  {isZh ? "返回登录" : "Back to login"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
