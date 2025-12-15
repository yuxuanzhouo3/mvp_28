/**
 * 国际版登录用户聊天 Stream API
 * 支持配额验证、上下文截断、额度扣减
 */

import { createClient } from "@/lib/supabase/server";
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
import { isAfter } from "date-fns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

/**
 * 获取用户计划信息
 */
function getPlanInfo(userMeta: any, wallet: any) {
  const rawPlan =
    wallet?.plan ||
    wallet?.subscription_tier ||
    (userMeta?.plan as string | undefined) ||
    (userMeta?.subscriptionTier as string | undefined) ||
    "";
  const rawPlanLower = typeof rawPlan === "string" ? rawPlan.toLowerCase() : "";
  const planExp = wallet?.plan_exp ? new Date(wallet.plan_exp) : 
                  userMeta?.plan_exp ? new Date(userMeta.plan_exp) : null;
  const planActive = planExp ? isAfter(planExp, new Date()) : true;
  const planLower = planActive ? rawPlanLower : "free";
  const isProFlag = !!wallet?.pro || (!!userMeta?.pro && planLower !== "free" && planLower !== "basic");
  const isBasic = planLower === "basic";
  const isPro = planLower === "pro" || planLower === "enterprise" || isProFlag;
  const isEnterprise = planLower === "enterprise";
  const isFree = !isPro && !isBasic && !isEnterprise;
  return { planLower, isPro, isBasic, isEnterprise, isFree, planActive, planExp };
}

/**
 * 获取上下文限制
 */
function getContextLimit(planLower: string): number {
  switch (planLower) {
    case "basic":
      return getBasicContextMsgLimit();
    case "pro":
      return getProContextMsgLimit();
    case "enterprise":
      return getEnterpriseContextMsgLimit();
    default:
      return getFreeContextMsgLimit();
  }
}

/**
 * 截断消息历史以符合上下文限制
 */
