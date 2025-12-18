import { NextResponse } from "next/server";
import { IS_DOMESTIC_VERSION } from "@/config";

export const runtime = "nodejs";

export async function POST() {
  // 版本隔离：国际版不使用 auth-token（CloudBase）会话
  if (!IS_DOMESTIC_VERSION) {
    return new NextResponse(null, { status: 404 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set("auth-token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
