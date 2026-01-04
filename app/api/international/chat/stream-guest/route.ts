/**
 * 国际版游客聊天 Stream API
 * 游客模式有以下限制：
 * 1. 只能使用通用模型
 * 2. 上下文限制为 5 条消息
 * 3. 不支持多模态
 * 4. 每日请求次数限制（基于 IP）
 */

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getExpertModelDefinition, isExpertModelId } from "@/constants/expert-models";
import { getModelCategory, getFreeContextMsgLimit } from "@/utils/model-limits";
import {
  seedSupabaseWalletForPlan,
  checkSupabaseDailyExternalQuota,
  consumeSupabaseDailyExternalQuota,
  getSupabaseUserWallet,
} from "@/services/wallet-supabase";
import { getPlanInfo, truncateContextMessages } from "@/utils/plan-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const INTERNATIONAL_GENERAL_MODEL_ID = "mistral-small-latest";

// 游客上下文限制
const GUEST_CONTEXT_LIMIT = 5;

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
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

const getMistralProvider = (modelId: string) => {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey || !modelId) return null;
  return {
    model: modelId,
    url: MISTRAL_URL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  };
};

// Extract streaming delta content from Mistral response
const extractDelta = (data: any): string => {
  const choice = data?.choices?.[0];
  if (!choice) return "";
  const delta = choice.delta?.content ?? choice.message?.content;
  if (Array.isArray(delta)) {
    return delta.map((c: any) => c?.text ?? c ?? "").join("");
  }
  return delta || "";
};

