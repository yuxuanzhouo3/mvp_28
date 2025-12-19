import { NextRequest, NextResponse } from "next/server";
import { geoRouter } from "@/lib/architecture-modules/core/geo-router";
import { RegionType } from "@/lib/architecture-modules/core/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/geo/detect
 * 检测客户端IP地理位置
 * 返回地理信息用于前端判断区域和设置支付方式
 */
export async function GET(request: NextRequest) {
  try {
    // 获取客户端IP
    const clientIP = getClientIP(request);
    
    if (!clientIP) {
      return NextResponse.json(
        {
          error: "IP detection failed",
          message: "Unable to detect client IP address",
        },
        { status: 400 }
      );
    }

    // 检查debug参数（仅开发环境）
    const debugParam = request.nextUrl.searchParams.get("debug");
    const isDevelopment = process.env.NODE_ENV === "development";
    
    let geoResult;
    
    if (debugParam && isDevelopment) {
      // 开发环境调试模式
      switch (debugParam.toLowerCase()) {
        case "china":
          geoResult = {
            region: RegionType.CHINA,
            countryCode: "CN",
            currency: "CNY",
            paymentMethods: ["wechat", "alipay"],
            authMethods: ["wechat", "email"],
            database: "cloudbase",
            deployment: "tencent",
            gdprCompliant: false,
          };
          break;
        case "usa":
        case "us":
          geoResult = {
            region: RegionType.USA,
            countryCode: "US",
            currency: "USD",
            paymentMethods: ["stripe", "paypal"],
            authMethods: ["google", "email"],
            database: "supabase",
            deployment: "vercel",
            gdprCompliant: false,
          };
          break;
        case "europe":
        case "eu":
          geoResult = {
            region: RegionType.EUROPE,
            countryCode: "DE",
            currency: "EUR",
            paymentMethods: [],
            authMethods: ["email"],
            database: "supabase",
            deployment: "vercel",
            gdprCompliant: true,
          };
          break;
        default:
          geoResult = await geoRouter.detect(clientIP);
      }
    } else {
      // 正常检测
      geoResult = await geoRouter.detect(clientIP);
    }

    // 检查是否禁止欧洲IP访问
    const FAIL_CLOSED = (process.env.GEO_FAIL_CLOSED || "true").toLowerCase() === "true";
    
    if (geoResult.region === RegionType.EUROPE && !(debugParam && isDevelopment)) {
      return NextResponse.json(
        {
          error: "Access Denied",
          message: "This service is not available in your region due to regulatory requirements.",
          code: "REGION_BLOCKED",
          region: geoResult.region,
          countryCode: geoResult.countryCode,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      geo: geoResult,
      ip: clientIP,
    });
  } catch (error) {
    console.error("[geo/detect] error:", error);
    
    const FAIL_CLOSED = (process.env.GEO_FAIL_CLOSED || "true").toLowerCase() === "true";
    
    if (FAIL_CLOSED) {
      return NextResponse.json(
        {
          error: "Access Denied",
          message: "Geo detection failed. Access blocked by policy.",
          code: "GEO_FAIL_CLOSED",
        },
        { status: 403 }
      );
    }

    // 返回默认值
    return NextResponse.json({
      success: true,
      geo: {
        region: RegionType.OTHER,
        countryCode: "XX",
        currency: "USD",
        paymentMethods: ["stripe", "paypal"],
        authMethods: ["google", "email"],
        database: "supabase",
        deployment: "vercel",
        gdprCompliant: false,
      },
      error: true,
    });
  }
}

/**
 * 获取客户端真实IP地址
 */
function getClientIP(request: NextRequest): string | null {
  const isDev = process.env.NODE_ENV !== "production";

  // 开发环境支持调试注入 IP
  if (isDev) {
    const debugIp =
      request.headers.get("x-debug-ip") ||
      request.nextUrl.searchParams.get("debug_ip") ||
      request.nextUrl.searchParams.get("debugip");
    if (debugIp && isValidIP(debugIp)) {
      return debugIp;
    }
  }

  // 优先级：X-Real-IP > X-Forwarded-For > CF-Connecting-IP
  const realIP = request.headers.get("x-real-ip");
  if (realIP && isValidIP(realIP)) {
    return realIP;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip) => ip.trim());
    for (const ip of ips) {
      if (isValidIP(ip)) {
        return ip;
      }
    }
  }

  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP && isValidIP(cfIP)) {
    return cfIP;
  }

  return null;
}

/**
 * 验证IP地址格式
 */
function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split(".").map(Number);
    return parts.every((part) => part >= 0 && part <= 255);
  }

  if (ip.includes(":")) {
    const ipv6Loose = /^[0-9a-fA-F:]+$/;
    if (!ipv6Loose.test(ip)) return false;
    const lower = ip.toLowerCase();
    if (lower === "::1") return false;
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb"))
      return false;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return false;
    if (lower.startsWith("2001:db8")) return false;
    return true;
  }

  return false;
}

