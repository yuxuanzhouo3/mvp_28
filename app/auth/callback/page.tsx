"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

export const dynamic = "force-dynamic";

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const stateParam = searchParams.get("state");
  const supabase = createClient();
  const { isDomesticVersion } = useLanguage();

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

  useEffect(() => {
    const exchange = async () => {
      // 国内版：处理微信回调
      if (isDomesticVersion) {
        const code = searchParams.get("code");
        if (code) {
          const res = await fetch("/api/auth/wechat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, state: stateParam || null }),
          });
          if (!res.ok) {
            console.error("WeChat login failed", await res.text());
          }
        }
        router.replace(nextFromState || next);
        return;
      }

      // 国际版：Supabase OAuth
      await supabase.auth.exchangeCodeForSession(window.location.href);
      router.replace(next);
    };
    void exchange();
  }, [supabase, router, next, isDomesticVersion, searchParams, stateParam, nextFromState]);

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="text-center space-y-3">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-500 mx-auto" />
        <p className="text-sm text-gray-600">正在完成登录，请稍候...</p>
      </div>
    </div>
  );
}
