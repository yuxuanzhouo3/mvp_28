import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getUserFromRequest } from "@/lib/auth-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureUser(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  return auth?.userId || null;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await ensureUser(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown) => typeof id === "string" && id.trim())
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
    console.error("[intl/media/resolve] error", error);
    return NextResponse.json({ error: "Failed to resolve media URLs" }, { status: 500 });
  }
}
