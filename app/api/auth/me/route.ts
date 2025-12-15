import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/auth/me
 * 获取当前登录用户信息
 * 根据版本自动选择认证方式：国内版使用 CloudBase，国际版使用 Supabase
 */
export async function GET(req: Request) {
  try {
    // 国际版：使用 Supabase 认证
    if (!IS_DOMESTIC_VERSION) {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        console.log("[auth/me] Supabase: no user found");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // 获取用户 profile 和 wallet 信息
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const { data: wallet } = await supabase
        .from("user_wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();

      console.log("[auth/me] Supabase user:", user.email);
      
      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          name: profile?.name || user.user_metadata?.full_name || user.email?.split("@")[0],
          avatar: profile?.avatar || user.user_metadata?.avatar_url,
          region: profile?.region || "US",
          created_at: profile?.created_at || user.created_at,
        },
        wallet: wallet || null,
      });
    }

    // 国内版：使用 CloudBase 认证
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get("auth-token")?.value;
    const headerToken =
      req.headers.get("x-auth-token") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      null;
    const token = cookieToken || headerToken || null;
    console.log("[auth/me] CloudBase token:", token ? "present" : "missing");
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const service = new CloudBaseAuthService();
    const user = await service.validateToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const res = NextResponse.json({ user });
    // If request 通过 header token 而无 cookie，则回写 cookie 方便后续请求
    if (!cookieToken && token) {
      res.cookies.set("auth-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    }
    return res;
  } catch (error) {
    console.error("[auth/me] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
