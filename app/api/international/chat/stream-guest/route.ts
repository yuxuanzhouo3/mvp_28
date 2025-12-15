/**
 * 国际版游客聊天 Stream API
 * 游客模式有以下限制：
 * 1. 只能使用通用模型
 * 2. 上下文限制为 5 条消息
 * 3. 不支持多模态
 */

import { createClient } from "@/lib/supabase/server";
import { getModelCategory, getFreeContextMsgLimit } from "@/utils/model-limits";
import {
  seedSupabaseWalletForPlan,
  checkSupabaseDailyExternalQuota,
  consumeSupabaseDailyExternalQuota,
  getSupabaseUserWallet,
} from "@/services/wallet-supabase";
import { isAfter } from "date-fns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

// 游客上下文限制
const GUEST_CONTEXT_LIMIT = 5;

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

/**
 * 截断消息历史
 */
function truncateContextMessages<T>(messages: T[], limit: number): T[] {
  if (messages.length <= limit) return messages;
  return messages.slice(-limit);
}

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
  return { planLower, planActive };
}

export async function POST(req: Request) {
  try {
    const { model, modelId, messages = [], message, language, images = [], videos = [], audios = [] } = await req.json();
    
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

    const modelName = model || modelId || "mistral-small-latest";
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
      const wallet = await getSupabaseUserWallet(userId);
      const plan = getPlanInfo(userMeta, wallet);
      effectivePlanLower = plan.planActive ? plan.planLower : "free";
      
      // 登录用户使用完整上下文限制
      contextLimit = getFreeContextMsgLimit();
      
      // 确保钱包存在
      await seedSupabaseWalletForPlan(userId, effectivePlanLower);
      
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

    (async () => {
      const reader = upstream.body!.getReader();
      let buffer = "";
      let closed = false;
      let streamFinished = false;

      const safeWrite = async (data: Uint8Array) => {
        if (closed) return;
        try {
          await writer.write(data);
        } catch {
          closed = true;
        }
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
              streamFinished = true;
              if (!closed) {
                await writer.write(encoder.encode("data: [DONE]\n\n"));
                await writer.close();
                closed = true;
              }
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = extractDelta(parsed);
              if (delta && delta.trim().length > 0) {
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
      } finally {
        if (!closed) {
          try {
            await writer.write(encoder.encode("data: [DONE]\n\n"));
            await writer.close();
          } catch {
            // stream already closed, ignore
          }
        }

        // 扣减每日配额（仅登录用户）
        if (shouldDeductDailyExternal && streamFinished && userId) {
          const consumeDailyResult = await consumeSupabaseDailyExternalQuota(
            userId,
            effectivePlanLower,
            1
          );
          if (!consumeDailyResult.success) {
            console.error("[quota][stream-guest][daily-consume-error]", consumeDailyResult.error);
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
