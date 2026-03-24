"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
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

  const nextTarget = useMemo(() => {
    if (next && next !== "/") return next;
    return nextFromState || "/";
  }, [next, nextFromState]);

  useEffect(() => {
    const exchange = async () => {
      // 国内版：处理微信回调
      if (isDomesticVersion) {
        const code = searchParams.get("code");
        console.info("[AuthCallback/client] CN version, code=", code, "state=", stateParam);
        if (code) {
          try {
            const res = await fetch("/api/auth/wechat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code, state: stateParam || null }),
            });
            if (!res.ok) {
              const errText = await res.text();
              console.error("[AuthCallback/client] WeChat login failed", errText);
              setError(isZh ? "微信登录失败，请重试" : "WeChat login failed, please try again");
              setStatus("error");
              return;
            }
            setStatus("success");
          } catch (err) {
            console.error("[AuthCallback/client] WeChat request error", err);
            setError(isZh ? "网络错误，请重试" : "Network error, please try again");
            setStatus("error");
            return;
          }
        }
        router.replace(nextTarget);
        return;
      }

      // 国际版：处理 magic link（hash 中带 tokens）
      try {
        console.info("[AuthCallback/client] INTL version start, url=", window.location.href);

        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");
        const errorParam = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        // 处理 OAuth 错误
        if (errorParam) {
          console.error("[AuthCallback/client] OAuth error:", errorParam, errorDescription);
          setError(errorDescription || errorParam);
          setStatus("error");
          return;
        }

        if (access_token && refresh_token) {
          // Magic link / 邮箱验证回调
          console.info("[AuthCallback/client] magic link tokens found, setting session");
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (sessionError) {
            console.error("[AuthCallback/client] setSession error:", sessionError.message);
            setError(sessionError.message);
            setStatus("error");
            return;
          }
          console.info("[AuthCallback/client] magic link setSession success");
          setStatus("success");
        } else {
          // 尝试获取现有 session
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            console.info("[AuthCallback/client] Found existing session");
            setStatus("success");
          } else {
            console.warn("[AuthCallback/client] No tokens found in URL");
            setError(isZh ? "无效的认证回调" : "Invalid authentication callback");
            setStatus("error");
            return;
          }
        }

        setTimeout(() => {
          router.replace(nextTarget);
        }, 500);
      } catch (err) {
        console.error("[AuthCallback/client] Unexpected error:", err);
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
