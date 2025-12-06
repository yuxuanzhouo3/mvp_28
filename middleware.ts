import { updateSession } from "@/lib/supabase/proxy";
import { NextResponse, type NextRequest } from "next/server";

// 与 mvp_modules-main 国际版一致的欧洲地区屏蔽名单（EU + EEA + UK + CH）
const EUROPEAN_COUNTRIES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "LI",
  "NO",
  "GB",
  "CH",
];

const deploymentRegion = (process.env.NEXT_PUBLIC_DEPLOYMENT_REGION || "").toUpperCase();
const isInternational =
  deploymentRegion === "INTL" ||
  (!deploymentRegion &&
    (process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE || "zh").toLowerCase() !== "zh");
const isDomestic = !isInternational;

function getClientIP(request: NextRequest): string | null {
  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP;

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = forwardedFor.split(",").map((v) => v.trim())[0];
    if (ip) return ip;
  }

  const fallbackHeaders = [
    "x-client-ip",
    "forwarded",
    "forwarded-for",
    "cf-connecting-ip",
    "true-client-ip",
  ];

  for (const header of fallbackHeaders) {
    const ip = request.headers.get(header);
    if (ip) return ip;
  }

  return null;
}

async function detectCountryCode(ip: string | null): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const url = ip ? `https://ipapi.co/${ip}/json/` : "https://ipapi.co/json/";
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return null;
    const data = await res.json();
    const code =
      (data.country_code || data.countryCode || "").toString().toUpperCase();
    return code || null;
  } catch (error) {
    console.warn("IP detection failed", error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 国内版直接放行
  if (isDomestic) return NextResponse.next();

  // 国际版：先做 IP 屏蔽，再处理 Supabase 会话
  const clientIP = getClientIP(request);
  const countryCode = await detectCountryCode(clientIP);

  if (countryCode && EUROPEAN_COUNTRIES.includes(countryCode)) {
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
          "X-Region-Blocked": countryCode,
        },
      },
    );
  }

  // API 路由不需要 Supabase 登录代理，但仍需经过 IP 检测
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  // 与 mvp_modules-main 一致：应用于除静态资源外的所有路径（包含 API）
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
