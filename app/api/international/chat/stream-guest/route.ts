import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getInternationalProviderProxyStatus, internationalProviderFetch } from "@/lib/international-http";
import { getExpertModelDefinition, isExpertModelId } from "@/constants/expert-models";
import { createHash } from "node:crypto";
import {
  getModelCategory,
  getFreeContextMsgLimit,
  getBasicContextMsgLimit,
  getProContextMsgLimit,
  getEnterpriseContextMsgLimit,
  getQuotaExceededMessage,
  getImageCount,
  getVideoAudioCount,
} from "@/utils/model-limits";
import {
  checkSupabaseQuota,
  consumeSupabaseQuota,
  seedSupabaseWalletForPlan,
  checkSupabaseDailyExternalQuota,
  consumeSupabaseDailyExternalQuota,
  getSupabaseUserWallet,
} from "@/services/wallet-supabase";
import { getPlanInfo, truncateContextMessages } from "@/utils/plan-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GEMMA_MODEL_ID = "gemma-3-4b-it";
const VOXTRAL_MODEL_ID = "voxtral-mini-latest";
const TWELVELABS_MODEL_ID = "twelvelabs-pegasus-1.2";
const INTERNATIONAL_GENERAL_MODEL_ID = "mistral-small-latest";

const MISTRAL_BASE_URL = (process.env.MISTRAL_BASE_URL ?? "https://api.mistral.ai/v1").replace(/\/+$/, "");
const MISTRAL_CHAT_URL = `${MISTRAL_BASE_URL}/chat/completions`;
const MISTRAL_AUDIO_TRANSCRIBE_URL = `${MISTRAL_BASE_URL}/audio/transcriptions`;
const GEMINI_BASE_URL = (process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
const TWELVELABS_BASE_URL = (process.env.TWELVELABS_BASE_URL ?? "https://api.twelvelabs.io/v1.3").replace(/\/+$/, "");
const TWELVELABS_INDEX_NAME = process.env.TWELVELABS_INDEX_NAME ?? "morngpt-intl-video-index";
const TWELVELABS_VIDEO_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const TWELVELABS_ANALYSIS_CACHE_TTL_MS = 10 * 60 * 1000;
const TWELVELABS_TASK_CACHE_TTL_MS = 30 * 60 * 1000;
const TWELVELABS_REQUEST_MAX_RETRIES = 2;
const TWELVELABS_REQUEST_BASE_DELAY_MS = 1200;
const TWELVELABS_TASK_POLL_WAIT_MS = 10000;
const TWELVELABS_TASK_POLL_INTERVAL_MS = 900;
const INTL_VIDEO_ULTRA_SPEED_MODE = false;
const ENABLE_INTL_VIDEO_SECOND_PASS = true;
const VIDEO_QA_PROMPT_ZH =
  "你将基于视频内容和用户问题进行分析。必须严格使用中文简体回答，禁止切换到其他语言。除非用户明确要求时间轴，否则禁止逐秒罗列画面。";
const VIDEO_QA_PROMPT_EN =
  "You will analyze the video content against the user's question. Respond strictly in English. Do not provide second-by-second timelines unless explicitly requested.";
const VIDEO_POST_PROCESS_PROMPT =
  "你将收到视频分析结果。请忽略时间戳、重复片段标记和机械罗列，优先提炼真实画面内容（场景、主体、动作、字幕含义）后回答用户问题。若输入含其他语言内容，先翻译为目标语言再输出。";
const VIDEO_RETRY_EXTRA_ZH =
  "补充要求：忽略时间戳、区间标记和重复片段提示，直接描述可见画面内容（场景、主体、动作、字幕文字、颜色/光线）。若画面静止，也要说明画面中的具体对象。不要只输出“无法判断/未提供描述”这类泛化结论。";
const VIDEO_RETRY_EXTRA_EN =
  "Additional requirements: ignore timestamps, range markers, and repetition tags. Describe concrete visual content (scene, subjects, actions, visible text, color/lighting). If the scene is static, still describe visible objects. Avoid generic answers like 'cannot determine' unless the video is truly unreadable.";

const GUEST_CONTEXT_LIMIT = 5;
const GUEST_DAILY_LIMIT = (() => {
  const raw = process.env.NEXT_PUBLIC_TRIAL_DAILY_LIMIT || "10";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(100, n);
})();

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

const ipRateLimitCache = new Map<string, { count: number; resetTime: number }>();
let cachedTwelveLabsIndexId: string | null = process.env.TWELVELABS_INDEX_ID ?? null;
const sharedIntlVideoCache = getSharedIntlVideoCache();
const cachedTwelveLabsVideoIds = sharedIntlVideoCache.videoIds;
const cachedTwelveLabsTasks = sharedIntlVideoCache.tasks;
const cachedTwelveLabsAnalysis = new Map<string, { text: string; expiresAt: number }>();

type IncomingMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  images?: string[];
  videos?: string[];
  audios?: string[];
};

type ErrorWithStatus = Error & { statusCode?: number };

function fail(message: string, statusCode: number): ErrorWithStatus {
  const error = new Error(message) as ErrorWithStatus;
  error.statusCode = statusCode;
  return error;
}

function createVideoSourceCacheKey(videoSourceId: string) {
  return createHash("sha256").update(`source:${videoSourceId}`).digest("hex");
}

function createVideoUrlCacheKey(videoUrl: string) {
  const sampled = `${videoUrl.slice(0, 2048)}|${videoUrl.slice(-2048)}`;
  return createHash("sha256").update(`url:${videoUrl.length}:${sampled}`).digest("hex");
}

function readCachedVideoId(cacheKey: string) {
  const entry = cachedTwelveLabsVideoIds.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cachedTwelveLabsVideoIds.delete(cacheKey);
    return null;
  }
  return entry.videoId;
}

function writeCachedVideoId(cacheKey: string, videoId: string) {
  cachedTwelveLabsVideoIds.set(cacheKey, {
    videoId,
    expiresAt: Date.now() + TWELVELABS_VIDEO_CACHE_TTL_MS,
  });
}

function readCachedTwelveLabsTask(cacheKey: string) {
  const entry = cachedTwelveLabsTasks.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cachedTwelveLabsTasks.delete(cacheKey);
    return null;
  }
  return entry.taskId;
}

function writeCachedTwelveLabsTask(cacheKey: string, taskId: string) {
  cachedTwelveLabsTasks.set(cacheKey, {
    taskId,
    expiresAt: Date.now() + TWELVELABS_TASK_CACHE_TTL_MS,
  });
}

function deleteCachedTwelveLabsTask(cacheKey: string) {
  cachedTwelveLabsTasks.delete(cacheKey);
}

function createAnalysisCacheKey(videoId: string, prompt: string, language: "zh" | "en") {
  return createHash("sha256").update(`${videoId}\n${language}\n${prompt}`).digest("hex");
}

function readCachedAnalysis(cacheKey: string) {
  const entry = cachedTwelveLabsAnalysis.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cachedTwelveLabsAnalysis.delete(cacheKey);
    return null;
  }
  return entry.text;
}

function writeCachedAnalysis(cacheKey: string, text: string) {
  cachedTwelveLabsAnalysis.set(cacheKey, {
    text,
    expiresAt: Date.now() + TWELVELABS_ANALYSIS_CACHE_TTL_MS,
  });
}

