import { NextRequest, NextResponse } from "next/server";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getUserFromRequest } from "@/lib/auth-helper";
import { internationalProviderFetch } from "@/lib/international-http";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_VIDEO_MB = 256;
const rawVideoLimit = Number(process.env.MAX_VIDEO_UPLOAD_MB ?? DEFAULT_VIDEO_MB);
const maxVideoSizeMB = Number.isFinite(rawVideoLimit) ? rawVideoLimit : DEFAULT_VIDEO_MB;
const maxVideoSizeBytes = maxVideoSizeMB * 1024 * 1024;
const videoUploadDisabled = maxVideoSizeMB <= 0;
const TWELVELABS_BASE_URL = (process.env.TWELVELABS_BASE_URL ?? "https://api.twelvelabs.io/v1.3").replace(/\/+$/, "");
const TWELVELABS_INDEX_NAME = process.env.TWELVELABS_INDEX_NAME ?? "morngpt-intl-video-index";
const TWELVELABS_TASK_CACHE_TTL_MS = 30 * 60 * 1000;
const TWELVELABS_VIDEO_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const INTL_TWELVELABS_PREWARM_ENABLED = true;
const INTL_TWELVELABS_PREWARM_BUDGET_MS = 1200;
const INTL_TWELVELABS_PREWARM_POLL_WINDOW_MS = 3500;
const INTL_TWELVELABS_PREWARM_POLL_INTERVAL_MS = 700;

type SharedIntlVideoCache = {
  videoIds: Map<string, { videoId: string; expiresAt: number }>;
  tasks: Map<string, { taskId: string; expiresAt: number }>;
};

function getSharedIntlVideoCache() {
  const globalScope = globalThis as typeof globalThis & {
    __intlTwelveLabsVideoCache?: SharedIntlVideoCache;
  };
  if (!globalScope.__intlTwelveLabsVideoCache) {
    globalScope.__intlTwelveLabsVideoCache = {
      videoIds: new Map<string, { videoId: string; expiresAt: number }>(),
      tasks: new Map<string, { taskId: string; expiresAt: number }>(),
    };
  }
  return globalScope.__intlTwelveLabsVideoCache;
}

const sharedIntlVideoCache = getSharedIntlVideoCache();

let cachedTwelveLabsIndexId: string | null = process.env.TWELVELABS_INDEX_ID ?? null;

