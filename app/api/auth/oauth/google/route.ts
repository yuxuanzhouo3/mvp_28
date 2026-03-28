import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAnonKeyFromEnv, getSupabaseUrlFromEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 服务端 Google OAuth 启动路由
 *
 * 根据 User-Agent 自动选择 OAuth 流程：
 * - Android WebView (Median/GoNative): 使用 implicit flow，token 直接返回在 URL hash 中
 *   避免 PKCE code_verifier cookie 在 Chrome Custom Tab 和 WebView 之间丢失
 * - 其他环境 (桌面浏览器等): 使用 PKCE flow，更安全
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

  // 检测是否为 Android WebView 环境
  const userAgent = request.headers.get("user-agent") || "";
  const isAndroid = /android/i.test(userAgent);

  console.info("[OAuth Google] Environment detection", { isAndroid, userAgent: userAgent.substring(0, 100) });

  if (isAndroid) {
    // ---- Android: 使用 implicit flow (无需 cookie) ----
    // 直接构建 Supabase implicit OAuth URL，绕过 PKCE
    const redirectTo = `${origin}/auth/callback/client${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return []; },
        setAll() { /* implicit flow 不需要存 cookie */ },
      },
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
          // 强制使用 implicit flow：不带 response_type=code
        },
      },
    });

    if (error) {
      console.error("[OAuth Google] Android implicit flow error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data?.url) {
      return NextResponse.json({ error: "No OAuth URL returned" }, { status: 500 });
    }

    // 修改 OAuth URL：将 response_type 从 code 改为 token (implicit flow)
    const oauthUrl = new URL(data.url);
    oauthUrl.searchParams.set("response_type", "token");
    // implicit flow 不需要 PKCE 参数
    oauthUrl.searchParams.delete("code_challenge");
    oauthUrl.searchParams.delete("code_challenge_method");

    console.info("[OAuth Google] Android implicit flow redirect", { redirectTo });
    return NextResponse.redirect(oauthUrl.toString());

  } else {
    // ---- 桌面/iOS: 使用 PKCE flow (标准安全流程) ----
    const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    });

    const redirectTo = `${origin}/auth/callback${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;

    console.info("[OAuth Google] PKCE flow", { origin, redirectTo });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      console.error("[OAuth Google] PKCE flow error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data?.url) {
      return NextResponse.json({ error: "No OAuth URL returned" }, { status: 500 });
    }

    const response = NextResponse.redirect(data.url);

    for (const { name, value, options } of pendingCookies) {
      console.info("[OAuth Google] Setting cookie:", name);
      response.cookies.set(name, value, options as Record<string, unknown>);
    }

    return response;
  }
}