function resolveEffectiveLanguage(inputLanguage: string | undefined, userText: string): "zh" | "en" {
  if (/[\u4e00-\u9fff]/.test(userText || "")) return "zh";
  return inputLanguage === "zh" ? "zh" : "en";
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function checkIpRateLimit(ip: string) {
  const now = Date.now();
  const todayEnd = new Date().setHours(23, 59, 59, 999);
  const record = ipRateLimitCache.get(ip);

  if (!record || record.resetTime < now) {
    ipRateLimitCache.set(ip, { count: 1, resetTime: todayEnd });
    return { allowed: true, remaining: GUEST_DAILY_LIMIT - 1 };
  }
  if (record.count >= GUEST_DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  record.count += 1;
  return { allowed: true, remaining: GUEST_DAILY_LIMIT - record.count };
}

function getContextLimit(planLower: string): number {
  if (planLower === "basic") return getBasicContextMsgLimit();
  if (planLower === "pro") return getProContextMsgLimit();
  if (planLower === "enterprise") return getEnterpriseContextMsgLimit();
  return getFreeContextMsgLimit();
}

function extractMistralText(data: any): string {
  const choice = data?.choices?.[0];
  if (!choice) return "";
  const content = choice.message?.content ?? choice.delta?.content;
  if (Array.isArray(content)) return content.map((item: any) => item?.text ?? "").join("");
  return typeof content === "string" ? content : "";
}

function splitChunks(text: string, size = 120) {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}

function waitFor(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getNestedErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  if ("cause" in error) {
    return getNestedErrorCode((error as { cause?: unknown }).cause);
  }
  return null;
}

function getErrorStatusCode(error: unknown): number {
  if (error && typeof error === "object" && "statusCode" in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === "number") return statusCode;
  }
  return 500;
}

function getResponseHeaderValue(error: unknown, headerName: string): string | null {
  if (!error || typeof error !== "object" || !("responseHeaders" in error)) return null;
  const rawHeaders = (error as { responseHeaders?: unknown }).responseHeaders;
  if (!rawHeaders || typeof rawHeaders !== "object") return null;

  if ("get" in rawHeaders && typeof (rawHeaders as { get?: unknown }).get === "function") {
    const value = (rawHeaders as { get: (name: string) => string | null }).get(headerName);
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  }

  const headerKey = headerName.toLowerCase();
  const entries = rawHeaders as Record<string, string | string[] | undefined>;
  const direct = entries[headerKey] ?? entries[headerName];
  if (typeof direct === "string") return direct.trim().length > 0 ? direct.trim() : null;
  if (Array.isArray(direct) && direct.length > 0) {
    const first = direct[0];
    return typeof first === "string" && first.trim().length > 0 ? first.trim() : null;
  }
  return null;
}

function getRetryDelayMs(error: unknown, attempt: number, baseDelayMs: number) {
  const retryAfter = getResponseHeaderValue(error, "retry-after");
  if (retryAfter) {
    const asSeconds = Number(retryAfter);
    if (Number.isFinite(asSeconds) && asSeconds >= 0) {
      return Math.ceil(asSeconds * 1000);
    }
    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) {
      const waitMs = retryAt - Date.now();
      if (waitMs > 0) return waitMs;
    }
  }
  const jitter = Math.floor(Math.random() * 250);
  return baseDelayMs * Math.pow(2, attempt) + jitter;
}

function isNetworkConnectionError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const normalizedMessage = rawMessage.toLowerCase();
  const errorCode = (getNestedErrorCode(error) ?? "").toUpperCase();
  if (
    errorCode === "ECONNRESET" ||
    errorCode === "ETIMEDOUT" ||
    errorCode === "ECONNREFUSED" ||
    errorCode === "EAI_AGAIN" ||
    errorCode === "ENOTFOUND" ||
    errorCode === "EPIPE"
  ) {
    return true;
  }
  return (
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("socket disconnected") ||
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("tls connection")
  );
}

function isRetryableHttpStatus(statusCode: number) {
  return statusCode === 408 || statusCode === 409 || statusCode === 429 || statusCode >= 500;
}

function resolveMediaUrl(id: string, mediaUrlMap: Record<string, string>) {
  if (!id) return null;
  if (/^https?:\/\//i.test(id)) return id;
  return mediaUrlMap[id] || null;
}

function findLatestMediaId(messages: IncomingMessage[], kind: "images" | "videos" | "audios") {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const list = messages[i]?.[kind];
    if (Array.isArray(list) && list.length > 0) {
      return list[0];
    }
  }
  return null;
}

async function findLatestConversationVideoId(conversationId: string, userId: string) {
  if (!conversationId || !userId || !supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from("messages")
      .select("video_file_ids, created_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      console.warn("[intl/video] find latest conversation video failed", error.message);
      return null;
    }
    for (const row of data || []) {
      const ids = Array.isArray((row as any).video_file_ids) ? (row as any).video_file_ids : [];
      if (ids.length > 0 && typeof ids[0] === "string") return ids[0];
    }
    return null;
  } catch (error) {
    console.warn("[intl/video] find latest conversation video error", error instanceof Error ? error.message : error);
    return null;
  }
}

async function resolveMediaUrlMap(messages: IncomingMessage[]) {
  const ids = messages
    .flatMap((message) => [...(message.images || []), ...(message.videos || []), ...(message.audios || [])])
    .filter((item) => typeof item === "string" && item.length > 0 && !/^https?:\/\//i.test(item));
  const unique = Array.from(new Set(ids));
  if (!unique.length) return {} as Record<string, string>;

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const app = connector.getApp();
  const res = await app.getTempFileURL({
    fileList: unique.map((fileID) => ({ fileID, maxAge: 600 })),
  });
  return Object.fromEntries(
    (res.fileList || [])
      .filter((item: any) => item?.fileID && item?.tempFileURL)
      .map((item: any) => [item.fileID, item.tempFileURL]),
  );
}

async function requestMistral(modelId: string, messages: IncomingMessage[], language?: string) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw fail("Missing MISTRAL_API_KEY", 400);

  const response = await internationalProviderFetch("mistral", MISTRAL_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(language === "zh" ? { "Accept-Language": "zh-CN,zh;q=0.9" } : { "Accept-Language": "en-US,en;q=0.9" }),
    },
    body: JSON.stringify({
      model: modelId,
      messages: messages.map((m) => ({ role: m.role, content: m.content || "" })),
      stream: false,
      temperature: 0.7,
    }),
  });

  if (!response.ok) throw fail(await response.text() || "Mistral upstream error", response.status || 500);
  const data = await response.json();
  const text = extractMistralText(data).trim();
  if (!text) throw fail(language === "zh" ? "模型未返回可显示内容。" : "No readable content returned.", 502);
  return text;
}

type GemmaPart = { text?: string; inlineData?: { mimeType: string; data: string } };
type GemmaContent = { role: "user" | "model"; parts: GemmaPart[] };

async function buildGemmaContents(messages: IncomingMessage[], mediaUrlMap: Record<string, string>) {
  const contents: GemmaContent[] = [];
  for (const message of messages) {
    const role: "user" | "model" = message.role === "assistant" ? "model" : "user";
    const parts: GemmaPart[] = [];
    if ((message.content || "").trim()) parts.push({ text: message.content });
    for (const imageId of message.images || []) {
      const url = resolveMediaUrl(imageId, mediaUrlMap);
      if (!url) continue;
      const imageRes = await internationalProviderFetch("gemini", url);
      if (!imageRes.ok) throw fail(`Failed to fetch image (HTTP ${imageRes.status})`, 400);
      const mime = (imageRes.headers.get("content-type") || "image/jpeg").split(";")[0];
      const data = Buffer.from(await imageRes.arrayBuffer()).toString("base64");
      parts.push({ inlineData: { mimeType: mime, data } });
    }
    if (!parts.length) parts.push({ text: " " });
    contents.push({ role, parts });
  }
  return contents;
}

function extractGeminiCandidateText(payload: any): string {
  return (payload?.candidates?.[0]?.content?.parts || [])
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join("");
}

async function enforceOutputLanguage(text: string, language: "zh" | "en") {
  const raw = (text || "").trim();
  if (!raw) return raw;
  if (language !== "zh") return raw;

  const cjkMatches = raw.match(/[\u4e00-\u9fff]/g) || [];
  const latinMatches = raw.match(/[A-Za-z]/g) || [];
  const hasJapaneseKana = /[\u3040-\u30ff]/.test(raw);
  const hasCjk = cjkMatches.length > 0;
  const hasLatin = latinMatches.length > 0;
  const dominantLatin = hasLatin && (!hasCjk || latinMatches.length > cjkMatches.length * 1.2);

  if (!hasJapaneseKana && !dominantLatin) return raw;

  try {
    const rewritten = await requestMistral(
      INTERNATIONAL_GENERAL_MODEL_ID,
      [
        {
          role: "user",
          content:
            `请将以下内容逐句翻译为中文简体，仅输出翻译结果。禁止补充、臆测或改写原文不存在的信息：\n\n${raw}`,
        },
      ],
      "zh",
    );
    return (rewritten || raw).trim();
  } catch (error) {
    console.warn("[intl/lang] enforce zh rewrite failed", error instanceof Error ? error.message : error);
    return raw;
  }
}

function detectVideoAnswerStyle(userQuestion: string) {
  const question = (userQuestion || "").trim();
  if (!question) return "brief";

  if (
    /一句话|一句|一行|单句|用一句|one sentence|single sentence/i.test(question)
  ) {
    return "one_sentence";
  }

  if (/简短|简要|简洁|brief|short|concise/i.test(question)) {
    return "brief";
  }

  return "normal";
}