function waitFor(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createVideoSourceCacheKey(videoSourceId: string) {
  return createHash("sha256").update(`source:${videoSourceId}`).digest("hex");
}

function writeCachedVideoId(cacheKey: string, videoId: string) {
  sharedIntlVideoCache.videoIds.set(cacheKey, {
    videoId,
    expiresAt: Date.now() + TWELVELABS_VIDEO_CACHE_TTL_MS,
  });
}

function writeCachedTwelveLabsTask(cacheKey: string, taskId: string) {
  sharedIntlVideoCache.tasks.set(cacheKey, {
    taskId,
    expiresAt: Date.now() + TWELVELABS_TASK_CACHE_TTL_MS,
  });
}

function deleteCachedTwelveLabsTask(cacheKey: string) {
  sharedIntlVideoCache.tasks.delete(cacheKey);
}

async function twelvelabsJson<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.TWELVELABS_API_KEY;
  if (!apiKey) throw new Error("Missing TWELVELABS_API_KEY");

  const headers = new Headers(init?.headers);
  headers.set("x-api-key", apiKey);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await internationalProviderFetch("twelvelabs", `${TWELVELABS_BASE_URL}${path}`, {
    ...(init ?? {}),
    headers,
  });
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(`TwelveLabs HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return (await response.json()) as T;
}

async function ensureTwelveLabsIndex() {
  if (cachedTwelveLabsIndexId) return cachedTwelveLabsIndexId;
  const query = new URLSearchParams({ index_name: TWELVELABS_INDEX_NAME, page_limit: "10" });
  const listed = await twelvelabsJson<{ data?: Array<{ _id?: string; index_name?: string }> }>(
    `/indexes?${query.toString()}`,
  );
  const found = (listed.data || []).find(
    (item) => item.index_name === TWELVELABS_INDEX_NAME && typeof item._id === "string",
  );
  if (found?._id) {
    cachedTwelveLabsIndexId = found._id;
    return cachedTwelveLabsIndexId;
  }
  const created = await twelvelabsJson<{ _id?: string }>("/indexes", {
    method: "POST",
    body: JSON.stringify({
      index_name: TWELVELABS_INDEX_NAME,
      models: [{ model_name: "pegasus1.2", model_options: ["visual", "audio"] }],
    }),
  });
  if (!created._id) throw new Error("TwelveLabs create index failed");
  cachedTwelveLabsIndexId = created._id;
  return cachedTwelveLabsIndexId;
}

async function primeTwelveLabsTask(
  sourceVideoId: string,
  videoBuffer: Buffer,
  mimeType: string,
  originalFileName: string,
) {
  const apiKey = process.env.TWELVELABS_API_KEY;
  if (!INTL_TWELVELABS_PREWARM_ENABLED || !apiKey) return;

  const sourceCacheKey = createVideoSourceCacheKey(sourceVideoId);
  const indexId = await ensureTwelveLabsIndex();
  const safeName = originalFileName?.trim() || `video-${Date.now()}.mp4`;

  const formData = new FormData();
  formData.append("index_id", indexId);
  formData.append("video_file", new Blob([videoBuffer], { type: mimeType || "video/mp4" }), safeName);
  formData.append("enable_video_stream", "false");

  const task = await twelvelabsJson<{ _id?: string }>("/tasks", {
    method: "POST",
    body: formData,
  });
  if (!task._id) throw new Error("TwelveLabs create task failed");

  writeCachedTwelveLabsTask(sourceCacheKey, task._id);

  const deadline = Date.now() + INTL_TWELVELABS_PREWARM_POLL_WINDOW_MS;
  while (Date.now() < deadline) {
    const status = await twelvelabsJson<{ status?: string; video_id?: string }>("/tasks/" + task._id);
    const normalizedStatus = (status.status || "").toLowerCase();
    if (normalizedStatus === "ready" && status.video_id) {
      writeCachedVideoId(sourceCacheKey, status.video_id);
      deleteCachedTwelveLabsTask(sourceCacheKey);
      console.info("[intl/video/upload] prewarm ready", {
        sourceVideoId,
        taskId: task._id,
        videoId: status.video_id,
      });
      return;
    }
    if (normalizedStatus === "failed" || normalizedStatus === "error") {
      deleteCachedTwelveLabsTask(sourceCacheKey);
      return;
    }
    await waitFor(INTL_TWELVELABS_PREWARM_POLL_INTERVAL_MS);
  }
}

async function ensureUser(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  return auth?.userId || null;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await ensureUser(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const cloudPath = `intl/videos/${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;

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
      console.warn("[intl/video/upload] failed to get temp url", err);
    }

    if (INTL_TWELVELABS_PREWARM_ENABLED && process.env.TWELVELABS_API_KEY) {
      const prewarmStartAt = Date.now();
      const mimeType = (file.type || "video/mp4").split(";")[0] || "video/mp4";
      const prewarmPromise = primeTwelveLabsTask(uploadRes.fileID, buffer, mimeType, file.name || "video.mp4");
      const safePrewarmPromise = prewarmPromise.catch((error) => {
        console.warn(
          "[intl/video/upload] prewarm failed",
          error instanceof Error ? error.message : error,
        );
      });
      await Promise.race([safePrewarmPromise, waitFor(INTL_TWELVELABS_PREWARM_BUDGET_MS)]);
      console.info("[intl/video/upload] prewarm started", {
        fileId: uploadRes.fileID,
        budgetMs: INTL_TWELVELABS_PREWARM_BUDGET_MS,
        elapsedMs: Date.now() - prewarmStartAt,
      });
    }

    return NextResponse.json({ fileId: uploadRes.fileID, tempUrl });
  } catch (error) {
    console.error("[intl/video/upload] error", error);
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
        console.warn("[intl/video/upload delete] deleteFile non-fatal", err);
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[intl/video/upload delete] error", error);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
}
