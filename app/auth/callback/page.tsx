"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const supabase = createClient();

  useEffect(() => {
    const exchange = async () => {
      await supabase.auth.exchangeCodeForSession(window.location.href);
      router.replace(next);
    };
    void exchange();
  }, [supabase, router, next]);

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="text-center space-y-3">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-500 mx-auto" />
        <p className="text-sm text-gray-600">正在完成登录，请稍候...</p>
      </div>
    </div>
  );
}
