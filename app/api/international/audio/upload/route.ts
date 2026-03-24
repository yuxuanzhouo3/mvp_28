import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getUserFromRequest } from "@/lib/auth-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_AUDIO_MB = 100;
const rawAudioLimit = Number(process.env.MAX_AUDIO_UPLOAD_MB ?? DEFAULT_AUDIO_MB);
const maxAudioSizeMB = Number.isFinite(rawAudioLimit) ? rawAudioLimit : DEFAULT_AUDIO_MB;
const maxAudioSizeBytes = maxAudioSizeMB * 1024 * 1024;
const audioUploadDisabled = maxAudioSizeMB <= 0;

async function ensureUser(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  return auth?.userId || null;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await ensureUser(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (audioUploadDisabled) {
      return NextResponse.json(
        { error: "audio upload disabled (MAX_AUDIO_UPLOAD_MB<=0)" },
        { status: 403 },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const arrayBuf = await file.arrayBuffer();
    if (arrayBuf.byteLength > maxAudioSizeBytes) {
      return NextResponse.json(
        { error: `file too large (max ${Math.round(maxAudioSizeBytes / 1024 / 1024)}MB)` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(arrayBuf);
    const ext = file.name.split(".").pop() || "wav";
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "") || "wav";
    const cloudPath = `intl/audios/${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;

    const connector = new CloudBaseConnector();
    await connector.initialize();
    const app = connector.getApp();
    const uploadRes = await app.uploadFile({ cloudPath, fileContent: buffer });

    let tempUrl: string | null = null;
    try {
      const tmp = await app.getTempFileURL({
        fileList: [{ fileID: uploadRes.fileID, maxAge: 600 }],
      });
      tempUrl = tmp?.fileList?.[0]?.tempFileURL || null;
    } catch (err) {
      console.warn("[intl/audio/upload] failed to get temp url", err);
    }

    return NextResponse.json({ fileId: uploadRes.fileID, tempUrl });
  } catch (error) {
    console.error("[intl/audio/upload] error", error);
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
        console.warn("[intl/audio/upload delete] deleteFile non-fatal", err);
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[intl/audio/upload delete] error", error);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
}