function buildVideoAnswerFormatRule(userQuestion: string, language: "zh" | "en") {
  const style = detectVideoAnswerStyle(userQuestion);
  if (language === "zh") {
    if (style === "one_sentence") {
      return "输出格式：用户要求一句话。你必须只输出一句中文，不超过40字，禁止分点和换行。";
    }
    if (style === "brief") {
      return "输出格式：简短回答，最多2句中文，不分点。";
    }
    return "输出格式：先给结论，再给2-3条关键点，总长度不超过140字。";
  }

  if (style === "one_sentence") {
    return "Output format: user asked for one sentence. Return exactly one sentence, no bullets.";
  }
  if (style === "brief") {
    return "Output format: brief answer, at most 2 sentences, no bullets.";
  }
  return "Output format: conclusion first, then 2-3 key points, within 90 words total.";
}

function enforceVideoAnswerStyle(text: string, userQuestion: string, language: "zh" | "en") {
  const style = detectVideoAnswerStyle(userQuestion);
  const raw = (text || "").replace(/\s+/g, " ").trim();
  if (!raw) return raw;
  if (style !== "one_sentence") return raw;

  if (language === "zh") {
    const first = raw.match(/.*?[。！？!?]/)?.[0]?.trim() || raw.split(/[;；]/)[0]?.trim() || raw;
    const trimmed = first.length > 42 ? `${first.slice(0, 41)}。` : first;
    return trimmed.replace(/[，,]\s*$/, "。");
  }

  const first = raw.match(/.*?[.!?]/)?.[0]?.trim() || raw.split(/[:;]/)[0]?.trim() || raw;
  const trimmed = first.length > 180 ? `${first.slice(0, 179)}.` : first;
  return trimmed;
}

function extractFaithfulSingleSentenceFromAnalysis(
  cleanedAnalysis: string,
  rawAnalysis: string,
  language: "zh" | "en",
) {
  const lowInfoPattern =
    language === "zh"
      ? /(无法判断|未提供具体|无法识别|无法提取|信息不足|重复播放|缺乏动态)/i
      : /(cannot determine|unable to determine|insufficient|no specific visual)/i;
  const visualHintPattern =
    /(视频|画面|镜头|出现|可见|海|月|船|字幕|天空|海面|shows?|video|scene|frame|boat|moon|sea|screen|subtitle|interface)/i;

  const lines = `${cleanedAnalysis}\n${rawAnalysis}`
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^[-*•\u2022]+/, "")
        .replace(/^\d+[\.\)]\s*/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => line.length > 0);

  const seen = new Set<string>();
  let best = "";
  let bestScore = -1;

  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    if (!/[A-Za-z\u4e00-\u9fff]/.test(line)) continue;
    if (line.length < (language === "zh" ? 6 : 10)) continue;
    if (lowInfoPattern.test(line)) continue;

    const timelineStats = countTimelineTokens(line);
    if (timelineStats.total >= 4 && line.length < 42) continue;

    let score = 0;
    if (visualHintPattern.test(line)) score += 2;
    if (timelineStats.total === 0) score += 1;
    if (line.length >= 12 && line.length <= 140) score += 1;

    if (score > bestScore) {
      best = line;
      bestScore = score;
    }
  }

  return best.trim();
}

function isOneSentenceGroundedInSource(
  sentence: string,
  sourceText: string,
  language: "zh" | "en",
) {
  const sentenceText = (sentence || "").trim();
  const source = (sourceText || "").trim();
  if (!sentenceText || !source) return true;

  if (language === "zh") {
    const stop = new Set([
      "视频",
      "画面",
      "这个",
      "内容",
      "出现",
      "可以",
      "看到",
      "一只",
      "一个",
      "正在",
      "中有",
      "视频中",
    ]);
    const tokens = (sentenceText.match(/[\u4e00-\u9fff]{2,5}/g) || []).filter((t) => !stop.has(t));
    if (!tokens.length) return true;
    const matched = tokens.filter((t) => source.includes(t)).length;
    return matched / tokens.length >= 0.5;
  }

  const words = (sentenceText.toLowerCase().match(/[a-z]{4,}/g) || []).filter(
    (w) => !["video", "scene", "shows", "showing", "there", "with", "from", "this"].includes(w),
  );
  if (!words.length) return true;
  const sourceLower = source.toLowerCase();
  const matched = words.filter((w) => sourceLower.includes(w)).length;
  return matched / words.length >= 0.5;
}