export async function POST(req: Request) {
  try {
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
    } = await req.json();

    const expertDef =
      typeof expertModelId === "string" && isExpertModelId(expertModelId)
        ? getExpertModelDefinition(expertModelId)
        : null;
    
    // 检查是否有媒体附件
    const hasMediaPayload =
      (Array.isArray(images) && images.length > 0) ||
      (Array.isArray(videos) && videos.length > 0) ||
      (Array.isArray(audios) && audios.length > 0) ||
      (Array.isArray(messages) &&
        messages.some((m: any) => (m?.images || m?.videos || m?.audios || []).length > 0));

    if (hasMediaPayload) {
      return new Response(
        JSON.stringify({
          success: false,
          error: language === "zh"
            ? "国际版暂不支持图片/视频/音频对话，该功能即将推出。"
            : "International version does not support image/video/audio chat yet. Coming soon!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Expert models must always use the same underlying model as General Model.
    const modelName = expertDef
      ? INTERNATIONAL_GENERAL_MODEL_ID
      : model || modelId || INTERNATIONAL_GENERAL_MODEL_ID;
    const category = getModelCategory(modelName);
    
    // 尝试获取用户信息（可能已登录但走了游客路由）
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    const isLoggedIn = !!userData?.user;

    let effectivePlanLower = "free";
    let contextLimit = GUEST_CONTEXT_LIMIT;
    let shouldDeductDailyExternal = false;
    let userId: string | null = null;

    if (isLoggedIn && userData?.user) {
      userId = userData.user.id;
      const userMeta = userData.user.user_metadata as any;
      let wallet = await getSupabaseUserWallet(userId);
      let plan = getPlanInfo(userMeta, wallet);
      effectivePlanLower = plan.planActive ? plan.planLower : "free";

      // 登录用户使用完整上下文限制
      contextLimit = getFreeContextMsgLimit();

      // 确保钱包存在
      await seedSupabaseWalletForPlan(userId, effectivePlanLower);
      wallet = await getSupabaseUserWallet(userId);
      plan = getPlanInfo(userMeta, wallet);
      effectivePlanLower = plan.planActive ? plan.planLower : "free";

      // 外部模型需要扣减配额
      if (category === "external") {
        shouldDeductDailyExternal = true;

        // 检查每日配额
        const dailyCheck = await checkSupabaseDailyExternalQuota(userId, effectivePlanLower, 1);
        if (!dailyCheck.allowed) {
          return new Response(
            JSON.stringify({
              success: false,
              error: language === "zh"
                ? "今日外部模型配额已用完，请升级套餐或明天再试，或切换到通用模型（General Model）继续使用。"
                : "Daily external model quota exceeded. Please upgrade your plan, try again tomorrow, or switch to the General Model.",
            }),
            { status: 402, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    } else {
      // 游客模式：检查 IP 限制
      const clientIp = getClientIp(req);
      const rateLimit = checkIpRateLimit(clientIp);

      if (!rateLimit.allowed) {
        console.log("[quota][stream-guest-intl] IP rate limit exceeded", { clientIp });
        return new Response(
          JSON.stringify({
            success: false,
            error: language === "zh"
              ? "今日试用次数已用完，请登录后继续使用。"
              : "Daily trial limit reached. Please sign in to continue.",
            rateLimitExceeded: true,
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      console.log("[quota][stream-guest-intl] guest mode enabled", {
        clientIp,
        remaining: rateLimit.remaining,
      });

      // 游客模式：只允许使用通用模型
      if (category === "external") {
        return new Response(
          JSON.stringify({
            success: false,
            error: language === "zh"
              ? "游客模式下只能使用通用模型。请登录以使用高级模型。"
              : "Guest mode only supports general models. Please sign in to use advanced models.",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const provider = getMistralProvider(modelName);

    if (!provider) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing MISTRAL_API_KEY or model id" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 截断上下文
    let processedMessages = Array.isArray(messages) ? [...messages] : [];
    if (processedMessages.length > contextLimit) {
      processedMessages = truncateContextMessages(processedMessages, contextLimit);
    }

    const finalMessages =
      processedMessages.length > 0
        ? [...processedMessages, { role: "user", content: message || "" }]
        : [{ role: "user", content: message || "" }];

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
        ...(language === "zh"
          ? { "Accept-Language": "zh-CN,zh;q=0.9" }
          : { "Accept-Language": "en-US,en;q=0.9" }),
      },
      body: JSON.stringify({
        model: provider.model,
        messages: finalMessages.map((m: any) => ({ role: m.role, content: m.content })),
        stream: true,
        temperature: 0.7,
      }),
      signal: upstreamController.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text();
      return new Response(
        JSON.stringify({ success: false, error: errText || "Upstream error" }),
        { status: upstream.status || 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const userMessageAt = new Date().toISOString();
    let assistantMessage = "";

    (async () => {
      const reader = upstream.body!.getReader();
      let buffer = "";
      let closed = false;
      let doneSent = false;
      let clientAborted = req.signal.aborted || upstreamController.signal.aborted;
      let streamFinished = false;
      let hasContentOutput = false;

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
              streamFinished = true;
              await sendDone();
              await closeWriter();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = extractDelta(parsed);
              if (delta && delta.trim().length > 0) {
                const wrote = await safeWrite(
                  encoder.encode(`data: ${JSON.stringify({ chunk: delta })}\n\n`)
                );
                if (!wrote) break;
                hasContentOutput = true;
                assistantMessage += delta;
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
        }
      } finally {
        await sendDone();
        await closeWriter();

        // 扣减每日配额（仅登录用户）
        if (shouldDeductDailyExternal && hasContentOutput && userId) {
          const consumeDailyResult = await consumeSupabaseDailyExternalQuota(
            userId,
            effectivePlanLower,
            1
          );
          if (!consumeDailyResult.success) {
            console.error("[quota][stream-guest][daily-consume-error]", consumeDailyResult.error);
          }
        }

        // 专家模型对话落库（分表），不影响主流程
        const shouldLog = hasContentOutput;
        if (expertDef && userId && supabaseAdmin && shouldLog && assistantMessage.trim().length > 0) {
          try {
            const { error } = await supabaseAdmin.from(expertDef.supabaseTable).insert({
              user_id: userId,
              user_message: message || "",
              user_message_at: userMessageAt,
              assistant_message: assistantMessage,
              assistant_message_at: new Date().toISOString(),
              model_id: modelName,
            });
            if (error) {
              console.error("[expert-log][supabase] insert failed", error);
            }
          } catch (err) {
            console.error("[expert-log][supabase] insert failed", err);
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
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
