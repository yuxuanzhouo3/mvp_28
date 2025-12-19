import { NextRequest, NextResponse } from "next/server";

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

    // 验证签名
    const expectedSig = Buffer.from(
      `${encoded}.${ADMIN_SESSION_SECRET}`
    ).toString("base64").slice(0, 16);

    if (sig !== expectedSig) return false;

    // 解析 payload
    const payload = Buffer.from(encoded, "base64").toString("utf-8");
    const session = JSON.parse(payload);

    // 检查是否过期
    if (Date.now() > session.expiresAt) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * IP检测和访问控制中间件
 * 实现以下功能：
 * 1. 检测用户IP地理位置
 * 2. 完全禁止欧洲IP访问（符合GDPR合规要求）
 * 3. 为响应添加地理信息头供前端使用
 * 4. 保护 /admin 路由（需要登录）
 *
 * 注意：不进行任何重定向，用户访问哪个域名就使用哪个系统
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

  // 跳过静态资源和Next.js内部路由（但保留 API 路由以便设置区域 Header）
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
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

  // 注意：认证重定向由前端处理，middleware只处理地理路由
  // 这样可以避免与前端useEffect产生重定向循环

  try {
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
      }
    }

    let geoResult;

    // 开发环境支持调试模式
    if (debugParam && isDevelopment) {
      console.log(`� 调试模式启用: ${debugParam}`);

      // 根据debug参数设置模拟的地理位置
      switch (debugParam.toLowerCase()) {
        case "china":
          geoResult = {
            region: RegionType.CHINA,
            countryCode: "CN",
            currency: "CNY",
          };
          break;
        case "usa":
        case "us":
          geoResult = {
            region: RegionType.USA,
            countryCode: "US",
            currency: "USD",
          };
          break;
        case "europe":
        case "eu":
          geoResult = {
            region: RegionType.EUROPE,
            countryCode: "DE",
            currency: "EUR",
          };
          break;
        default:
          // 无效的debug参数，回退到正常检测
          const clientIP = getClientIP(request);
          geoResult = await geoRouter.detect(clientIP || "");
      }
    } else {
      // 正常地理位置检测
      // 获取客户端真实IP并检测地理位置
      const clientIP = getClientIP(request);
      // console.log("[GeoDetect] clientIP:", clientIP || "null", "xff:", request.headers.get("x-forwarded-for") || "none");

      if (!clientIP) {
        console.warn("无法获取客户端IP，标记为未知风险");
        if (FAIL_CLOSED) {
          return new NextResponse(
            JSON.stringify({
              error: "Access Denied",
              message: "IP detection failed. Access blocked by policy.",
              code: "GEO_FAIL_CLOSED",
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        const res = NextResponse.next();
        res.headers.set("X-Geo-Error", "true");
        return res;
      }

      // 检测地理位置
      geoResult = await geoRouter.detect(clientIP);
    }

    // 1. 禁止欧洲IP访问（开发环境调试模式除外）
    if (
      geoResult.region === RegionType.EUROPE &&
      !(debugParam && isDevelopment)
    ) {
      console.log(`禁止欧洲IP访问: ${geoResult.countryCode}`);
      return new NextResponse(
        JSON.stringify({
          error: "Access Denied",
          message:
            "This service is not available in your region due to regulatory requirements.",
          code: "REGION_BLOCKED",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // 2. 为响应添加地理信息头（用于前端判断区域）
    const response = NextResponse.next();
    // 为 API 路由添加 CORS 响应头（基于白名单反射）
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
    response.headers.set("X-User-Region", geoResult.region);
    response.headers.set("X-User-Country", geoResult.countryCode);
    response.headers.set("X-User-Currency", geoResult.currency);

    // 开发环境添加调试模式标识
    if (debugParam && isDevelopment) {
      response.headers.set("X-Debug-Mode", debugParam);
    }

    // 4. CSRF防护 - 对状态改变请求进行CSRF验证
    const csrfResponse = await csrfProtection(request, response);
    if (csrfResponse.status !== 200) {
      return csrfResponse;
    }

    return response;
  } catch (error) {
    console.error("地理分流中间件错误:", error);

    if ((process.env.GEO_FAIL_CLOSED || "").toLowerCase() === "true") {
      return new NextResponse(
        JSON.stringify({
          error: "Access Denied",
          message: "Geo detection failed. Access blocked by policy.",
          code: "GEO_FAIL_CLOSED",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 出错时使用降级策略：允许访问但记录错误
    const response = NextResponse.next();
    response.headers.set("X-Geo-Error", "true");

    return response;
  }
}


export const config = {
  matcher: [
    /*
     * 匹配所有路径，包括 API 路由（需要设置区域 Header）
     * 排除：
     * - Next.js 内部路由 (/_next/...)
     * - 静态文件 (favicon.ico 等)
     */
    "/((?!_next/|favicon.ico).*)",
  ],
};