function truncateVideoText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[Video analysis truncated for summarization]`;
}

function countTimelineTokens(text: string) {
  const timeTokens = text.match(/\b\d{2}:\d{2}\b/g) || [];
  const secondTokens = text.match(/\b\d+\s*s\b/gi) || [];
  return {
    timeTokenCount: timeTokens.length,
    secondTokenCount: secondTokens.length,
    total: timeTokens.length + secondTokens.length,
    uniqueTimeTokenCount: new Set(timeTokens.map((token) => token.trim())).size,
  };
}

function sanitizeVideoAnalysisText(rawAnalysisText: string) {
  const cleanedLines = rawAnalysisText
    .replace(/\r/g, "\n")
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) =>
      line
        .replace(/^video\s*content\s*:\s*/i, "")
        .replace(/^video\s*\d+\s*:\s*/i, "")
        .replace(/^\d+\s*s\s*\(\d{2}:\d{2}\)\s*~\s*\d+\s*s\s*\(\d{2}:\d{2}\)\s*:\s*/i, "")
        .replace(/^\d{2}:\d{2}\s*[-~]\s*\d{2}:\d{2}\s*:\s*/i, "")
        .replace(/\b\d+\s*s\s*\(\d{2}:\d{2}\)\s*~\s*\d+\s*s\s*\(\d{2}:\d{2}\)\b/gi, " ")
        .replace(/\b\d{2}:\d{2}\s*[-~]\s*\d{2}:\d{2}\b/g, " ")
        .replace(/\b\d+\s*s\b/gi, " ")
        .replace(/\b\d{2}:\d{2}\b/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => {
      const compact = line
        .replace(/\b\d+s\b/g, "")
        .replace(/\b\d{2}:\d{2}\b/g, "")
        .replace(/[()\[\]{}:~\-\s]/g, "");
      return compact.length > 1;
    });

  const dedupedLines: string[] = [];
  const seen = new Set<string>();
  for (const line of cleanedLines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedLines.push(line);
    if (dedupedLines.length >= 24) break;
  }

  if (dedupedLines.length === 0) {
    return truncateVideoText(rawAnalysisText, 7000);
  }

  return dedupedLines.join("\n");
}

function isLikelyNoisyVideoAnalysis(text: string) {
  const raw = text || "";
  const timelineRangePattern =
    /\d{2}:\d{2}\s*[-~]\s*\d{2}:\d{2}|\d+\s*s\s*\(\d{2}:\d{2}\)\s*~\s*\d+\s*s\s*\(\d{2}:\d{2}\)/g;
  const timelineRangeMatches = (raw.match(timelineRangePattern) || []).length;
  const commaCount = (raw.match(/,/g) || []).length;
  const hasVideoContentPrefix = /video\s*content\s*:/i.test(raw);
  const prefixedTimelineLines = raw
    .split(/\r?\n/)
    .filter((line) => /^\s*(video\s*content\s*:|video\s*\d+\s*:|\d+\s*s\s*\(\d{2}:\d{2}\)|\d{2}:\d{2}\s*[-~])/.test(line))
    .length;
  const {
    timeTokenCount,
    secondTokenCount,
    total: totalTimelineTokenCount,
    uniqueTimeTokenCount,
  } = countTimelineTokens(raw);

  const repeatedTimeNoise =
    timeTokenCount >= 8 &&
    uniqueTimeTokenCount > 0 &&
    uniqueTimeTokenCount <= Math.max(4, Math.floor(timeTokenCount / 3));
  const repeatedSecondsNoise = secondTokenCount >= 8 && uniqueTimeTokenCount <= 4;
  const denseTimelineNoise = totalTimelineTokenCount >= 10 && raw.length <= 900;

  return (
    raw.length > 1000 ||
    timelineRangeMatches >= 2 ||
    commaCount >= 28 ||
    (hasVideoContentPrefix && totalTimelineTokenCount >= 6) ||
    prefixedTimelineLines >= 4 ||
    repeatedTimeNoise ||
    repeatedSecondsNoise ||
    denseTimelineNoise
  );
}

function isTextLikelyInLanguage(text: string, language: "zh" | "en") {
  const normalized = (text || "").trim();
  if (!normalized) return false;
  if (language === "zh") {
    return /[\u4e00-\u9fff]/.test(normalized) && !/[\u3040-\u30ff]/.test(normalized);
  }
  return /[A-Za-z]/.test(normalized);
}

function buildVideoQaPrompt(userQuestion: string, language: "zh" | "en") {
  const question =
    userQuestion?.trim() ||
    (language === "zh" ? "请总结这个视频并提取关键要点。" : "Please summarize this video and extract key points.");
  const answerFormatRule = buildVideoAnswerFormatRule(question, language);

  if (language === "zh") {
    return [
      VIDEO_QA_PROMPT_ZH,
      "目标语言：中文简体（zh-Hans）。回答必须完全使用中文简体，不要夹杂日文或英文句子。",
      answerFormatRule,
      "",
      `用户问题：${question}`,
    ].join("\n");
  }

  return [
    VIDEO_QA_PROMPT_EN,
    "Target language: English. Respond fully in English only.",
    answerFormatRule,
    "",
    `User question: ${question}`,
  ].join("\n");
}

function buildVideoSummaryQuestion(language: "zh" | "en") {
  if (language === "zh") {
    return "请简短描述这个视频的核心内容，最多2句，不要时间轴。";
  }
  return "Please briefly describe the core content of this video in at most 2 sentences, without timeline.";
}

function buildVideoSummaryQaPrompt(
  userQuestion: string,
  videoSummary: string,
  language: "zh" | "en",
) {
  const question =
    userQuestion?.trim() ||
    (language === "zh"
      ? "请基于视频内容给出关键结论。"
      : "Please answer based on the video content.");
  const answerFormatRule = buildVideoAnswerFormatRule(question, language);
  const normalizedSummary = truncateVideoText((videoSummary || "").trim(), 2000);

  if (language === "zh") {
    return [
      "你将收到“视频内容摘要”和“用户问题”。",
      "请仅基于摘要回答，禁止编造摘要之外的细节；若信息不足请明确说明。",
      answerFormatRule,
      "",
      `用户问题：${question}`,
      "",
      "视频内容摘要：",
      normalizedSummary,
      "",
      "请直接输出最终回答。",
    ].join("\n");
  }

  return [
    "You will receive a video summary and a user question.",
    "Answer strictly from the summary. Do not invent details not present in the summary; if evidence is insufficient, say so clearly.",
    answerFormatRule,
    "",
    `User question: ${question}`,
    "",
    "Video summary:",
    normalizedSummary,
    "",
    "Return only the final answer.",
  ].join("\n");
}

function isLowInformationVideoAnalysis(text: string, language: "zh" | "en") {
  const raw = (text || "").trim();
  if (!raw) return true;
  if (raw.length < 48) return true;

  const timelineStats = countTimelineTokens(raw);
  const cjkCount = (raw.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinCount = (raw.match(/[A-Za-z]/g) || []).length;
  const informativeCharCount = cjkCount + latinCount;

  const zhLowInfoPattern =
    /(未提供具体画面描述|无法判断视频主题|无法判断(视频|画面|内容)|重复播放(的)?固定画面|缺乏动态变化|未包含具体画面|无法提取(有效)?信息|无法识别(具体)?内容)/;
  const enLowInfoPattern =
    /(cannot determine|unable to determine|no specific visual details|repetitive fixed frames|insufficient visual information|cannot identify specific content)/i;

  const hasLowInfoPhrase =
    language === "zh" ? zhLowInfoPattern.test(raw) : enLowInfoPattern.test(raw);
  const timelineDominated =
    timelineStats.total >= 8 && informativeCharCount < 140;
  const lowDensity =
    informativeCharCount > 0 &&
    raw.length >= 120 &&
    informativeCharCount / raw.length < 0.35;

  return hasLowInfoPhrase || timelineDominated || lowDensity;
}

function buildVideoPostProcessPrompt(
  userQuestion: string,
  rawAnalysisText: string,
  language: "zh" | "en",
) {
  const question = userQuestion?.trim() || (language === "zh" ? "请一句话说明这个视频的主要内容。" : "Summarize this video briefly.");
  const languageRule =
    language === "zh"
      ? "目标语言：中文简体（zh-Hans）。回答必须完全使用中文简体，不要夹杂日文或英文句子。"
      : "Target language: English. Respond fully in English only.";
  const answerFormatRule = buildVideoAnswerFormatRule(question, language);
  const cleaned = sanitizeVideoAnalysisText(rawAnalysisText);
  const timelineRule =
    language === "zh"
      ? "除非用户明确要求时间线，否则不要按秒罗列。"
      : "Do not provide second-by-second timelines unless explicitly requested.";
  const questionLabel = language === "zh" ? "用户问题" : "User question";
  const cleanedLabel = language === "zh" ? "清洗后的视频分析结果" : "Cleaned video analysis";

  return [
    VIDEO_POST_PROCESS_PROMPT,
    languageRule,
    language === "zh"
      ? "严格要求：只能基于给定分析文本回答，严禁编造分析文本中不存在的对象、动作、地点。"
      : "Strict rule: answer only from the provided analysis text and do not invent objects, actions, or scenes not present.",
    answerFormatRule,
    timelineRule,
    "",
    `${questionLabel}: ${question}`,
    "",
    `${cleanedLabel}:`,
    truncateVideoText(cleaned, 7000),
  ].join("\n");
}

async function normalizeVideoAnalysisOutput(
  text: string,
  language: "zh" | "en",
  userQuestion: string,
) {
  const raw = (text || "").trim();
  if (!raw) return raw;

  const cleaned = sanitizeVideoAnalysisText(raw);
  const rawTimelineStats = countTimelineTokens(raw);
  const cleanedTimelineStats = countTimelineTokens(cleaned);
  const shouldPostProcess =
    isLikelyNoisyVideoAnalysis(raw) ||
    isLowInformationVideoAnalysis(raw, language) ||
    !isTextLikelyInLanguage(cleaned, language) ||
    cleanedTimelineStats.total >= 4;

  console.info("[intl/video] normalize analysis", {
    language,
    rawLength: raw.length,
    cleanedLength: cleaned.length,
    rawTimeTokenCount: rawTimelineStats.timeTokenCount,
    rawSecondTokenCount: rawTimelineStats.secondTokenCount,
    cleanedTimeTokenCount: cleanedTimelineStats.timeTokenCount,
    cleanedSecondTokenCount: cleanedTimelineStats.secondTokenCount,
    shouldPostProcess,
  });

  if (INTL_VIDEO_ULTRA_SPEED_MODE) {
    const fastNormalized = enforceVideoAnswerStyle(
      truncateVideoText(cleaned, 2200).trim(),
      userQuestion,
      language,
    );
    console.info("[intl/video] normalize ultra-speed", {
      language,
      outputLength: fastNormalized.length,
      skippedPostProcess: shouldPostProcess,
    });
    return fastNormalized;
  }

  if (!shouldPostProcess) {
    return enforceVideoAnswerStyle(
      truncateVideoText(cleaned, 7000).trim(),
      userQuestion,
      language,
    );
  }

  const prompt = buildVideoPostProcessPrompt(userQuestion, raw, language);
  try {
    const rewritten = await requestMistral(
      INTERNATIONAL_GENERAL_MODEL_ID,
      [{ role: "user", content: prompt }],
      language,
    );
    let normalized = enforceVideoAnswerStyle(
      (rewritten || truncateVideoText(cleaned, 7000)).trim(),
      userQuestion,
      language,
    );
    const answerStyle = detectVideoAnswerStyle(userQuestion);
    if (answerStyle === "one_sentence") {
      const sourceText = `${cleaned}\n${raw}`.trim();
      if (!isOneSentenceGroundedInSource(normalized, sourceText, language)) {
        const fallback = extractFaithfulSingleSentenceFromAnalysis(cleaned, raw, language);
        if (fallback) {
          normalized = enforceVideoAnswerStyle(fallback, userQuestion, language);
          console.info("[intl/video] one-sentence fallback from source", {
            language,
            fallbackLength: normalized.length,
          });
        }
      }
    }
    console.info("[intl/video] normalize rewritten", {
      language,
      rewrittenLength: (rewritten || "").trim().length,
      outputLength: normalized.length,
    });
    return normalized;
  } catch (error) {
    console.warn("[intl/video] normalize noisy output failed", error instanceof Error ? error.message : error);
    return enforceVideoAnswerStyle(
      truncateVideoText(cleaned, 7000).trim(),
      userQuestion,
      language,
    );
  }
}

async function streamGemmaResponse(
  messages: IncomingMessage[],
  mediaUrlMap: Record<string, string>,
  language: string | undefined,
  requestSignal: AbortSignal,
  onCompleted?: (outputText: string, hasModelOutput: boolean) => Promise<void> | void,
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw fail("Missing GEMINI_API_KEY", 400);

  const totalImages = messages.reduce((sum, item) => sum + (item.images?.length || 0), 0);
  console.info("[intl/gemma] stream request start", {
    model: GEMMA_MODEL_ID,
    messageCount: messages.length,
    totalImages,
    proxyStatus: getInternationalProviderProxyStatus("gemini"),
  });

  try {
    const contents = await buildGemmaContents(messages, mediaUrlMap);
    const endpoint = `${GEMINI_BASE_URL}/models/${GEMMA_MODEL_ID}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
    const upstreamController = new AbortController();
    const abortUpstream = () => {
      if (upstreamController.signal.aborted) return;
      upstreamController.abort();
    };
    if (requestSignal.aborted) {
      abortUpstream();
    } else {
      requestSignal.addEventListener("abort", abortUpstream, { once: true });
    }

    const response = await internationalProviderFetch("gemini", endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(language === "zh" ? { "Accept-Language": "zh-CN,zh;q=0.9" } : { "Accept-Language": "en-US,en;q=0.9" }),
      },
      body: JSON.stringify({ contents, generationConfig: { temperature: 0.7 } }),
      signal: upstreamController.signal,
    });
    if (!response.ok || !response.body) {
      const upstreamError = (await response.text()).slice(0, 800);
      console.error("[intl/gemma] stream upstream error", {
        status: response.status,
        statusText: response.statusText,
        body: upstreamError,
      });
      throw fail(upstreamError || "Gemini upstream error", response.status || 500);
    }

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    (async () => {
      const reader = response.body!.getReader();
      let buffer = "";
      let emittedText = "";
      let accumulatedText = "";
      let hasModelOutput = false;
      let doneSent = false;
      let closed = false;
      let clientAborted = requestSignal.aborted || upstreamController.signal.aborted;

      const safeWrite = async (data: Uint8Array): Promise<boolean> => {
        if (closed) return false;
        try {
          await writer.write(data);
          return true;
        } catch {
          closed = true;
          clientAborted = true;
          abortUpstream();
          return false;
        }
      };

      const sendDone = async () => {
        if (doneSent) return;
        doneSent = true;
        await safeWrite(encoder.encode("data: [DONE]\n\n"));
      };

      const closeWriter = async () => {
        if (closed) return;
        closed = true;
        try { await writer.close(); } catch {}
      };

      const onClientAbort = () => {
        clientAborted = true;
        abortUpstream();
        closeWriter();
      };

      if (!requestSignal.aborted) {
        requestSignal.addEventListener("abort", onClientAbort, { once: true });
      }

      try {
        while (true) {
          if (clientAborted) break;
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            if (clientAborted) break;
            const line = rawLine.trim();
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const nextText = extractGeminiCandidateText(parsed);
              if (!nextText) continue;

              let delta = nextText;
              if (emittedText && nextText.startsWith(emittedText)) {
                delta = nextText.slice(emittedText.length);
                emittedText = nextText;
              } else {
                emittedText += nextText;
              }

              if (!delta) continue;
              const wrote = await safeWrite(encoder.encode(`data: ${JSON.stringify({ chunk: delta })}\n\n`));
              if (!wrote) break;
              hasModelOutput = true;
              accumulatedText += delta;
            } catch {
              // ignore malformed chunk
            }
          }
        }
      } catch (error) {
        if (!clientAborted) {
          await safeWrite(
            encoder.encode(
              `data: ${JSON.stringify({
                chunk: language === "zh" ? "抱歉，流式响应中断。" : "Stream interrupted.",
              })}\n\n`
            )
          );
        }
      } finally {
        if (!clientAborted && !hasModelOutput) {
          await safeWrite(
            encoder.encode(
              `data: ${JSON.stringify({
                chunk: language === "zh" ? "模型未返回可显示内容。" : "No readable content returned.",
              })}\n\n`
            )
          );
        }
        await sendDone();
        await closeWriter();

        try {
          await onCompleted?.(accumulatedText, hasModelOutput);
        } catch (error) {
          console.error("[intl/gemma] stream completion hook failed", error);
        }
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[intl/gemma] stream request failed", {
      model: GEMMA_MODEL_ID,
      messageCount: messages.length,
      totalImages,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

async function transcribeAudio(audioUrl: string) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw fail("Missing MISTRAL_API_KEY", 400);

  const audioRes = await internationalProviderFetch("mistral", audioUrl);
  if (!audioRes.ok) throw fail(`Failed to fetch audio (HTTP ${audioRes.status})`, 400);
  const mimeType = (audioRes.headers.get("content-type") || "audio/wav").split(";")[0];
  const bytes = Buffer.from(await audioRes.arrayBuffer());

  const formData = new FormData();
  formData.append("model", VOXTRAL_MODEL_ID);
  formData.append("file", new Blob([bytes], { type: mimeType }), `audio-${Date.now()}.wav`);

  const response = await internationalProviderFetch("mistral", MISTRAL_AUDIO_TRANSCRIBE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!response.ok) throw fail(await response.text() || "Audio transcription failed", response.status || 500);
  const payload = await response.json();
  const text = typeof payload?.text === "string" ? payload.text.trim() : "";
  if (!text) throw fail("Audio transcription returned empty text", 502);
  return text;
}

