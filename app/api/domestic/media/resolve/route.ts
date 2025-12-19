import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getUser = async (req: NextRequest) => {
  const token =
    req.cookies.get("auth-token")?.value ||
    req.headers.get("x-auth-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    null;
  if (!token) return null;
  const auth = new CloudBaseAuthService();
  return await auth.validateToken(token);
};

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.filter((id: any) => typeof id === "string" && id.trim())
      : [];

    if (!ids.length) {
      return NextResponse.json({ data: {} });
    }

    const connector = new CloudBaseConnector();
    await connector.initialize();
    const app = connector.getApp();

    const res = await app.getTempFileURL({
      fileList: ids.map((fileID) => ({ fileID, maxAge: 600 })),
    });

    const map = Object.fromEntries(
      (res?.fileList || [])
        .filter((f: any) => f?.fileID && f?.tempFileURL)
        .map((f: any) => [f.fileID, f.tempFileURL]),
    );

    return NextResponse.json({ data: map });
  } catch (error) {
    console.error("[media][resolve] error", error);
    return NextResponse.json({ error: "Failed to resolve media URLs" }, { status: 500 });
  }
}
