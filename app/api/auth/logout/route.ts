import { NextResponse } from "next/server";
import { IS_DOMESTIC_VERSION } from "@/config";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ success: true });

  if (IS_DOMESTIC_VERSION) {
    // 国内版：清除 CloudBase auth-token
    res.cookies.set("auth-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
  } else {
    // 国际版：清除自定义 JWT token
    res.cookies.set("custom-jwt-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    console.log('✅ [logout] Custom JWT token cleared from cookie');
  }

  return res;
}
