"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

export const dynamic = "force-dynamic";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 优先从 URL 查询参数获取 next（Supabase 会将 redirectTo 中的查询参数保留）
  const next = searchParams.get("next") || "/";
  const stateParam = searchParams.get("state");
  const supabase = createClient();
  const { isDomesticVersion, currentLanguage } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  const isZh = currentLanguage === "zh";

  // 尝试从 state 参数中解析 next（作为备用方案）
  const nextFromState = useMemo(() => {
    if (!stateParam) return null;
    try {
      // Supabase 的 state 参数是 base64 编码的 JSON
      const padded = stateParam.replace(/-/g, "+").replace(/_/g, "/");
      const decodedStr = atob(padded);
      const decoded = JSON.parse(decodedStr) as { next?: string };
      return decoded.next;
    } catch {
      return null;
    }
  }, [stateParam]);

  // 优先使用 URL 查询参数中的 next，如果没有则使用 state 中的
  const nextTarget = useMemo(() => {
    if (next && next !== "/") return next;
    return nextFromState || "/";
  }, [next, nextFromState]);

  useEffect(() => {
    const exchange = async () => {
      // 国内版：处理微信回调
      if (isDomesticVersion) {
        const code = searchParams.get("code");
        console.info("[AuthCallback] CN version, code=", code, "state=", stateParam);
        if (code) {
          try {
            const res = await fetch("/api/auth/wechat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code, state: stateParam || null }),
            });
            if (!res.ok) {
              const errText = await res.text();
              console.error("[AuthCallback] WeChat login failed", errText);
              setError(isZh ? "微信登录失败，请重试" : "WeChat login failed, please try again");
              setStatus("error");
              return;
            }
            setStatus("success");
          } catch (err) {
            console.error("[AuthCallback] WeChat request error", err);
            setError(isZh ? "网络错误，请重试" : "Network error, please try again");
            setStatus("error");
            return;
          }
        }
        router.replace(nextTarget);
        return;
      }

      // 国际版：Supabase 邮箱验证 / OAuth 回调
      try {
        console.info("[AuthCallback] INTL version start, url=", window.location.href);

        // 1) 优先处理邮箱验证 / magic link（hash 携带 access_token）
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");
        const codeParam = searchParams.get("code");
        const errorParam = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        // 处理 OAuth 错误
        if (errorParam) {
          console.error("[AuthCallback] OAuth error:", errorParam, errorDescription);
          setError(errorDescription || errorParam);
          setStatus("error");
          return;
        }

        if (access_token && refresh_token) {
          // Magic link / 邮箱验证回调（implicit flow，hash 中带 tokens）
          console.info("[AuthCallback] magic link tokens found, setting session");
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (sessionError) {
            console.error("[AuthCallback] setSession error:", sessionError.message);
            setError(sessionError.message);
            setStatus("error");
            return;
          }
          console.info("[AuthCallback] magic link setSession success");
          setStatus("success");
        } else if (codeParam) {
          // PKCE 流程：收到 code 参数，需要重定向到服务端 /auth/confirm 处理
          // 因为客户端可能没有 code_verifier（用户在不同浏览器/设备点击邮件链接）
          console.info("[AuthCallback] PKCE code detected, redirecting to server-side /auth/confirm");
          const confirmUrl = new URL("/auth/confirm", window.location.origin);
          confirmUrl.searchParams.set("code", codeParam);
          if (nextTarget && nextTarget !== "/") {
            confirmUrl.searchParams.set("next", nextTarget);
          }
          window.location.href = confirmUrl.toString();
          return;
        } else {
          // 可能是直接访问 callback 页面，尝试获取现有 session
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            console.info("[AuthCallback] Found existing session");
            setStatus("success");
          } else {
            console.warn("[AuthCallback] No access_token/refresh_token or code found in URL");
            setError(isZh ? "无效的认证回调" : "Invalid authentication callback");
            setStatus("error");
            return;
          }
        }

        // 成功后跳转
        setTimeout(() => {
          router.replace(nextTarget);
        }, 500);
      } catch (err) {
        console.error("[AuthCallback] Unexpected error:", err);
        setError(err instanceof Error ? err.message : (isZh ? "认证失败" : "Authentication failed"));
        setStatus("error");
      }
    };
    void exchange();
  }, [supabase, router, nextTarget, isDomesticVersion, searchParams, stateParam, nextFromState, isZh]);

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
