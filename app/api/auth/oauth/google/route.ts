import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAnonKeyFromEnv, getSupabaseUrlFromEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 服务端 Google OAuth 启动路由
 *
 * 使用服务端路由启动 OAuth 可以确保 PKCE code_verifier 正确存储在 cookie 中，
 * 避免客户端跨域重定向导致的 code_verifier 丢失问题。
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") || "/";

  const supabaseUrl = getSupabaseUrlFromEnv();
  const supabaseAnonKey = getSupabaseAnonKeyFromEnv();

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Missing Supabase configuration" },
      { status: 500 }
    );
  }

  // 获取请求的 origin
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const proto = forwardedProto || request.nextUrl.protocol.replace(":", "") || "https";
  const host = forwardedHost || request.headers.get("host");
  const origin = host ? `${proto}://${host}` : request.nextUrl.origin;

  // 收集需要设置的 cookie（关键：必须在 redirect 响应中设置）
  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const cookies = request.cookies.getAll();
        console.info("[OAuth Google] getAll called, cookies:", cookies.map(c => c.name));
        return cookies;
      },
      setAll(cookiesToSet) {
        // 收集 cookie，稍后在响应中设置
        console.info("[OAuth Google] setAll called with:", cookiesToSet.map(c => ({ name: c.name, valueLen: c.value?.length })));
        pendingCookies.push(...cookiesToSet);
      },
    },
  });

  // 构建 redirectTo URL
  const redirectTo = `${origin}/auth/callback${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;

  console.info("[OAuth Google] Starting OAuth flow", { origin, redirectTo });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true, // 阻止自动重定向，我们手动处理
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    console.error("[OAuth Google] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data?.url) {
    return NextResponse.json({ error: "No OAuth URL returned" }, { status: 500 });
  }

  // 解析 OAuth URL，检查是否包含 code_challenge（PKCE）
  const oauthUrl = new URL(data.url);
  const hasCodeChallenge = oauthUrl.searchParams.has("code_challenge");
  console.info("[OAuth Google] OAuth URL generated", {
    hasCodeChallenge,
    pendingCookiesCount: pendingCookies.length,
    pendingCookieNames: pendingCookies.map(c => c.name),
  });

  // 创建 redirect 响应并设置 PKCE cookie
  const response = NextResponse.redirect(data.url);

  // 关键：将 PKCE 相关的 cookie 设置到响应中
  for (const { name, value, options } of pendingCookies) {
    console.info("[OAuth Google] Setting cookie:", name);
    response.cookies.set(name, value, options as Record<string, unknown>);
  }

  return response;
}
