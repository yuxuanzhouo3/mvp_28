import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { getExpertModelDefinition, isExpertModelId } from "@/constants/expert-models";
import {
  getModelCategory,
  getFreeContextMsgLimit,
  getQuotaExceededMessage,
  getImageCount,
  getVideoAudioCount,
} from "@/utils/model-limits";
import {
  checkQuota,
  consumeQuota,
  seedWalletForPlan,
  checkDailyExternalQuota,
  consumeDailyExternalQuota,
} from "@/services/wallet";
import { isAfter } from "date-fns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const DOMESTIC_GENERAL_MODEL_ID = "qwen-turbo";

// 游客试用配置
const GUEST_MAX_CONTEXT = 10; // 游客最大上下文消息数

// 从环境变量读取游客每日限制，默认为 10
const GUEST_DAILY_LIMIT = (() => {
  const raw = process.env.NEXT_PUBLIC_TRIAL_DAILY_LIMIT || "10";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(100, n);
})();

// 内存中的 IP 限制缓存（生产环境建议使用 Redis）
const ipRateLimitCache = new Map<string, { count: number; resetTime: number }>();

/**
 * 检查 IP 是否超过每日限制
 */
function checkIpRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const todayEnd = new Date().setHours(23, 59, 59, 999);

  const record = ipRateLimitCache.get(ip);

  if (!record || record.resetTime < now) {
    // 新的一天或首次访问，重置计数
    ipRateLimitCache.set(ip, { count: 1, resetTime: todayEnd });
    return { allowed: true, remaining: GUEST_DAILY_LIMIT - 1 };
  }

  if (record.count >= GUEST_DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: GUEST_DAILY_LIMIT - record.count };
}

/**
 * 获取客户端 IP 地址
 */
function getClientIp(req: Request): string {
  // 优先从 X-Forwarded-For 获取（经过代理的情况）
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  // 其次从 X-Real-IP 获取
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  // 默认返回未知
  return "unknown";
}

/**
 * 获取用户计划信息
 */
function getPlanInfo(meta: any) {
  const rawPlan =
    (meta?.plan as string | undefined) ||
    (meta?.subscriptionTier as string | undefined) ||
    "";
  const rawPlanLower = typeof rawPlan === "string" ? rawPlan.toLowerCase() : "";
  const planExp = meta?.plan_exp ? new Date(meta.plan_exp) : null;
  const planActive = planExp ? isAfter(planExp, new Date()) : true;
  const planLower = planActive ? rawPlanLower : "free";
  const isProFlag = !!meta?.pro && planLower !== "free" && planLower !== "basic";
  const isBasic = planLower === "basic";
  const isPro = planLower === "pro" || planLower === "enterprise" || isProFlag;
  const isFree = !isPro && !isBasic;
  return { planLower, isPro, isBasic, isFree, planActive, planExp };
}

/**
 * 截断消息历史以符合上下文限制
 */
function truncateContextMessages<T>(messages: T[], limit: number): T[] {
  if (messages.length <= limit) return messages;
  // 保留最近 limit 条消息
  return messages.slice(-limit);
}

const getDashScopeProvider = (modelId: string) => {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey || !modelId) return null;
  return {
    model: modelId,
    url: PROVIDER_URL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  };
};

function extractDelta(data: any): string {
  const choice = data?.choices?.[0];
  if (!choice) return "";
  const delta = choice.delta?.content ?? choice.message?.content;
  if (Array.isArray(delta)) {
    return delta.map((c: any) => c.text ?? "").join("");
  }
  return delta || "";
}

const buildOpenAIMessages = (
  mergedMessages: any[],
  resolveImageUrl: (id: string) => string | null,
  resolveVideoUrl: (id: string) => string | null,
  resolveAudioUrl: (id: string) => { url: string; format: string } | null,
) => {
  return mergedMessages.map((m) => {
    const urls = (m.images || []).map((id: string) => resolveImageUrl(id)).filter(Boolean) as string[];
    const videoUrls = (m.videos || []).map((id: string) => resolveVideoUrl(id)).filter(Boolean) as string[];
    const audioUrls = (m.audios || []).map((id: string) => resolveAudioUrl(id)).filter(Boolean) as
      | { url: string; format: string }[]
      | [];

    if (!urls.length && !videoUrls.length && !audioUrls.length) {
      return { role: m.role, content: m.content };
    }
    if (urls.length && videoUrls.length) {
      throw new Error("同一条消息暂不支持同时包含图片和视频，请分开发送。");
    }
    if (audioUrls.length && (urls.length || videoUrls.length)) {
      throw new Error("同一条消息暂不支持同时包含音频与图片/视频，请分开发送。");
    }

    return {
      role: m.role,
      content: [
        ...audioUrls.slice(0, 1).map((a) => ({
          type: "input_audio",
          input_audio: { data: a.url, format: a.format },
        })),
        { type: "text", text: m.content },
        ...videoUrls.map((url) => ({ type: "video_url", video_url: { url } })),
        ...urls.map((url) => ({ type: "image_url", image_url: { url, detail: "high" as const } })),
      ],
    };
  });
};

