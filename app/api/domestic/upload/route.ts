import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_IMAGE_MB = 6;
const rawImageLimit = Number(process.env.MAX_IMAGE_UPLOAD_MB ?? DEFAULT_IMAGE_MB);
const maxImageSizeMB = Number.isFinite(rawImageLimit) ? rawImageLimit : DEFAULT_IMAGE_MB;
const maxImageSizeBytes = maxImageSizeMB * 1024 * 1024;
const imageUploadDisabled = maxImageSizeMB <= 0;

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

// 上传图片到 CloudBase 云存储，返回 fileId
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const cloudPath = `uploads/${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;

    const connector = new CloudBaseConnector();
    await connector.initialize();
    const app = connector.getApp();

    const res = await app.uploadFile({ cloudPath, fileContent: buffer });

    // 获取临时访问链接，便于前端直接预览 / 兜底传给模型
    let tempUrl: string | null = null;
    try {
      const tmp = await app.getTempFileURL({
        fileList: [{ fileID: res.fileID, maxAge: 600 }],
      });
      tempUrl = tmp?.fileList?.[0]?.tempFileURL || null;
    } catch (err) {
      console.warn("[upload] failed to get temp url", err);
    }

    console.log("[media][upload] file uploaded", {
      name: file.name,
      size: file.size,
      fileId: res.fileID,
      tempUrl: !!tempUrl,
    });

    return NextResponse.json({ fileId: res.fileID, tempUrl });
  } catch (error) {
    console.error("[upload] error", error);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}

// 删除已上传但未使用的图片，避免资源浪费
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
      // 若已被删或不存在，忽略
      const msg = (err as any)?.message?.toString?.() || "";
      if (!msg.toLowerCase().includes("not exist")) {
        console.warn("[upload delete] deleteFile non-fatal", err);
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[upload delete] error", error);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
}
