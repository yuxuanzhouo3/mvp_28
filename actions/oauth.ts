"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKeyFromEnv, getSupabaseUrlFromEnv } from "@/lib/supabase/env";
import { headers } from "next/headers";

/**
 * 服务端 Google OAuth 启动 (Server Action)
 *
 * 使用 Server Action 启动 OAuth 可以确保 PKCE code_verifier 正确存储在 cookie 中。
 * 这是 Supabase 官方推荐的方式。
 */
export async function signInWithGoogle(next: string = "/") {
  const supabaseUrl = getSupabaseUrlFromEnv();
  const supabaseAnonKey = getSupabaseAnonKeyFromEnv();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase configuration");
  }

  // 获取 origin
  const headersList = await headers();
  const host = headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") || "https";
  const origin = `${proto}://${host}`;

  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          // Server Component 中可能会失败，忽略
          console.warn("[signInWithGoogle] Failed to set cookies:", error);
        }
      },
    },
  });

  const redirectTo = `${origin}/auth/callback${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;

  console.info("[signInWithGoogle] Starting OAuth flow", { origin, redirectTo });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    console.error("[signInWithGoogle] Error:", error.message);
    throw error;
  }

  if (data.url) {
    console.info("[signInWithGoogle] Redirecting to:", data.url);
    redirect(data.url);
  }
}
