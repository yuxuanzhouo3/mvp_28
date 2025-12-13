import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
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
      console.warn("[media/delete] deleteFile non-fatal", err);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to delete files" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("[media/delete] unexpected error", err);
    return new Response(
      JSON.stringify({ success: false, error: "Invalid request" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
