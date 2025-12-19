import { NextRequest, NextResponse } from "next/server";
// Geo detection and CSRF disabled in middleware - moved to API routes

// Admin session cookie 配置
const ADMIN_SESSION_COOKIE_NAME = "admin_session";
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "admin-secret-key-change-in-production";

/**
 * 验证 Admin Session Token（Edge Runtime 兼容版本）
 */
function verifyAdminSessionToken(token: string): boolean {
  try {
    const [encoded, sig] = token.split(".");
    if (!encoded || !sig) return false;

    // 验证签名 - Edge Runtime compatible
    const encoder = new TextEncoder();
    const data = encoder.encode(`${encoded}.${ADMIN_SESSION_SECRET}`);
    let binaryString = '';
    for (let i = 0; i < data.length; i++) {
      binaryString += String.fromCharCode(data[i]);
    }
    const expectedSig = btoa(binaryString).slice(0, 16);

    if (sig !== expectedSig) return false;

    // 解析 payload - Edge Runtime compatible
    const payload = atob(encoded);
    const session = JSON.parse(payload);

    // 检查是否过期
    if (Date.now() > session.expiresAt) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * 简化的中间件
 * 实现以下功能：
 * 1. 版本隔离（国内版/国际版 API 路由限制）
 * 2. Admin 路由保护
 * 3. CORS 处理
 * 4. 请求体大小限制
 * 5. Debug 模式安全检查
 *
 * 注意：Geo detection 和 CSRF 已移至 API 路由
 */
export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // =====================
  // 版本隔离：根据 NEXT_PUBLIC_DEFAULT_LANGUAGE 限制可访问的 API 路由
  // - 国内版(zh)：禁止访问 /api/international 及 Stripe/PayPal
  // - 国际版(en)：禁止访问 /api/domestic 及 微信/支付宝/国内 webhook
  // =====================
  const envDefaultLang = (process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE || "zh").toLowerCase();
  const isDomesticVersion = envDefaultLang !== "en";

  if (pathname.startsWith("/api/domestic") && !isDomesticVersion) {
    return new NextResponse(null, { status: 404 });
  }
  if (pathname.startsWith("/api/international") && isDomesticVersion) {
    return new NextResponse(null, { status: 404 });
  }

  if (isDomesticVersion) {
    if (pathname.startsWith("/api/payment/stripe") || pathname.startsWith("/api/payment/paypal")) {
      return new NextResponse(null, { status: 404 });
    }
  } else {
    if (
      pathname.startsWith("/api/payment/wechat") ||
      pathname.startsWith("/api/payment/alipay") ||
      pathname.startsWith("/api/payment/webhook/wechat") ||
      pathname.startsWith("/api/payment/webhook/alipay") ||
      pathname.startsWith("/api/webhooks/domestic-renew") ||
      pathname === "/api/auth/check-email" ||
      // 国内版（CloudBase）认证接口：国际版不允许访问，保证数据库/存储绝对隔离
      pathname === "/api/auth/login" ||
      pathname === "/api/auth/register" ||
      pathname === "/api/auth/logout" ||
      pathname === "/api/auth/wechat" ||
      pathname.startsWith("/api/auth/wechat/")
    ) {
      return new NextResponse(null, { status: 404 });
    }
  }

  // =====================
  // Admin 路由保护
  // =====================
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;

    if (!sessionToken || !verifyAdminSessionToken(sessionToken)) {
      // 未登录或会话无效，重定向到登录页
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // =====================
  // CORS 预检统一处理（仅 API 路由）
  // 允许基于环境变量 ALLOWED_ORIGINS 的白名单反射 Origin
  // =====================
  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin") || "";
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const isAllowedOrigin = origin && allowedOrigins.includes(origin);

    // 预检请求快速返回
    if (request.method === "OPTIONS") {
      if (isAllowedOrigin) {
        return new NextResponse(null, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Credentials": "true",
          },
        });
      }
      // 非白名单直接拒绝
      return new NextResponse(null, {
        status: 403,
        headers: {
          "Access-Control-Allow-Origin": "null",
        },
      });
    }
  }

  // 跳过静态资源和Next.js内部路由
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    (pathname.includes(".") && !pathname.startsWith("/api/"))
  ) {
    return NextResponse.next();
  }

  // 请求体大小限制 (10MB) - 仅API路由
  if (pathname.startsWith("/api/") && request.method === "POST") {
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      return new NextResponse(
        JSON.stringify({
          error: "Request body too large",
          message: "Maximum request size is 10MB",
        }),
        {
          status: 413,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // 检查URL参数中的debug模式（仅开发环境支持）
  const debugParam = searchParams.get("debug");
  const isDevelopment = process.env.NODE_ENV === "development";

  // 🚨 生产环境安全检查：禁止调试模式访问
  if (debugParam && !isDevelopment) {
    console.warn(`🚨 生产环境检测到调试模式参数，已禁止访问: ${debugParam}`);
    return new NextResponse(
      JSON.stringify({
        error: "Access Denied",
        message: "Debug mode is not allowed in production.",
        code: "DEBUG_MODE_BLOCKED",
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Blocked": "true",
        },
      }
    );
  }

  // 如果是 API 请求，也检查 Referer 中的 debug 参数
  if (pathname.startsWith("/api/") && !isDevelopment) {
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const refererDebug = refererUrl.searchParams.get("debug");

        // 生产环境禁用来自referer的调试模式
        if (refererDebug) {
          console.warn(
            `🚨 生产环境检测到来自referer的调试模式参数，已禁止访问: ${refererDebug}`
          );
          return new NextResponse(
            JSON.stringify({
              error: "Access Denied",
              message: "Debug mode is not allowed in production.",
              code: "DEBUG_MODE_BLOCKED",
            }),
            {
              status: 403,
              headers: {
                "Content-Type": "application/json",
                "X-Debug-Blocked": "true",
              },
            }
          );
        }
      } catch (error) {
        // Ignore URL parsing errors
      }
    }
  }

  // 为响应添加CORS头（如果需要）
  const response = NextResponse.next();
  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin") || "";
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，包括 API 路由
     * 排除：
     * - Next.js 内部路由 (/_next/...)
     * - 静态文件 (favicon.ico 等)
     */
    "/((?!_next/|favicon.ico).*)",
  ],
};
