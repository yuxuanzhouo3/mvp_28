import { NextResponse } from "next/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // 版本隔离：国际版不允许访问 CloudBase 注册接口
    if (!IS_DOMESTIC_VERSION) {
      return new NextResponse(null, { status: 404 });
    }

    const { email, password, name } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // 仅使用 CloudBase（国内版对标 login 项目）
    const service = new CloudBaseAuthService();
    const result = await service.signUpWithEmail(email, password, name);

    if (!result.user || !result.session) {
      return NextResponse.json(
        { error: result.error?.message || "Register failed" },
        { status: 400 }
      );
    }

    const res = NextResponse.json({
      success: true,
      user: result.user,
      provider: "cloudbase",
      token: result.session.access_token,
      expiresAt: result.session.expires_at,
    });

    res.cookies.set("auth-token", result.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("[auth/register] error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
