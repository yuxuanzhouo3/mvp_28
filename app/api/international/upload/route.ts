import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getUserFromRequest } from "@/lib/auth-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_IMAGE_MB = 6;
const rawImageLimit = Number(process.env.MAX_IMAGE_UPLOAD_MB ?? DEFAULT_IMAGE_MB);
const maxImageSizeMB = Number.isFinite(rawImageLimit) ? rawImageLimit : DEFAULT_IMAGE_MB;
const maxImageSizeBytes = maxImageSizeMB * 1024 * 1024;
const imageUploadDisabled = maxImageSizeMB <= 0;

async function ensureUser(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  return auth?.userId || null;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await ensureUser(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (imageUploadDisabled) {
      return NextResponse.json(
        { error: "image upload disabled (MAX_IMAGE_UPLOAD_MB<=0)" },
        { status: 403 },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const arrayBuf = await file.arrayBuffer();
    if (arrayBuf.byteLength > maxImageSizeBytes) {
      return NextResponse.json(
        { error: `file too large (max ${Math.round(maxImageSizeBytes / 1024 / 1024)}MB)` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(arrayBuf);
    const ext = file.name.split(".").pop() || "bin";
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "") || "bin";
    const cloudPath = `intl/uploads/${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;

    const connector = new CloudBaseConnector();
    await connector.initialize();
    const app = connector.getApp();
    const res = await app.uploadFile({ cloudPath, fileContent: buffer });

    let tempUrl: string | null = null;
    try {
      const tmp = await app.getTempFileURL({
        fileList: [{ fileID: res.fileID, maxAge: 600 }],
      });
      tempUrl = tmp?.fileList?.[0]?.tempFileURL || null;
    } catch (err) {
      console.warn("[intl/upload] failed to get temp url", err);
    }

    return NextResponse.json({ fileId: res.fileID, tempUrl });
  } catch (error) {
    console.error("[intl/upload] error", error);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await ensureUser(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const fileId = req.nextUrl.searchParams.get("fileId");
    if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });

    const connector = new CloudBaseConnector();
    await connector.initialize();
    const app = connector.getApp();

    try {
      await app.deleteFile({ fileList: [fileId] });
    } catch (err) {
      const msg = (err as any)?.message?.toString?.() || "";
      if (!msg.toLowerCase().includes("not exist")) {
        console.warn("[intl/upload delete] deleteFile non-fatal", err);
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[intl/upload delete] error", error);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
}