export async function POST(req: Request) {
  try {
    // 调试日志
    const debugHeaders = {
      userAgent: req.headers.get("user-agent")?.substring(0, 50),
      hasCookie: !!req.headers.get("cookie"),
      hasAuthToken: !!(req.headers.get("cookie")?.match(/auth-token=([^;]+)/)?.[1]),
      mobileGuestHeader: req.headers.get("x-mobile-guest"),
    };
    console.log("[stream-guest] Request received", debugHeaders);

    type IncomingMessage = { role: string; content: string; images?: string[]; videos?: string[]; audios?: string[] };
    const {
      model,
      modelId,
      messages = [],
      message,
      language,
      images = [],
      videos = [],
      audios = [],
      expertModelId,
    } =
      (await req.json()) as {
        model?: string;
        modelId?: string;
        messages?: IncomingMessage[];
        message?: string;
        language?: string;
        images?: string[];
        videos?: string[];
        audios?: string[];
        expertModelId?: string;
      };

    const expertDef =
      typeof expertModelId === "string" && isExpertModelId(expertModelId)
        ? getExpertModelDefinition(expertModelId)
        : null;

    // 检查是否有媒体上传（需要提前判断）
    const hasMediaPayload =
      (Array.isArray(images) && images.length > 0) ||
      (Array.isArray(videos) && videos.length > 0) ||
      (Array.isArray(audios) && audios.length > 0) ||
      (Array.isArray(messages) &&
        messages.some((m) => (m?.images || m?.videos || m?.audios || []).length > 0));

    // ============================================================
    // Free 用户上下文截断 + 配额校验
    // 移动端游客模式：无 auth-token 时允许使用 General Model，不落库不扣费
    // ============================================================
    let contextTruncated = false;
    let processedMessages = [...messages];

    // 检查 auth-token
    const rawTokenCookie = req.headers.get("cookie")?.match(/auth-token=([^;]+)/)?.[1];
    const headerToken =
      req.headers.get("x-auth-token") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      null;
    const authToken = rawTokenCookie
      ? decodeURIComponent(rawTokenCookie)
      : headerToken
        ? decodeURIComponent(headerToken)
        : null;

    // 检查是否是游客请求（通过自定义 header，同时支持移动端和桌面端）
    const userAgent = req.headers.get("user-agent") || "";
    const isMobileUA = /Mobile|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isGuestHeader = req.headers.get("x-guest-trial") === "true" || req.headers.get("x-mobile-guest") === "true";
    const isGuest = !authToken && (isMobileUA || isGuestHeader);

    let user: any = null;
    let plan = getPlanInfo({});
    let isGuestMode = false;

    if (!authToken) {
      if (isGuest) {
        // 游客模式：允许无 token 访问，但有限制（同时支持移动端和桌面端）
        const clientIp = getClientIp(req);
        const rateLimit = checkIpRateLimit(clientIp);

        if (!rateLimit.allowed) {
          console.log("[quota][stream-guest] IP rate limit exceeded", { clientIp });
          return new Response(
            JSON.stringify({
              success: false,
              error: language === "zh"
                ? "今日试用次数已用完，请登录后继续使用。"
                : "Daily trial limit reached. Please sign in to continue.",
              rateLimitExceeded: true,
            }),
            { status: 429, headers: { "Content-Type": "application/json" } },
          );
        }

        console.log("[quota][stream-guest] guest mode enabled", {
          clientIp,
          isMobileUA,
          isGuestHeader,
          hasMediaPayload,
          remaining: rateLimit.remaining,
        });
        isGuestMode = true;
        // 强制使用 General Model，禁止媒体上传
        if (hasMediaPayload) {
          return new Response(
            JSON.stringify({
              success: false,
              error: language === "zh"
                ? "游客模式不支持上传图片/视频/音频，请登录后使用。"
                : "Guest mode does not support media uploads. Please sign in.",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        // 游客模式只能使用 General Model
        if (expertDef) {
          return new Response(
            JSON.stringify({
              success: false,
              error: language === "zh"
                ? "游客模式仅支持通用模型，请登录后使用专家模型。"
                : "Guest mode only supports General Model. Please sign in for expert models.",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        // 截断游客消息上下文
        if (processedMessages.length > GUEST_MAX_CONTEXT) {
          processedMessages = truncateContextMessages(processedMessages, GUEST_MAX_CONTEXT);
          contextTruncated = true;
        }
      } else {
        console.warn("[quota][stream] missing auth-token cookie");
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized: auth-token required" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
    } else {
      // 有 token，验证用户
      try {
        const auth = new CloudBaseAuthService();
        user = await auth.validateToken(authToken);
        if (!user) {
          console.warn("[quota][stream] auth-token invalid");
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }
        plan = getPlanInfo(user.metadata);
      } catch {
        console.warn("[quota][stream] auth validate failed");
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      // Free 用户：截断上下文消息
      if (plan.isFree && processedMessages.length > 0) {
        const contextLimit = getFreeContextMsgLimit();
        if (processedMessages.length > contextLimit) {
          processedMessages = truncateContextMessages(processedMessages, contextLimit);
          contextTruncated = true;
        }
      }
    }

    // Expert models are text-only and must always use the same underlying model as General Model.
    if (expertDef && hasMediaPayload) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            language === "zh"
              ? "专家模型暂不支持图片/视频/音频，请切换到 Qwen3-Omni-Flash。"
              : "Expert models do not support image/video/audio. Please switch to Qwen3-Omni-Flash.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 游客模式强制使用 General Model
    const modelName = isGuestMode
      ? DOMESTIC_GENERAL_MODEL_ID
      : expertDef
        ? DOMESTIC_GENERAL_MODEL_ID
        : hasMediaPayload
          ? "qwen3-omni-flash"
          : model || modelId || "qwen3-omni-flash";
    const finalModelId = isGuestMode ? DOMESTIC_GENERAL_MODEL_ID : (expertDef ? modelName : modelId || modelName);
    const provider = getDashScopeProvider(modelName);
    if (!provider) {
      return new Response(JSON.stringify({ success: false, error: "Unsupported model or missing API key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ============================================================
    // 媒体额度 & 外部模型日额度校验（仅检查，扣减在响应成功后）
    // 游客模式跳过配额校验（使用 General Model，不扣费）
    // ============================================================
    const category = getModelCategory(finalModelId);
    const imageCount = getImageCount({ images });
    const videoAudioCount = getVideoAudioCount({ videos, audios });
    const requiresMediaQuota =
      !isGuestMode && category === "advanced_multimodal" && (imageCount > 0 || videoAudioCount > 0);
    const shouldDeductMediaQuota = requiresMediaQuota;
    // 外部模型或多模态模型的纯文本对话都需要扣减每日外部模型额度（游客模式跳过）
    const shouldDeductDailyExternal = !isGuestMode && (category === "external" ||
      (category === "advanced_multimodal" && imageCount === 0 && videoAudioCount === 0));

    if (requiresMediaQuota && user) {
      if (!plan.planActive) {
        plan.planLower = "free";
      }

      await seedWalletForPlan(user.id, plan.planLower || "free");
      const quotaCheck = await checkQuota(user.id, imageCount, videoAudioCount);

      if (!quotaCheck.hasEnoughQuota) {
        const errorKey =
          quotaCheck.totalImageBalance < imageCount ? "monthly_photo" : "monthly_video_audio";
        console.warn("[quota][stream] media quota insufficient", {
          userId: user.id,
          effectivePlanLower: plan.planLower,
          quotaCheck,
          requested: { imageCount, videoAudioCount },
        });
        return new Response(
          JSON.stringify({
            success: false,
            error: getQuotaExceededMessage(errorKey as any, language === "zh" ? "zh" : "en"),
          }),
          { status: 402, headers: { "Content-Type": "application/json" } },
        );
      }
    }
    if (shouldDeductDailyExternal && user) {
      const effectivePlanLower = plan.planActive ? plan.planLower || "free" : "free";
      const dailyCheck = await checkDailyExternalQuota(user.id, effectivePlanLower, 1);
      // console.log("[quota][stream] daily check", {
      //   userId: user.id,
      //   effectivePlanLower,
      //   dailyCheck,
      // });
      if (!dailyCheck.allowed) {
        console.warn("[quota][stream] daily external insufficient", {
          userId: user.id,
          effectivePlanLower,
          dailyCheck,
        });
        return new Response(
          JSON.stringify({
            success: false,
            error: getQuotaExceededMessage("daily", language === "zh" ? "zh" : "en"),
          }),
          { status: 402, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    const mergedMessages: IncomingMessage[] =
      Array.isArray(processedMessages) && processedMessages.length > 0
        ? [...processedMessages, { role: "user", content: message || "", images, videos, audios }]
        : [{ role: "user", content: message || "", images, videos, audios }];

    const allImageIds = mergedMessages
      .flatMap((m) => m.images || [])
      .filter((v) => typeof v === "string" && !v.startsWith("http"));
    const allVideoIds = mergedMessages
      .flatMap((m) => m.videos || [])
      .filter((v) => typeof v === "string" && !v.startsWith("http"));
    const allAudioIds = mergedMessages
      .flatMap((m) => (m as any).audios || [])
      .filter((v) => typeof v === "string" && !v.startsWith("http"));

    // 仅限制本次请求的用户消息音频数量（当前请求的最后一条用户消息）
    const lastUserIdx = [...mergedMessages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx !== -1) {
      const realIdx = mergedMessages.length - 1 - lastUserIdx;
      const currentAudios = (mergedMessages[realIdx] as any).audios || [];
      if (currentAudios.length > 1) {
        return new Response(
          JSON.stringify({ success: false, error: "音频输入目前仅支持单个文件，请分开发送。" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    let tempUrlMap: Record<string, string> = {};
    const needIds = Array.from(new Set([...allImageIds, ...allVideoIds, ...allAudioIds]));
    if (needIds.length) {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const app = connector.getApp();
      const tempRes = await app.getTempFileURL({
        fileList: needIds.map((id: string) => ({ fileID: id, maxAge: 600 })),
      });
      tempUrlMap = Object.fromEntries(
        (tempRes.fileList || []).map((f: { fileID: string; tempFileURL: string }) => [f.fileID, f.tempFileURL])
      );

      // console.log("[media][stream] resolved temp URLs", {
      //   requested: needIds.length,
      //   resolved: Object.keys(tempUrlMap).length,
      // });
    }

    const resolveImageUrl = (v: string) => (v.startsWith("http") ? v : tempUrlMap[v] || null);
    const resolveVideoUrl = (v: string) => (v.startsWith("http") ? v : tempUrlMap[v] || null);
    const resolveAudioUrl = (v: string) => {
      const url = v.startsWith("http") ? v : tempUrlMap[v];
      if (!url) return null;
      const clean = url.split("?")[0].toLowerCase();
      const ext = clean.match(/\.([a-z0-9]+)$/)?.[1] || "wav";
      const fmt = ext.replace(/[^a-z0-9]/g, "") || "wav";
      return { url, format: fmt };
    };

    let openaiMessages: any[];
    try {
      openaiMessages = buildOpenAIMessages(mergedMessages, resolveImageUrl, resolveVideoUrl, resolveAudioUrl);
      const firstUser = openaiMessages.find((m: any) => m.role === "user");
      // console.log("[media][stream] openaiMessages sample", {
      //   count: openaiMessages.length,
      //   firstUser,
      // });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const upstreamController = new AbortController();
    const abortUpstream = () => {
      if (upstreamController.signal.aborted) return;
      upstreamController.abort();
    };
    if (req.signal.aborted) {
      abortUpstream();
    } else {
      req.signal.addEventListener("abort", abortUpstream, { once: true });
    }

    const upstream = await fetch(provider.url, {
      method: "POST",
      headers: {
        ...provider.headers,
        ...(language === "zh" ? { "Accept-Language": "zh-CN,zh;q=0.9" } : {}),
      },
      body: JSON.stringify({
        model: provider.model,
        messages: openaiMessages,
        stream: true,
        temperature: 0.7,
      }),
      signal: upstreamController.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text();
      return new Response(JSON.stringify({ success: false, error: errText || "Upstream error" }), {
        status: upstream.status || 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const userMessageAt = new Date().toISOString();
    let assistantMessage = "";

    const THINK_OPEN = "<think>";
    const THINK_CLOSE = "</think>";
    let thinkBuffer = "";
    let inThinkBlock = false;
    let firstContentEmitted = false;

    const filterThinkContent = (chunk: string): string => {
      thinkBuffer += chunk;
      let output = "";

      while (thinkBuffer.length) {
        if (!inThinkBlock) {
          const openIdx = thinkBuffer.toLowerCase().indexOf(THINK_OPEN);
          if (openIdx === -1) {
            output += thinkBuffer;
            thinkBuffer = "";
            break;
          }
          output += thinkBuffer.slice(0, openIdx);
          thinkBuffer = thinkBuffer.slice(openIdx + THINK_OPEN.length);
          inThinkBlock = true;
        } else {
          const closeIdx = thinkBuffer.toLowerCase().indexOf(THINK_CLOSE);
          if (closeIdx === -1) {
            thinkBuffer = "";
            break;
          }
          thinkBuffer = thinkBuffer.slice(closeIdx + THINK_CLOSE.length);
          inThinkBlock = false;
        }
      }

      output = output.replace(/<\/?think>/gi, "");

      if (!firstContentEmitted) {
        output = output.replace(/^[\s\u00A0]+/, "");
        if (output.trim().length > 0) {
          firstContentEmitted = true;
        }
      }

      output = output.replace(/\n{3,}/g, "\n\n");
      return output;
    };

    (async () => {
      const reader = upstream.body!.getReader();
      let buffer = "";
      let doneSent = false;
      let closed = false;
      let clientAborted = req.signal.aborted || upstreamController.signal.aborted;
      let streamFinished = false;
      let hasContentOutput = false; // 标记是否有内容输出（用于手动暂停时也扣费）
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
        streamFinished = true;
        await safeWrite(encoder.encode("data: [DONE]\n\n"));
      };
      const closeWriter = async () => {
        if (closed) return;
        closed = true;
        try {
          await writer.close();
        } catch {}
      };
      const onClientAbort = () => {
        clientAborted = true;
        abortUpstream();
        closeWriter();
      };
      if (!req.signal.aborted) {
        req.signal.addEventListener("abort", onClientAbort, { once: true });
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
            if (data === "[DONE]") {
              await sendDone();
              await closeWriter();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const delta = extractDelta(parsed);
              const cleaned = filterThinkContent(delta);
              if (cleaned && cleaned.trim().length > 0) {
                const wrote = await safeWrite(
                  encoder.encode(`data: ${JSON.stringify({ chunk: cleaned })}\n\n`)
                );
                if (!wrote) break;
                hasContentOutput = true; // AI已开始输出内容
                assistantMessage += cleaned;
              }
            } catch {
              // ignore malformed chunk
            }
          }
        }
        streamFinished = true;
      } catch (err) {
        if (!clientAborted) {
          await safeWrite(
            encoder.encode(
              `data: ${JSON.stringify({
                chunk: language === "zh" ? "抱歉，流式响应中断。" : "Stream interrupted.",
              })}\n\n`
            )
          );
          console.warn(
            "[quota][stream] upstream interrupted",
            err instanceof Error ? err.message : err
          );
        }
      } finally {
        // 如果未显式标记完成，但已经发送了 [DONE]，兜底标记
        if (doneSent && !streamFinished) {
          streamFinished = true;
        }
        await sendDone();
        await closeWriter();
         
        // AI成功输出内容后才扣费（手动暂停也算）
        // 游客模式不扣费
        const shouldCharge = hasContentOutput && !isGuestMode && user;

        if (shouldDeductMediaQuota && shouldCharge) {
          const consumeResult = await consumeQuota({
            userId: user.id,
            imageCount,
            videoAudioCount,
          });
          if (!consumeResult.success) {
            console.error("[quota][stream][consume-error]", consumeResult.error);
          }
        } else if (shouldDeductMediaQuota && !shouldCharge) {
          console.warn("[quota][stream] media consume skipped because no content output");
        }
        if (shouldDeductDailyExternal && shouldCharge) {
          const consumeDailyResult = await consumeDailyExternalQuota(
            user.id,
            plan.planActive ? plan.planLower || "free" : "free",
            1,
          );
          if (!consumeDailyResult.success) {
            console.error("[quota][stream][daily-consume-error]", consumeDailyResult.error);
          }
        } else if (shouldDeductDailyExternal && !shouldCharge) {
          console.warn("[quota][stream] daily consume skipped because no content output");
        }

        // 专家模型对话落库（分集合），不影响主流程
        if (expertDef && shouldCharge && assistantMessage.trim().length > 0) {
          try {
            const connector = new CloudBaseConnector();
            await connector.initialize();
            const db = connector.getClient();
            await db.collection(expertDef.cloudbaseCollection).add({
              userId: user.id,
              userMessage: message || "",
              userMessageAt,
              assistantMessage,
              assistantMessageAt: new Date().toISOString(),
              modelId: finalModelId,
              createdAt: new Date().toISOString(),
            });
          } catch (err) {
            console.error("[expert-log][cloudbase] insert failed", err);
          }
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
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
