"use client";

import { useEffect, useMemo, useState, Suspense, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

export const dynamic = "force-dynamic";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const stateParam = searchParams.get("state");
  const supabase = createClient();
  const { isDomesticVersion, currentLanguage } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  
  // 防止重复处理
  const processed = useRef(false);

  const isZh = currentLanguage === "zh";

  const nextFromState = useMemo(() => {
    if (!stateParam) return null;
    try {
      const padded = stateParam.replace(/-/g, "+").replace(/_/g, "/");
      const decodedStr = atob(padded);
      const decoded = JSON.parse(decodedStr) as { next?: string };
      return decoded.next;
    } catch {
      return null;
    }
  }, [stateParam]);

  const nextTarget = useMemo(() => nextFromState || next, [nextFromState, next]);

  const handleSuccess = useCallback(() => {
    if (processed.current) return;
    processed.current = true;
    setStatus("success");
    setTimeout(() => router.replace(nextTarget), 300);
  }, [router, nextTarget]);

  const handleError = useCallback((message: string) => {
    if (processed.current) return;
    processed.current = true;
    console.error("[AuthCallback] Error:", message);
    setError(message);
    setStatus("error");
  }, []);

  useEffect(() => {
    // 国内版：处理微信回调
    if (isDomesticVersion) {
      const code = searchParams.get("code");
      console.info("[AuthCallback] CN version, code=", code, "state=", stateParam);
      if (code) {
        fetch("/api/auth/wechat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state: stateParam || null }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const errText = await res.text();
              console.error("[AuthCallback] WeChat login failed", errText);
              handleError(isZh ? "微信登录失败，请重试" : "WeChat login failed, please try again");
              return;
            }
            handleSuccess();
          })
          .catch((err) => {
            console.error("[AuthCallback] WeChat request error", err);
            handleError(isZh ? "网络错误，请重试" : "Network error, please try again");
          });
      } else {
        router.replace(nextTarget);
      }
      return;
    }

    // 国际版：OAuth implicit 流程 / 邮箱验证回调
    const handleAuth = async () => {
      console.info("[AuthCallback] INTL version, url=", window.location.href);
      
      // 检查 OAuth 错误（URL query 参数）
      const errorParam = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");
      if (errorParam) {
        handleError(errorDescription || errorParam);
        return;
      }

      // 检查 hash 中的 error（implicit 流程）
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hashError = hashParams.get("error");
      const hashErrorDesc = hashParams.get("error_description");
      if (hashError) {
        handleError(hashErrorDesc || hashError);
        return;
      }

      // 处理 OAuth implicit 流程 / magic link / 邮箱验证
      // tokens 在 hash 中：#access_token=xxx&refresh_token=xxx&...
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token");

      if (access_token && refresh_token) {
        console.info("[AuthCallback] Found tokens in hash, setting session");
        try {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (sessionError) {
            console.error("[AuthCallback] setSession error:", sessionError.message);
            handleError(sessionError.message);
            return;
          }
          console.info("[AuthCallback] Session set successfully");
          // 清除 URL hash
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
          handleSuccess();
          return;
        } catch (err) {
          console.error("[AuthCallback] setSession exception:", err);
          handleError(err instanceof Error ? err.message : (isZh ? "认证失败" : "Authentication failed"));
          return;
        }
      }

      // 如果没有 tokens，检查是否已有 session
      // SDK 的 detectSessionInUrl 可能已经自动处理了
      try {
        // 给 SDK 一点时间自动处理
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          handleError(sessionError.message);
          return;
        }
        
        if (session) {
          console.info("[AuthCallback] Found existing session:", session.user?.email);
          handleSuccess();
          return;
        }

        // 再等待一下，SDK 可能还在处理
        await new Promise(resolve => setTimeout(resolve, 700));
        
        if (processed.current) return;
        
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        if (retrySession) {
          handleSuccess();
          return;
        }

        // 没有找到有效的认证信息
        console.warn("[AuthCallback] No valid auth info found");
        handleError(isZh ? "无效的认证回调" : "Invalid authentication callback");
      } catch (err) {
        console.error("[AuthCallback] Unexpected error:", err);
        handleError(err instanceof Error ? err.message : (isZh ? "认证失败" : "Authentication failed"));
      }
    };

    handleAuth();
  }, [supabase, router, nextTarget, isDomesticVersion, searchParams, stateParam, isZh, handleSuccess, handleError]);

  if (status === "error") {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-12 w-12 mx-auto text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            {isZh ? "认证失败" : "Authentication Failed"}
          </h2>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => router.push("/auth/login")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isZh ? "返回登录" : "Back to Login"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="text-center space-y-3">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-500 mx-auto" />
        <p className="text-sm text-gray-600">
          {isZh ? "正在完成登录，请稍候..." : "Completing login, please wait..."}
        </p>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center p-6">
          <div className="text-center space-y-3">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-500 mx-auto" />
            <p className="text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
