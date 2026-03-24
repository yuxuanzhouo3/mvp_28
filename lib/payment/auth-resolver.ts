// lib/payment/auth-resolver.ts
// 支付路由用户认证共享模块

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { createClient } from "@/lib/supabase/server";

/** 是否为国内版 */
const IS_DOMESTIC_VERSION = process.env.NEXT_PUBLIC_IS_DOMESTIC_VERSION === "true";

/**
 * 从请求中解析用户 ID（支持国内版 CloudBase 和国际版 Supabase）
 * @param request NextRequest 对象
 * @param providedUserId 前端传入的 userId（可选）
 * @returns 用户 ID 或 null
 */
export async function resolveUserId(
  request: NextRequest,
  providedUserId?: string
): Promise<string | null> {
  if (providedUserId) return providedUserId;

  if (IS_DOMESTIC_VERSION) {
    return resolveCloudBaseUserId(request);
  } else {
    return resolveSupabaseUserId();
  }
}

/**
 * 从 CloudBase 认证获取用户 ID（国内版）
 */
export async function resolveCloudBaseUserId(request?: NextRequest): Promise<string | null> {
  try {
    // 优先从 cookies 获取
    const cookieStore = await cookies();
    let token = cookieStore.get("auth-token")?.value;

    // 备选：从请求头获取
    if (!token && request) {
      token =
        request.cookies.get("auth-token")?.value ||
        request.headers.get("x-auth-token") ||
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        undefined;
    }

    if (!token) return null;

    const auth = new CloudBaseAuthService();
    const user = await auth.validateToken(token);
    return user?.id || null;
  } catch (error) {
    console.error("[auth-resolver] CloudBase auth error:", error);
    return null;
  }
}

/**
 * 从 Supabase 认证获取用户 ID（国际版）
 */
export async function resolveSupabaseUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  } catch (error) {
    console.error("[auth-resolver] Supabase auth error:", error);
    return null;
  }
}