async function twelvelabsJson<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.TWELVELABS_API_KEY;
  if (!apiKey) throw fail("Missing TWELVELABS_API_KEY", 400);

  const headers = new Headers(init?.headers);
  headers.set("x-api-key", apiKey);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let attempt = 0;
  while (true) {
    try {
      const response = await internationalProviderFetch("twelvelabs", `${TWELVELABS_BASE_URL}${path}`, {
        ...(init || {}),
        headers,
      });
      if (!response.ok) {
        const detail = (await response.text()).trim();
        const error = new Error(
          `TwelveLabs upstream error (HTTP ${response.status})${detail ? `: ${detail}` : ""}`,
        ) as ErrorWithStatus & { responseHeaders?: Headers };
        error.statusCode = response.status || 500;
        error.responseHeaders = response.headers;

        const canRetry =
          isRetryableHttpStatus(response.status) && attempt < TWELVELABS_REQUEST_MAX_RETRIES;
        if (canRetry) {
          const waitMs = getRetryDelayMs(error, attempt, TWELVELABS_REQUEST_BASE_DELAY_MS);
          attempt += 1;
          console.warn(
            `[intl/twelvelabs] request retry ${attempt}/${TWELVELABS_REQUEST_MAX_RETRIES}, path=${path}, status=${response.status}, wait=${waitMs}ms`,
          );
          await waitFor(waitMs);
          continue;
        }

        throw error;
      }
      return (await response.json()) as T;
    } catch (error) {
      const canRetryNetwork =
        isNetworkConnectionError(error) && attempt < TWELVELABS_REQUEST_MAX_RETRIES;
      if (canRetryNetwork) {
        const waitMs = getRetryDelayMs(error, attempt, TWELVELABS_REQUEST_BASE_DELAY_MS);
        attempt += 1;
        console.warn(
          `[intl/twelvelabs] network retry ${attempt}/${TWELVELABS_REQUEST_MAX_RETRIES}, path=${path}, wait=${waitMs}ms`,
        );
        await waitFor(waitMs);
        continue;
      }

      if (isNetworkConnectionError(error)) {
        const proxyStatus = getInternationalProviderProxyStatus("twelvelabs");
        const isProxyEnabled = proxyStatus.startsWith("enabled");
        const message = isProxyEnabled
          ? "TwelveLabs 连接失败：本地代理不可用或不稳定（127.0.0.1:7897）。请检查代理后重试。"
          : "TwelveLabs 网络连接失败，请稍后重试。";
        throw fail(message, 503);
      }

      if (typeof (error as ErrorWithStatus)?.statusCode === "number") {
        throw error;
      }
      throw fail(error instanceof Error ? error.message : "TwelveLabs request failed", getErrorStatusCode(error));
    }
  }
}

