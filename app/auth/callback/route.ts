import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAnonKeyFromEnv, getSupabaseUrlFromEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const proto = forwardedProto || request.nextUrl.protocol.replace(":", "") || "https";
  const host = forwardedHost || request.headers.get("host");
  if (host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

function sanitizeNextPath(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  return next;
}

/**
 * 服务端 OAuth 回调处理路由
 *
 * 当用户从 Google OAuth 返回时，Supabase 会重定向到这里
 * 在服务端完成 PKCE code exchange，确保 code_verifier 正确读取
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const origin = getRequestOrigin(request);

  console.info("[auth/callback] Received callback", {
    hasCode: !!code,
    hasError: !!errorParam,
    cookies: request.cookies.getAll().map(c => c.name),
  });

  // 处理 OAuth 错误
  if (errorParam) {
    console.error("[auth/callback] OAuth error:", errorParam, errorDescription);
    const errUrl = new URL("/auth/error", origin);
    errUrl.searchParams.set("error", errorParam);
    if (errorDescription) {
      errUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(errUrl);
  }

  // 如果没有 code，重定向到客户端页面处理其他情况（如 hash 中的 tokens）
  if (!code) {
    console.info("[auth/callback] No code found, redirecting to client-side handler");
    const clientUrl = new URL("/auth/callback/client", origin);
    searchParams.forEach((value, key) => {
      clientUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(clientUrl);
  }

  const supabaseUrl = getSupabaseUrlFromEnv();
  const supabaseAnonKey = getSupabaseAnonKeyFromEnv();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[auth/callback] Missing Supabase configuration");
    const errUrl = new URL("/auth/error", origin);
    errUrl.searchParams.set("error", "configuration_error");
    errUrl.searchParams.set("error_description", "Missing Supabase configuration");
    return NextResponse.redirect(errUrl);
  }

  // 收集需要设置的 cookie
  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        // 从请求中读取 cookie（包含 PKCE code_verifier）
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        pendingCookies.push(...cookiesToSet);
      },
    },
  });

  console.info("[auth/callback] Exchanging code for session");

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
    const errUrl = new URL("/auth/error", origin);
    errUrl.searchParams.set("error", "exchange_failed");
    errUrl.searchParams.set("error_description", error.message);
    return NextResponse.redirect(errUrl);
  }

  console.info("[auth/callback] Session established for:", data?.session?.user?.email);

  // 创建响应并设置 cookie
  const successUrl = new URL(next, origin);
  const response = NextResponse.redirect(successUrl);

  // 将 Supabase 设置的 cookie 添加到响应中
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options as Record<string, unknown>);
  }

  return response;
}
