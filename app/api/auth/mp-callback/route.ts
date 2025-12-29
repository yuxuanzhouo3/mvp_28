import { NextResponse } from "next/server";
import { IS_DOMESTIC_VERSION } from "@/config";

export const runtime = "nodejs";

/**
 * 小程序登录回调接口
 * 接收小程序直接传回的 token，设置 cookie
 */
export async function POST(req: Request) {
  try {
    // 版本隔离：国际版不允许访问此接口
    if (!IS_DOMESTIC_VERSION) {
      return new NextResponse(null, { status: 404 });
    }

    const { token, openid, expiresIn } = await req.json();

    if (!token || !openid) {
      return NextResponse.json(
        { error: "Token and openid required" },
        { status: 400 }
      );
    }

    // 计算过期时间
    const maxAge = expiresIn ? parseInt(expiresIn, 10) : 60 * 60 * 24 * 7; // 默认 7 天

    const res = NextResponse.json({
      success: true,
      openid,
    });

    // 设置认证 cookie
    res.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    console.log("[mp-callback] Token set for openid:", openid);

    return res;
  } catch (error) {
    console.error("[mp-callback] error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