async function ensureTwelveLabsIndex() {
  if (cachedTwelveLabsIndexId) return cachedTwelveLabsIndexId;
  const query = new URLSearchParams({ index_name: TWELVELABS_INDEX_NAME, page_limit: "10" });
  const listed = await twelvelabsJson<{ data?: Array<{ _id?: string; index_name?: string }> }>(`/indexes?${query.toString()}`);
  const found = (listed.data || []).find((item) => item.index_name === TWELVELABS_INDEX_NAME && typeof item._id === "string");
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
  if (!created._id) throw fail("TwelveLabs create index failed", 502);
  cachedTwelveLabsIndexId = created._id;
  return cachedTwelveLabsIndexId;
}

async function analyzeVideoByVideoId(videoId: string, prompt: string, language: "zh" | "en") {
  const analysis = await twelvelabsJson<{ data?: string }>("/analyze", {
    method: "POST",
    headers: language === "zh" ? { "Accept-Language": "zh-CN,zh;q=0.9" } : { "Accept-Language": "en-US,en;q=0.9" },
    body: JSON.stringify({ video_id: videoId, prompt, stream: false }),
  });
  const text = typeof analysis?.data === "string" ? analysis.data.trim() : "";
  if (!text) throw fail("TwelveLabs analyze returned empty text", 502);
  return text;
}

async function waitForTwelveLabsTaskVideoId(taskId: string, waitMs: number) {
  const deadline = Date.now() + waitMs;
  let pollCount = 0;

  while (Date.now() < deadline) {
    pollCount += 1;
    const status = await twelvelabsJson<{ status?: string; video_id?: string; error?: any }>(
      `/tasks/${taskId}`,
    );
    const normalizedStatus = (status.status || "").toLowerCase();

    if (normalizedStatus === "ready" && status.video_id) {
      return status.video_id;
    }

    if (["failed", "error"].includes(normalizedStatus)) {
      throw fail(`TwelveLabs task failed: ${JSON.stringify(status.error || "unknown")}`, 502);
    }

    if (pollCount % 8 === 0) {
      console.info("[intl/video] task polling", {
        taskId,
        status: normalizedStatus || "unknown",
        pollCount,
      });
    }

    await waitFor(TWELVELABS_TASK_POLL_INTERVAL_MS);
  }

  return null;
}

async function analyzeVideo(
  videoUrl: string,
  prompt: string,
  language: "zh" | "en" = "en",
  sourceVideoId?: string,
  forceFresh = false,
) {
  if (!process.env.TWELVELABS_API_KEY) {
    throw fail("Missing TWELVELABS_API_KEY", 400);
  }

  const sourceCacheKey =
    sourceVideoId && sourceVideoId.trim().length > 0
      ? createVideoSourceCacheKey(sourceVideoId.trim())
      : null;
  const urlCacheKey = createVideoUrlCacheKey(videoUrl);

  let videoId: string | null = null;
  if (!forceFresh) {
    videoId =
      (sourceCacheKey ? readCachedVideoId(sourceCacheKey) : null) ||
      readCachedVideoId(urlCacheKey);
  }

  if (videoId) {
    console.info("[intl/video] hit video cache", {
      sourceVideoId: sourceVideoId || "",
      videoId,
    });
  } else {
    const cachedTaskId =
      !forceFresh
        ? (sourceCacheKey ? readCachedTwelveLabsTask(sourceCacheKey) : null) ||
          readCachedTwelveLabsTask(urlCacheKey)
        : null;

    if (cachedTaskId) {
      console.info("[intl/video] hit pending task cache", {
        sourceVideoId: sourceVideoId || "",
        taskId: cachedTaskId,
      });
      const cachedTaskVideoId = await waitForTwelveLabsTaskVideoId(
        cachedTaskId,
        TWELVELABS_TASK_POLL_WAIT_MS,
      );
      if (cachedTaskVideoId) {
        videoId = cachedTaskVideoId;
        deleteCachedTwelveLabsTask(urlCacheKey);
        if (sourceCacheKey) deleteCachedTwelveLabsTask(sourceCacheKey);
        writeCachedVideoId(urlCacheKey, videoId);
        if (sourceCacheKey) writeCachedVideoId(sourceCacheKey, videoId);
      } else {
        throw fail(
          language === "zh"
            ? "视频正在解析中，请 5-15 秒后重试同一问题。"
            : "Video is still processing. Please retry the same question in 5-15 seconds.",
          503,
        );
      }
    }

    if (!videoId) {
      const indexId = await ensureTwelveLabsIndex();
      const videoRes = await fetch(videoUrl);
      if (!videoRes.ok) throw fail(`Failed to fetch video (HTTP ${videoRes.status})`, 400);
      const mimeType = (videoRes.headers.get("content-type") || "video/mp4").split(";")[0];
      const bytes = Buffer.from(await videoRes.arrayBuffer());

      const formData = new FormData();
      formData.append("index_id", indexId);
      formData.append("video_file", new Blob([bytes], { type: mimeType }), `video-${Date.now()}.mp4`);
      formData.append("enable_video_stream", "false");

      const task = await twelvelabsJson<{ _id?: string }>("/tasks", { method: "POST", body: formData });
      if (!task._id) throw fail("TwelveLabs create task failed", 502);

      writeCachedTwelveLabsTask(urlCacheKey, task._id);
      if (sourceCacheKey) writeCachedTwelveLabsTask(sourceCacheKey, task._id);

      const readyVideoId = await waitForTwelveLabsTaskVideoId(task._id, TWELVELABS_TASK_POLL_WAIT_MS);
      if (!readyVideoId) {
        throw fail(
          language === "zh"
            ? "视频正在解析中，请 5-15 秒后重试同一问题。"
            : "Video is still processing. Please retry the same question in 5-15 seconds.",
          503,
        );
      }
      videoId = readyVideoId;
      deleteCachedTwelveLabsTask(urlCacheKey);
      if (sourceCacheKey) deleteCachedTwelveLabsTask(sourceCacheKey);
      writeCachedVideoId(urlCacheKey, videoId);
      if (sourceCacheKey) writeCachedVideoId(sourceCacheKey, videoId);
    }
  }

  const analysisCacheKey = createAnalysisCacheKey(videoId, prompt, language);
  let analysisText: string | null = null;
  if (!forceFresh) {
    analysisText = readCachedAnalysis(analysisCacheKey);
  }
  if (analysisText) {
    console.info("[intl/video] hit analysis cache", {
      sourceVideoId: sourceVideoId || "",
      videoId,
      promptLength: prompt.length,
    });
  } else {
    analysisText = await analyzeVideoByVideoId(videoId, prompt, language);
    writeCachedAnalysis(analysisCacheKey, analysisText);
  }

  const firstIsLowInfo = isLowInformationVideoAnalysis(analysisText, language);
  console.info("[intl/video] first pass", {
    language,
    length: analysisText.length,
    lowInfo: firstIsLowInfo,
  });

  if (firstIsLowInfo && ENABLE_INTL_VIDEO_SECOND_PASS) {
    const retryPrompt =
      language === "zh"
        ? `${prompt}\n\n${VIDEO_RETRY_EXTRA_ZH}`
        : `${prompt}\n\n${VIDEO_RETRY_EXTRA_EN}`;
    const retryCacheKey = createAnalysisCacheKey(videoId, retryPrompt, language);
    try {
      let retryText = readCachedAnalysis(retryCacheKey);
      if (!retryText) {
        retryText = await analyzeVideoByVideoId(videoId, retryPrompt, language);
        writeCachedAnalysis(retryCacheKey, retryText);
      }
      const retryLowInfo = isLowInformationVideoAnalysis(retryText, language);
      console.info("[intl/video] second pass", {
        language,
        length: retryText.length,
        lowInfo: retryLowInfo,
      });
      if (!retryLowInfo || retryText.length > analysisText.length + 24) {
        analysisText = retryText;
        writeCachedAnalysis(analysisCacheKey, analysisText);
      }
    } catch (error) {
      console.warn(
        "[intl/video] second pass failed",
        error instanceof Error ? error.message : error,
      );
    }
  } else if (firstIsLowInfo) {
    console.info("[intl/video] second pass skipped", {
      language,
      reason: "INTL_VIDEO_SECOND_PASS disabled",
    });
  }

  return analysisText;
}

