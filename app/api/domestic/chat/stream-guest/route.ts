import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import {
  getModelCategory,
  getFreeContextMsgLimit,
  getFreeDailyLimit,
  getFreeMonthlyPhotoLimit,
  getFreeMonthlyVideoAudioLimit,
  getQuotaExceededMessage,
  getImageCount,
  getVideoAudioCount,
} from "@/utils/model-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

/**
 * 获取用户计划信息
 */
function getPlanInfo(meta: any) {
  const rawPlan =
    (meta?.plan as string | undefined) ||
    (meta?.subscriptionTier as string | undefined) ||
    "";
  const planLower = typeof rawPlan === "string" ? rawPlan.toLowerCase() : "";
  const isProFlag = !!meta?.pro && planLower !== "free" && planLower !== "basic";
  const isBasic = planLower === "basic";
  const isPro = planLower === "pro" || planLower === "enterprise" || isProFlag;
  const isFree = !isPro && !isBasic;
  return { planLower, isPro, isBasic, isFree };
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
      quotaChecked,
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
        quotaChecked?: boolean;
      };

    // ============================================================
    // Free 用户上下文截断 + 配额校验（要求登录，确保额度入库）
    // ============================================================
    let contextTruncated = false;
    let processedMessages = [...messages];
    
    // 需要 auth-token 才允许调用，保证额度可计入数据库
    const rawToken = req.headers.get("cookie")?.match(/auth-token=([^;]+)/)?.[1];
    const authToken = rawToken ? decodeURIComponent(rawToken) : null;
    if (!authToken) {
      console.warn("[quota][stream] missing auth-token cookie");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: auth-token required" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    let user: any = null;
    let plan = { isFree: true, isBasic: false, isPro: false, planLower: "free" };
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
      console.log("[quota][stream] user", user.id, "plan", plan.planLower);
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
        console.log("[context] Free user messages truncated:", messages.length, "->", processedMessages.length, "limit:", contextLimit);
      }
    }

    const hasMediaPayload =
      (Array.isArray(images) && images.length > 0) ||
      (Array.isArray(videos) && videos.length > 0) ||
      (Array.isArray(audios) && audios.length > 0) ||
      (Array.isArray(messages) &&
        messages.some((m) => (m?.images || m?.videos || m?.audios || []).length > 0));

    const modelName = hasMediaPayload ? "qwen3-omni-flash" : model || modelId || "qwen3-omni-flash";
    const finalModelId = modelId || modelName;
    const provider = getDashScopeProvider(modelName);
    if (!provider) {
      return new Response(JSON.stringify({ success: false, error: "Unsupported model or missing API key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ============================================================
    // Free 用户配额扣减（未提前扣减时）
    // ============================================================
    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();

    if (plan.isFree && !quotaChecked) {
      const today = new Date().toISOString().split("T")[0];
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      const quotaColl = db.collection("free_quotas");
      const category = getModelCategory(finalModelId);
      const imageCount = getImageCount({ images });
      const videoAudioCount = getVideoAudioCount({ videos, audios });
      console.log("[quota][stream] begin", {
        user: user.id,
        modelId: finalModelId,
        category,
        today,
        currentMonth,
        imageCount,
        videoAudioCount,
      });

      const consumeDaily = async () => {
        const dailyLimit = getFreeDailyLimit();
        const existing = await quotaColl.where({ userId: user.id, day: today }).limit(1).get();
        const row = existing?.data?.[0];
        const used = row?.daily_count ?? row?.used ?? 0;
        console.log("[quota][stream] daily check", { used, dailyLimit, rowId: row?._id });
        if (used >= dailyLimit) {
          return {
            allowed: false,
            error: getQuotaExceededMessage("daily", language === "zh" ? "zh" : "en"),
          };
        }
        const payload: any = {
          userId: user.id,
          day: today,
          daily_count: used + 1,
          updatedAt: new Date().toISOString(),
        };
        if (row?._id) {
          await quotaColl.doc(row._id).update(payload);
        } else {
          await quotaColl.add(payload);
        }
        console.log("[quota][stream] daily updated", { user: user.id, used: used + 1, dailyLimit });
        return { allowed: true };
      };

      if (category === "general") {
        // 通用模型：无限制
      } else if (category === "external") {
        const res = await consumeDaily();
        if (!res.allowed) {
          return new Response(JSON.stringify({ success: false, error: res.error }), {
            status: 402,
            headers: { "Content-Type": "application/json" },
          });
        }
      } else if (category === "advanced_multimodal") {
        const photoLimit = getFreeMonthlyPhotoLimit();
        const videoAudioLimit = getFreeMonthlyVideoAudioLimit();

        if (imageCount === 0 && videoAudioCount === 0) {
          const res = await consumeDaily();
          if (!res.allowed) {
            return new Response(JSON.stringify({ success: false, error: res.error }), {
              status: 402,
              headers: { "Content-Type": "application/json" },
            });
          }
        } else {
          const existing = await quotaColl.where({ userId: user.id, month: currentMonth }).limit(1).get();
          const row = existing?.data?.[0];
          const usedPhoto = row?.month_used_photo ?? 0;
          const usedVideoAudio = row?.month_used_video_audio ?? 0;
          console.log("[quota][stream] monthly check", {
            usedPhoto,
            usedVideoAudio,
            photoLimit,
            videoAudioLimit,
            rowId: row?._id,
          });

          if (imageCount > 0 && usedPhoto + imageCount > photoLimit) {
            return new Response(
              JSON.stringify({ success: false, error: getQuotaExceededMessage("monthly_photo", language === "zh" ? "zh" : "en") }),
              { status: 402, headers: { "Content-Type": "application/json" } },
            );
          }
          if (videoAudioCount > 0 && usedVideoAudio + videoAudioCount > videoAudioLimit) {
            return new Response(
              JSON.stringify({ success: false, error: getQuotaExceededMessage("monthly_video_audio", language === "zh" ? "zh" : "en") }),
              { status: 402, headers: { "Content-Type": "application/json" } },
            );
          }

          const payload: any = {
            userId: user.id,
            month: currentMonth,
            month_used_photo: usedPhoto + imageCount,
            month_used_video_audio: usedVideoAudio + videoAudioCount,
            updatedAt: new Date().toISOString(),
          };
          if (row?._id) {
            await quotaColl.doc(row._id).update(payload);
          } else {
            await quotaColl.add(payload);
          }
          console.log("[quota][stream] monthly updated", {
            user: user.id,
            photo: usedPhoto + imageCount,
            photoLimit,
            videoAudio: usedVideoAudio + videoAudioCount,
            videoAudioLimit,
          });
        }
      } else {
        // 未知模型：按外部模型处理
        const res = await consumeDaily();
        if (!res.allowed) {
          return new Response(JSON.stringify({ success: false, error: res.error }), {
            status: 402,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }

    const mergedMessages: IncomingMessage[] =
      Array.isArray(processedMessages) && processedMessages.length > 0
        ? [...processedMessages]
        : [{ role: "user", content: message || "", images, videos, audios }];

    if ((images?.length || videos?.length || audios?.length) && mergedMessages.length > 0) {
      const lastUserIdx = [...mergedMessages].reverse().findIndex((m) => m.role === "user");
      if (lastUserIdx !== -1) {
        const realIdx = mergedMessages.length - 1 - lastUserIdx;
        mergedMessages[realIdx] = {
          ...mergedMessages[realIdx],
          images: Array.from(new Set([...(mergedMessages[realIdx].images || []), ...(images || [])])),
          videos: Array.from(new Set([...(mergedMessages[realIdx].videos || []), ...(videos || [])])),
          audios: Array.from(new Set([...(mergedMessages[realIdx].audios || []), ...(audios || [])])),
        };
      }
    }

    const allImageIds = mergedMessages
      .flatMap((m) => m.images || [])
      .filter((v) => typeof v === "string" && !v.startsWith("http"));
    const allVideoIds = mergedMessages
      .flatMap((m) => m.videos || [])
      .filter((v) => typeof v === "string" && !v.startsWith("http"));
    const allAudioIds = mergedMessages
      .flatMap((m) => (m as any).audios || [])
      .filter((v) => typeof v === "string" && !v.startsWith("http"));

    const audioCount = mergedMessages.reduce(
      (acc, m) => acc + ((m as any).audios?.length || 0),
      0,
    );
    if (audioCount > 1) {
      return new Response(
        JSON.stringify({ success: false, error: "音频输入目前仅支持单个文件，请分开发送。" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
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

      console.log("[media][stream] resolved temp URLs", {
        requested: needIds.length,
        resolved: Object.keys(tempUrlMap).length,
      });
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
      console.log("[media][stream] openaiMessages sample", {
        count: openaiMessages.length,
        firstUser,
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
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
      const safeWrite = async (data: Uint8Array) => {
        if (closed) return;
        try {
          await writer.write(data);
        } catch {
          closed = true;
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
        try {
          await writer.close();
        } catch {}
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
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
                await safeWrite(encoder.encode(`data: ${JSON.stringify({ chunk: cleaned })}\n\n`));
              }
            } catch {
              // ignore malformed chunk
            }
          }
        }
      } catch (err) {
        await safeWrite(
          encoder.encode(
            `data: ${JSON.stringify({
              chunk: language === "zh" ? "抱歉，流式响应中断。" : "Stream interrupted.",
            })}\n\n`
          )
        );
      } finally {
        await sendDone();
        await closeWriter();
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
