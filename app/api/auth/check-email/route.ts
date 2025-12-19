import { NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { IS_DOMESTIC_VERSION } from "@/config";

/**
 * POST /api/auth/check-email
 * body: { email: string }
 * 返回 { exists: boolean }
 * 仅供国内版注册前预检查使用，国际版仍由 Supabase 处理重复校验
 */
export async function POST(req: Request) {
  try {
    if (!IS_DOMESTIC_VERSION) {
      return new NextResponse(null, { status: 404 });
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    const result = await db.collection("users").where({ email }).limit(1).get();
    const exists = result?.data?.length > 0;

    return NextResponse.json({ exists });
  } catch (error) {
    console.error("[auth/check-email] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