function toSse(text: string) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  (async () => {
    try {
      for (const chunk of splitChunks(text)) {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
      }
      await writer.write(encoder.encode("data: [DONE]\n\n"));
    } finally {
      try { await writer.close(); } catch {}
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(req: Request) {
  let debugContext: Record<string, unknown> = {};
  try {
    const body = await req.json();
    const model = body?.model as string | undefined;
    const modelId = body?.modelId as string | undefined;
    const chatId = body?.chatId as string | undefined;
    const messages = (Array.isArray(body?.messages) ? body.messages : []) as IncomingMessage[];
    const message = (body?.message as string | undefined) || "";
    const language = body?.language as string | undefined;
    const images = (Array.isArray(body?.images) ? body.images : []).filter(Boolean) as string[];
    const videos = (Array.isArray(body?.videos) ? body.videos : []).filter(Boolean) as string[];
    const audios = (Array.isArray(body?.audios) ? body.audios : []).filter(Boolean) as string[];
    const expertModelId = body?.expertModelId as string | undefined;
    debugContext = {
      model: model || modelId,
      chatId: chatId || "",
      messageCount: messages.length,
      images: images.length,
      videos: videos.length,
      audios: audios.length,
      language: language || "en",
    };

    if ((images.length && videos.length) || (audios.length && (images.length || videos.length))) {
      return new Response(JSON.stringify({ success: false, error: language === "zh" ? "同一条消息暂不支持混合上传图片/视频/音频。" : "Mixed image/video/audio in one message is not supported." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const expertDef = typeof expertModelId === "string" && isExpertModelId(expertModelId)
      ? getExpertModelDefinition(expertModelId)
      : null;

    let userId: string | null = null;
    let userMeta: any = {};
    let isLoggedIn = false;
    const authHeader = req.headers.get("authorization");
    const bearer = authHeader?.replace(/^Bearer\s+/i, "");
    if (bearer) {
      try {
        const jwt = require("jsonwebtoken");
        const JWT_SECRET = process.env.JWT_SECRET || "default-secret-key-change-in-production";
        const decoded = jwt.verify(bearer, JWT_SECRET) as { sub?: string };
        if (!decoded?.sub) throw new Error("invalid token");
        userId = decoded.sub;
        isLoggedIn = true;
      } catch {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized: Invalid token" }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
    } else {
      const supabase = await createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        userId = userData.user.id;
        userMeta = userData.user.user_metadata as any;
        isLoggedIn = true;
      }
    }

    let effectivePlanLower = "free";
    let contextLimit = GUEST_CONTEXT_LIMIT;
    if (isLoggedIn && userId) {
      let wallet = await getSupabaseUserWallet(userId);
      let plan = getPlanInfo(userMeta, wallet);
      effectivePlanLower = plan.planActive ? plan.planLower : "free";
      await seedSupabaseWalletForPlan(userId, effectivePlanLower);
      wallet = await getSupabaseUserWallet(userId);
      plan = getPlanInfo(userMeta, wallet);
      effectivePlanLower = plan.planActive ? plan.planLower : "free";
      contextLimit = getContextLimit(effectivePlanLower);
    } else {
      const rate = checkIpRateLimit(getClientIp(req));
      if (!rate.allowed) {
        return new Response(JSON.stringify({ success: false, error: language === "zh" ? "今日试用次数已用完，请登录后继续使用。" : "Daily trial limit reached. Please sign in to continue.", rateLimitExceeded: true }), { status: 429, headers: { "Content-Type": "application/json" } });
      }
    }

    const requestedModel = model || modelId || INTERNATIONAL_GENERAL_MODEL_ID;
    const modelName = !isLoggedIn ? INTERNATIONAL_GENERAL_MODEL_ID : (expertDef ? INTERNATIONAL_GENERAL_MODEL_ID : requestedModel);
    const finalModelId = expertDef ? modelName : (modelId || modelName);
    const category = getModelCategory(finalModelId);

    if (!isLoggedIn && category !== "general") {
      return new Response(JSON.stringify({ success: false, error: language === "zh" ? "游客模式仅支持通用模型。请登录后使用高级模型。" : "Guest mode only supports General Model. Please sign in to use advanced models." }), { status: 403, headers: { "Content-Type": "application/json" } });
    }
    if (!isLoggedIn && (images.length || videos.length || audios.length)) {
      return new Response(JSON.stringify({ success: false, error: language === "zh" ? "游客模式不支持图片/视频/音频对话，请登录后使用。" : "Guest mode does not support image/video/audio chat. Please sign in." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (expertDef && (images.length || videos.length || audios.length)) {
      return new Response(JSON.stringify({ success: false, error: language === "zh" ? "专家模型暂不支持图片/视频/音频，请切换到通用模型。" : "Expert models do not support image/video/audio. Please switch to the General Model." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    if (images.length && finalModelId !== GEMMA_MODEL_ID) {
      return new Response(JSON.stringify({ success: false, error: language === "zh" ? `当前消息包含图片，请切换到模型 ${GEMMA_MODEL_ID}。` : `This message contains images. Please switch to ${GEMMA_MODEL_ID}.` }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (videos.length && finalModelId !== TWELVELABS_MODEL_ID) {
      return new Response(JSON.stringify({ success: false, error: language === "zh" ? `当前消息包含视频，请切换到模型 ${TWELVELABS_MODEL_ID}。` : `This message contains videos. Please switch to ${TWELVELABS_MODEL_ID}.` }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (audios.length && finalModelId !== VOXTRAL_MODEL_ID) {
      return new Response(JSON.stringify({ success: false, error: language === "zh" ? `当前消息包含音频，请切换到模型 ${VOXTRAL_MODEL_ID}。` : `This message contains audio. Please switch to ${VOXTRAL_MODEL_ID}.` }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    let processedMessages = [...messages];
    if (processedMessages.length > contextLimit) processedMessages = truncateContextMessages(processedMessages, contextLimit);
    const mergedMessages: IncomingMessage[] = processedMessages.length
      ? [...processedMessages, { role: "user", content: message, images, videos, audios }]
      : [{ role: "user", content: message, images, videos, audios }];
    const latestUserText =
      [...mergedMessages].reverse().find((item) => item.role === "user")?.content || message || "";
    const effectiveLanguage = resolveEffectiveLanguage(language, latestUserText);

    const mediaUrlMap = await resolveMediaUrlMap(mergedMessages);
    const requestImageCount = getImageCount({ images });
    const requestVideoAudioCount = getVideoAudioCount({ videos, audios });
    const normalizedFinalModelId = finalModelId.toLowerCase();
    const isImageModel = normalizedFinalModelId === GEMMA_MODEL_ID;
    const isVideoAudioModel =
      normalizedFinalModelId === VOXTRAL_MODEL_ID ||
      normalizedFinalModelId === TWELVELABS_MODEL_ID;

    // 国际版多模态按“模型类型”扣费：
    // - 图像模型：至少扣 1 张图额度
    // - 视频/音频模型：至少扣 1 次视频音频额度
    const quotaImageCount =
      category === "advanced_multimodal" && isImageModel
        ? Math.max(1, requestImageCount)
        : requestImageCount;
    const quotaVideoAudioCount =
      category === "advanced_multimodal" && isVideoAudioModel
        ? Math.max(1, requestVideoAudioCount)
        : requestVideoAudioCount;

    const requiresMediaQuota =
      isLoggedIn &&
      category === "advanced_multimodal" &&
      (quotaImageCount > 0 || quotaVideoAudioCount > 0);
    const shouldDeductDailyExternal = isLoggedIn && category === "external";

    if (isLoggedIn && userId && requiresMediaQuota) {
      const mediaCheck = await checkSupabaseQuota(userId, quotaImageCount, quotaVideoAudioCount);
      if (!mediaCheck.hasEnoughQuota) {
        const errorKey = mediaCheck.totalImageBalance < quotaImageCount ? "monthly_photo" : "monthly_video_audio";
        return new Response(JSON.stringify({ success: false, error: getQuotaExceededMessage(errorKey as any, language === "zh" ? "zh" : "en") }), { status: 402, headers: { "Content-Type": "application/json" } });
      }
    }
    if (isLoggedIn && userId && shouldDeductDailyExternal) {
      const dailyCheck = await checkSupabaseDailyExternalQuota(userId, effectivePlanLower, 1);
      if (!dailyCheck.allowed) {
        return new Response(JSON.stringify({ success: false, error: getQuotaExceededMessage("daily", language === "zh" ? "zh" : "en") }), { status: 402, headers: { "Content-Type": "application/json" } });
      }
    }

    const shouldStreamGemma = images.length > 0 || modelName === GEMMA_MODEL_ID;
    if (shouldStreamGemma) {
      return await streamGemmaResponse(
        mergedMessages,
        mediaUrlMap,
        effectiveLanguage,
        req.signal,
        async (assistantMessage, hasModelOutput) => {
          const normalizedOutput = assistantMessage.trim();
          const shouldCharge = hasModelOutput && normalizedOutput.length > 0;

          if (isLoggedIn && userId && requiresMediaQuota) {
            if (shouldCharge) {
              const consumed = await consumeSupabaseQuota({
                userId,
                imageCount: quotaImageCount,
                videoAudioCount: quotaVideoAudioCount,
              });
              if (!consumed.success) console.error("[intl/stream] consume media quota failed", consumed.error);
            } else {
              console.warn("[intl/stream] consume media quota skipped because no model output");
            }
          }

          if (isLoggedIn && userId && shouldDeductDailyExternal) {
            if (shouldCharge) {
              const consumed = await consumeSupabaseDailyExternalQuota(userId, effectivePlanLower, 1);
              if (!consumed.success) console.error("[intl/stream] consume daily quota failed", consumed.error);
            } else {
              console.warn("[intl/stream] consume daily quota skipped because no model output");
            }
          }

          if (expertDef && userId && supabaseAdmin && shouldCharge) {
            const now = new Date().toISOString();
            const { error } = await supabaseAdmin.from(expertDef.supabaseTable).insert({
              user_id: userId,
              user_message: message || "",
              user_message_at: now,
              assistant_message: normalizedOutput,
              assistant_message_at: now,
              model_id: modelName,
            });
            if (error) console.error("[intl/expert-log] insert failed", error);
          }
        },
      );
    }

    let outputText = "";
    let videoQuestionForStyle = "";
    if (audios.length) {
      const audioUrl = resolveMediaUrl(audios[0], mediaUrlMap);
      if (!audioUrl) throw fail("Unable to resolve audio URL", 400);
      const transcription = await transcribeAudio(audioUrl);
      const latest = mergedMessages[mergedMessages.length - 1];
      const qa = effectiveLanguage === "zh"
        ? `以下是音频转写和用户问题，请基于转写回答。\n\n用户问题：${latest.content || "请总结这段音频。"}\n\n音频转写：\n${transcription}`
        : `You receive an audio transcription and user question. Answer based on the transcription.\n\nUser question: ${latest.content || "Please summarize this audio."}\n\nTranscription:\n${transcription}`;
      const textOnly = [...mergedMessages];
      textOnly[textOnly.length - 1] = { ...latest, content: qa, images: [], videos: [], audios: [] };
      outputText = await requestMistral(VOXTRAL_MODEL_ID, textOnly, effectiveLanguage);
    } else if (videos.length) {
      const currentVideoId = videos[0];
      const videoUrl = resolveMediaUrl(currentVideoId, mediaUrlMap);
      if (!videoUrl) throw fail("Unable to resolve video URL", 400);
      const latest = mergedMessages[mergedMessages.length - 1];
      const userQuestion =
        latest.content || (effectiveLanguage === "zh" ? "请总结这个视频的主要内容。" : "Please summarize this video.");
      videoQuestionForStyle = userQuestion;

      const videoSummaryQuestion = buildVideoSummaryQuestion(effectiveLanguage);
      const summaryPrompt = buildVideoQaPrompt(videoSummaryQuestion, effectiveLanguage);
      const videoRawSummary = await analyzeVideo(videoUrl, summaryPrompt, effectiveLanguage, currentVideoId, false);
      const videoSummary = await normalizeVideoAnalysisOutput(
        videoRawSummary,
        effectiveLanguage,
        videoSummaryQuestion,
      );
      console.info("[intl/video] summary->mistral", {
        language: effectiveLanguage,
        summaryLength: videoSummary.length,
        questionLength: userQuestion.length,
        source: "new-upload",
      });
      const videoQaPrompt = buildVideoSummaryQaPrompt(userQuestion, videoSummary, effectiveLanguage);
      outputText = await requestMistral(
        INTERNATIONAL_GENERAL_MODEL_ID,
        [{ role: "user", content: videoQaPrompt }],
        effectiveLanguage,
      );
    } else if (modelName === TWELVELABS_MODEL_ID) {
      let latestVideoId = findLatestMediaId(mergedMessages, "videos");
      if (!latestVideoId && chatId && userId) {
        latestVideoId = await findLatestConversationVideoId(chatId, userId);
      }
      if (!latestVideoId) {
        throw fail(
          language === "zh"
            ? "TwelveLabs 视频模型需要先上传至少一个视频，之后可直接连续对话。"
            : "TwelveLabs requires at least one uploaded video first; then you can continue chatting without re-uploading.",
          400,
        );
      }
      const videoUrl = resolveMediaUrl(latestVideoId, mediaUrlMap);
      if (!videoUrl) throw fail("Unable to resolve video URL", 400);
      const latest = mergedMessages[mergedMessages.length - 1];
      const userQuestion =
        latest.content || (effectiveLanguage === "zh" ? "请继续分析这个视频并补充细节。" : "Please continue analyzing this video and add more detail.");
      videoQuestionForStyle = userQuestion;

      const videoSummaryQuestion = buildVideoSummaryQuestion(effectiveLanguage);
      const summaryPrompt = buildVideoQaPrompt(videoSummaryQuestion, effectiveLanguage);
      const videoRawSummary = await analyzeVideo(videoUrl, summaryPrompt, effectiveLanguage, latestVideoId, false);
      const videoSummary = await normalizeVideoAnalysisOutput(
        videoRawSummary,
        effectiveLanguage,
        videoSummaryQuestion,
      );
      console.info("[intl/video] summary->mistral", {
        language: effectiveLanguage,
        summaryLength: videoSummary.length,
        questionLength: userQuestion.length,
        source: "history-video",
      });
      const videoQaPrompt = buildVideoSummaryQaPrompt(userQuestion, videoSummary, effectiveLanguage);
      outputText = await requestMistral(
        INTERNATIONAL_GENERAL_MODEL_ID,
        [{ role: "user", content: videoQaPrompt }],
        effectiveLanguage,
      );
    } else {
      outputText = await requestMistral(modelName, mergedMessages, effectiveLanguage);
    }

    outputText = (await enforceOutputLanguage(outputText, effectiveLanguage)).trim();
    if (videoQuestionForStyle) {
      outputText = enforceVideoAnswerStyle(outputText, videoQuestionForStyle, effectiveLanguage);
    }
    if (!outputText) throw fail(language === "zh" ? "模型未返回有效内容。" : "Model returned empty content.", 502);

    if (isLoggedIn && userId && requiresMediaQuota) {
      const consumed = await consumeSupabaseQuota({
        userId,
        imageCount: quotaImageCount,
        videoAudioCount: quotaVideoAudioCount,
      });
      if (!consumed.success) console.error("[intl/stream] consume media quota failed", consumed.error);
    }
    if (isLoggedIn && userId && shouldDeductDailyExternal) {
      const consumed = await consumeSupabaseDailyExternalQuota(userId, effectivePlanLower, 1);
      if (!consumed.success) console.error("[intl/stream] consume daily quota failed", consumed.error);
    }

    if (expertDef && userId && supabaseAdmin) {
      const now = new Date().toISOString();
      const { error } = await supabaseAdmin.from(expertDef.supabaseTable).insert({
        user_id: userId,
        user_message: message || "",
        user_message_at: now,
        assistant_message: outputText,
        assistant_message_at: now,
        model_id: modelName,
      });
      if (error) console.error("[intl/expert-log] insert failed", error);
    }

    return toSse(outputText);
  } catch (error) {
    const statusCode = typeof (error as ErrorWithStatus)?.statusCode === "number" ? (error as ErrorWithStatus).statusCode! : 500;
    const message = error instanceof Error ? error.message : "Unknown error";
    const isVideoStillProcessingMessage =
      statusCode === 503 &&
      (message.includes("视频正在解析中") || message.includes("Video is still processing"));

    console.error("[intl/stream] request failed", {
      ...debugContext,
      statusCode,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (isVideoStillProcessingMessage) {
      return toSse(message);
    }
    return new Response(JSON.stringify({ success: false, error: message }), { status: statusCode, headers: { "Content-Type": "application/json" } });
  }
}
