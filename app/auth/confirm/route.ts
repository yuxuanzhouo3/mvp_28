import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
  const next = searchParams.get("next") ?? "/";
  const code = searchParams.get("code");

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 在 Server Component 中可能无法设置 cookie，忽略错误
          }
        },
      },
    }
  );

  // 使用环境变量中的 APP_URL 或者从 request 中获取正确的 origin
  const origin = process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.headers.get("host")}`;

  // 构建重定向 URL
  const buildRedirectUrl = (pathname: string, params?: Record<string, string>) => {
    const url = new URL(pathname, origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return url.toString();
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
      return NextResponse.redirect(
        buildRedirectUrl("/auth/callback", {
          error: "access_denied",
          error_description: error.message,
        })
      );
    }

    console.info("[auth/confirm] verifyOtp success");
    return NextResponse.redirect(buildRedirectUrl(next));
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
        return NextResponse.redirect(
          buildRedirectUrl("/auth/callback", {
            error: "access_denied",
            error_description: "The verification link has expired or was opened in a different browser. Please sign up again.",
          })
        );
      }

      return NextResponse.redirect(
        buildRedirectUrl("/auth/callback", {
          error: "access_denied",
          error_description: error.message,
        })
      );
    }

    console.info("[auth/confirm] exchangeCodeForSession success");
    return NextResponse.redirect(buildRedirectUrl(next));
  }

  // 无效请求
  console.warn("[auth/confirm] No valid parameters found");
  return NextResponse.redirect(
    buildRedirectUrl("/auth/callback", {
      error: "invalid_request",
      error_description: "Missing verification parameters",
    })
  );
}
