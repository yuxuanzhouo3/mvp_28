import { NextRequest } from "next/server";
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
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const { fileIds } = (await req.json()) as { fileIds?: string[] };
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return Response.json({ success: true });
    }

    const connector = new CloudBaseConnector();
    await connector.initialize();
    const app = connector.getApp();

    try {
      await app.deleteFile({ fileList: fileIds });
    } catch (err) {
      console.warn("[intl/media/delete] deleteFile non-fatal", err);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to delete files" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("[intl/media/delete] unexpected error", err);
    return new Response(
      JSON.stringify({ success: false, error: "Invalid request" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
}
