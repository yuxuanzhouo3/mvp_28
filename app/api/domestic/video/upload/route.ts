import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_VIDEO_MB = 256;
const rawVideoLimit = Number(process.env.MAX_VIDEO_UPLOAD_MB ?? DEFAULT_VIDEO_MB);
const maxVideoSizeMB = Number.isFinite(rawVideoLimit) ? rawVideoLimit : DEFAULT_VIDEO_MB;
const maxVideoSizeBytes = maxVideoSizeMB * 1024 * 1024;
const videoUploadDisabled = maxVideoSizeMB <= 0;

async function getUser(req: NextRequest) {
  const token =
    req.cookies.get("auth-token")?.value ||
    req.headers.get("x-auth-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    null;
  if (!token) return null;
  const auth = new CloudBaseAuthService();
  return await auth.validateToken(token);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (videoUploadDisabled) {
      return NextResponse.json(
        { error: "video upload disabled (MAX_VIDEO_UPLOAD_MB<=0)" },
        { status: 403 },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const arrayBuf = await file.arrayBuffer();
    if (arrayBuf.byteLength > maxVideoSizeBytes) {
      return NextResponse.json(
        { error: `file too large (max ${Math.round(maxVideoSizeBytes / 1024 / 1024)}MB)` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(arrayBuf);
    const ext = file.name.split(".").pop() || "mp4";
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "") || "mp4";
    const cloudPath = `videos/${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.${safeExt}`;

    const connector = new CloudBaseConnector();
    await connector.initialize();
    const app = connector.getApp();

    const uploadRes = await app.uploadFile({ cloudPath, fileContent: buffer });

    // 获取临时访问链接，便于前端预览与模型读取
    let tempUrl: string | null = null;
    try {
      const tmp = await app.getTempFileURL({
        fileList: [{ fileID: uploadRes.fileID, maxAge: 600 }],
      });
      tempUrl = tmp?.fileList?.[0]?.tempFileURL || null;
    } catch (err) {
      console.warn("[video/upload] failed to get temp url", err);
    }

    return NextResponse.json({ fileId: uploadRes.fileID, tempUrl });
  } catch (error) {
    console.error("[video/upload] error", error);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
        console.warn("[video/upload delete] deleteFile non-fatal", err);
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[video/upload delete] error", error);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
}
