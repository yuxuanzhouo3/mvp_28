import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAnonKeyFromEnv, getSupabaseUrlFromEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const proto =
    forwardedProto ||
    request.nextUrl.protocol.replace(":", "") ||
    "http";
  const host = forwardedHost || request.headers.get("host");
  if (host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

function sanitizeNextPath(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  // 防止协议相对 URL（//evil.com）
  if (next.startsWith("//")) return "/";
  return next;
}

/**
 * 服务端邮箱验证处理路由
 *
 * 当用户点击验证邮件中的链接时，Supabase 会重定向到这里
 * 此路由在服务端验证 token，避免 PKCE code_verifier 丢失问题
 *
 * 支持两种验证方式：
 * 1. token_hash + type: 用于邮箱验证（signup, recovery, email_change 等）
 * 2. code: 用于 OAuth PKCE 流程（需要 code_verifier，但我们改用 token_hash）
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  // 使用“当前请求域名”作为 origin，确保本地/预发/生产都能正确落 cookie 并回跳到同域。
  const origin = getRequestOrigin(request);

  const supabaseUrl = getSupabaseUrlFromEnv();
  const supabaseAnonKey = getSupabaseAnonKeyFromEnv();
  if (!supabaseUrl || !supabaseAnonKey) {
    const redirectUrl = new URL("/auth/callback", origin);
    redirectUrl.searchParams.set("error", "configuration_error");
    redirectUrl.searchParams.set(
      "error_description",
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    );
    return NextResponse.redirect(redirectUrl);
  }

  // 重要：Route Handler 场景下，不依赖 `cookies()` 的可写能力，统一将 Set-Cookie 写入最终响应。
  const pendingCookies: Array<{ name: string; value: string; options: any }> = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      async setAll(cookiesToSet) {
        pendingCookies.push(...cookiesToSet);
      },
    },
  });

  const redirectWithCookies = (url: URL) => {
    const res = NextResponse.redirect(url);
    for (const { name, value, options } of pendingCookies) {
      res.cookies.set(name, value, options);
    }
    return res;
  };

  // 方式1：处理 token_hash 流程（邮箱验证的标准方式）
  if (token_hash && type) {
    console.info("[auth/confirm] Verifying with token_hash, type:", type);

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (error) {
      console.error("[auth/confirm] verifyOtp error:", error.message);
      const errUrl = new URL("/auth/callback", origin);
      errUrl.searchParams.set("error", "access_denied");
      errUrl.searchParams.set("error_description", error.message);
      return NextResponse.redirect(errUrl);
    }

    console.info("[auth/confirm] verifyOtp success");
    return redirectWithCookies(new URL(next, origin));
  }

  // 方式2：处理 PKCE code 流程
  // 注意：这需要 code_verifier，如果没有会失败
  // 我们先尝试，失败后给出友好提示
  if (code) {
    console.info("[auth/confirm] Attempting to exchange code for session");

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/confirm] exchangeCodeForSession error:", error.message);

      // 如果是 code_verifier 相关错误，提示用户重新注册
      if (error.message.includes("code verifier") || error.message.includes("code_verifier")) {
        const errUrl = new URL("/auth/callback", origin);
        errUrl.searchParams.set("error", "access_denied");
        errUrl.searchParams.set(
          "error_description",
          "The verification link has expired or was opened in a different browser. Please sign up again."
        );
        return NextResponse.redirect(errUrl);
      }

      const errUrl = new URL("/auth/callback", origin);
      errUrl.searchParams.set("error", "access_denied");
      errUrl.searchParams.set("error_description", error.message);
      return NextResponse.redirect(errUrl);
    }

    console.info("[auth/confirm] exchangeCodeForSession success");
    return redirectWithCookies(new URL(next, origin));
  }

  // 无效请求
  console.warn("[auth/confirm] No valid parameters found");
  const errUrl = new URL("/auth/callback", origin);
  errUrl.searchParams.set("error", "invalid_request");
  errUrl.searchParams.set("error_description", "Missing verification parameters");
  return NextResponse.redirect(errUrl);
}