function truncateContextMessages<T>(messages: T[], limit: number): T[] {
  if (messages.length <= limit) return messages;
  return messages.slice(-limit);
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
    } = (await req.json()) as {
      model?: string;
      modelId?: string;
      messages?: IncomingMessage[];
      message?: string;
      language?: string;
      images?: string[];
      videos?: string[];
      audios?: string[];
    };

    // ============================================================
    // 用户认证
    // ============================================================
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Please login first" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    const userMeta = userData.user.user_metadata as any;

    // 获取钱包信息
    const wallet = await getSupabaseUserWallet(userId);
    const plan = getPlanInfo(userMeta, wallet);
    
    // 确保钱包存在
    const effectivePlanLower = plan.planActive ? plan.planLower : "free";
    await seedSupabaseWalletForPlan(userId, effectivePlanLower);

    // ============================================================
    // 上下文截断
    // ============================================================
    let contextTruncated = false;
    let processedMessages = [...messages];
    const contextLimit = getContextLimit(effectivePlanLower);

    if (processedMessages.length > contextLimit) {
      processedMessages = truncateContextMessages(processedMessages, contextLimit);
      contextTruncated = true;
    }

    // ============================================================
    // 媒体检测（国际版暂不支持多模态，但保留验证逻辑）
    // ============================================================
    const hasMediaPayload =
      (Array.isArray(images) && images.length > 0) ||
      (Array.isArray(videos) && videos.length > 0) ||
      (Array.isArray(audios) && audios.length > 0) ||
      (Array.isArray(messages) &&
        messages.some((m) => (m?.images || m?.videos || m?.audios || []).length > 0));

    // 国际版暂不支持多模态，如果有媒体附件则返回提示
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

    const modelName = model || modelId || "mistral-small-latest";
    const finalModelId = modelId || modelName;
    const provider = getMistralProvider(modelName);

    if (!provider) {
      return new Response(
        JSON.stringify({ success: false, error: "Unsupported model or missing API key" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // 配额校验
    // ============================================================
    const category = getModelCategory(finalModelId);
    const imageCount = getImageCount({ images });
    const videoAudioCount = getVideoAudioCount({ videos, audios });
    const requiresMediaQuota =
      category === "advanced_multimodal" && (imageCount > 0 || videoAudioCount > 0);
    const shouldDeductMediaQuota = requiresMediaQuota;
    // 外部模型或多模态模型的纯文本对话都需要扣减每日外部模型额度
    const shouldDeductDailyExternal = category === "external" || 
      (category === "advanced_multimodal" && imageCount === 0 && videoAudioCount === 0);

    // 媒体配额校验（国际版暂时跳过，因为不支持多模态）
    if (requiresMediaQuota) {
      const quotaCheck = await checkSupabaseQuota(userId, imageCount, videoAudioCount);

      if (!quotaCheck.hasEnoughQuota) {
        const errorKey =
          quotaCheck.totalImageBalance < imageCount ? "monthly_photo" : "monthly_video_audio";
        console.warn("[quota][stream] media quota insufficient", {
          userId,
          effectivePlanLower,
          quotaCheck,
          requested: { imageCount, videoAudioCount },
        });
        return new Response(
          JSON.stringify({
            success: false,
            error: getQuotaExceededMessage(errorKey as any, language === "zh" ? "zh" : "en"),
          }),
          { status: 402, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 外部模型每日配额校验
    if (shouldDeductDailyExternal) {
      const dailyCheck = await checkSupabaseDailyExternalQuota(userId, effectivePlanLower, 1);
      if (!dailyCheck.allowed) {
        console.warn("[quota][stream] daily external insufficient", {
          userId,
          effectivePlanLower,
          dailyCheck,
        });
        return new Response(
          JSON.stringify({
            success: false,
            error: getQuotaExceededMessage("daily", language === "zh" ? "zh" : "en"),
          }),
          { status: 402, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // ============================================================
    // 构建消息并调用上游
    // ============================================================
    const mergedMessages: IncomingMessage[] =
      Array.isArray(processedMessages) && processedMessages.length > 0
        ? [...processedMessages, { role: "user", content: message || "" }]
        : [{ role: "user", content: message || "" }];

    // 转换为 OpenAI 格式（仅文本）
    const openaiMessages = mergedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

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
        messages: openaiMessages,
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text();
      return new Response(
        JSON.stringify({ success: false, error: errText || "Upstream error" }),
        { status: upstream.status || 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // 流式响应处理
    // ============================================================
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    (async () => {
      const reader = upstream.body!.getReader();
      let buffer = "";
      let closed = false;
      let streamFinished = false;
      let hasContentOutput = false; // 标记是否有内容输出（用于手动暂停时也扣费）

      const safeWrite = async (data: Uint8Array) => {
        if (closed) return;
        try {
          await writer.write(data);
        } catch {
          closed = true;
        }
      };

      const sendDone = async () => {
        if (closed) return;
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
              if (delta && delta.trim().length > 0) {
                hasContentOutput = true; // AI已开始输出内容
                await safeWrite(
                  encoder.encode(`data: ${JSON.stringify({ chunk: delta })}\n\n`)
                );
              }
            } catch {
              // ignore malformed chunk
            }
          }
        }
        streamFinished = true;
      } catch (err) {
        await safeWrite(
          encoder.encode(
            `data: ${JSON.stringify({
              chunk: language === "zh" ? "抱歉，流式响应中断。" : "Stream interrupted.",
            })}\n\n`
          )
        );
        console.warn("[quota][stream] upstream interrupted", err instanceof Error ? err.message : err);
      } finally {
        await sendDone();
        await closeWriter();

        // 响应完成后扣减配额（AI成功输出内容后才扣费，手动暂停也算）
        const shouldCharge = streamFinished || hasContentOutput;
        
        if (shouldDeductMediaQuota && shouldCharge) {
          const consumeResult = await consumeSupabaseQuota({
            userId,
            imageCount,
            videoAudioCount,
          });
          if (!consumeResult.success) {
            console.error("[quota][stream][consume-error]", consumeResult.error);
          }
        }

        if (shouldDeductDailyExternal && shouldCharge) {
          const consumeDailyResult = await consumeSupabaseDailyExternalQuota(
            userId,
            effectivePlanLower,
            1
          );
          if (!consumeDailyResult.success) {
            console.error("[quota][stream][daily-consume-error]", consumeDailyResult.error);
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



