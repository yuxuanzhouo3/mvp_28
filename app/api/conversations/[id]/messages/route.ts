import { NextRequest } from "next/server";
import { isAfter } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { checkDailyExternalQuota, checkQuota, seedWalletForPlan } from "@/services/wallet";
import {
  getModelCategory,
  isGeneralModel,
  isExternalModel,
  isAdvancedMultimodalModel,
  getFreeDailyLimit,
  getBasicDailyLimit,
  getFreeMonthlyPhotoLimit,
  getBasicMonthlyPhotoLimit,
  getFreeMonthlyVideoAudioLimit,
  getBasicMonthlyVideoAudioLimit,
  getFreeContextMsgLimit,
  getBasicContextMsgLimit,
  getProDailyLimit,
  getProMonthlyPhotoLimit,
  getProMonthlyVideoAudioLimit,
  getProContextMsgLimit,
  getEnterpriseDailyLimit,
  getEnterpriseMonthlyPhotoLimit,
  getEnterpriseMonthlyVideoAudioLimit,
  getEnterpriseContextMsgLimit,
  getTodayString,
  getCurrentYearMonth,
  getQuotaExceededMessage,
  getImageCount,
  getVideoAudioCount,
  MediaPayload,
} from "@/utils/model-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getDomesticUser(req: NextRequest) {
  const raw = req.cookies.get("auth-token")?.value;
  const token = raw ? decodeURIComponent(raw) : null;
  if (!token) return null;
  const auth = new CloudBaseAuthService();
  return await auth.validateToken(token);
}

function isDomesticRequest(req: NextRequest) {
  // 版本隔离：仅根据部署环境决定（避免 en 环境因残留 auth-token 误访问国内数据）
  return IS_DOMESTIC_VERSION;
}

function getPlanInfo(meta: any) {
  const rawPlan =
    (meta?.plan as string | undefined) ||
    (meta?.subscriptionTier as string | undefined) ||
    "";
  const rawPlanLower = typeof rawPlan === "string" ? rawPlan.toLowerCase() : "";
  const planExp = meta?.plan_exp ? new Date(meta.plan_exp) : null;
  const planActive = planExp ? isAfter(planExp, new Date()) : true;
  const planLower = planActive ? rawPlanLower : "free";
  const isBasic = planLower === "basic";
  const isProPlan = planLower === "pro";
  const isEnterprise = planLower === "enterprise";
  const isUnlimitedFlag = !!meta?.pro && !isBasic && !isProPlan && !isEnterprise;
  const isFree = !isEnterprise && !isProPlan && !isBasic && !isUnlimitedFlag;
  return { planLower, isPro: isProPlan && planActive, isBasic, isFree, isEnterprise, isUnlimitedFlag, planActive, planExp };
}

/**
 * 使用 wallet 校验媒体配额（仅检查，不扣减）
 */
async function validateMediaQuotaWithWallet(params: {
  userId: string;
  planLower: string;
  modelId: string;
  mediaPayload: MediaPayload;
  language?: string;
}): Promise<{ allowed: boolean; error?: string }> {
  const { userId, planLower, modelId, mediaPayload, language = "zh" } = params;
  const category = getModelCategory(modelId);
  const imageCount = getImageCount(mediaPayload);
  const videoAudioCount = getVideoAudioCount(mediaPayload);

  // 非多模态或纯文本不校验媒体额度
  if (category !== "advanced_multimodal" || (imageCount === 0 && videoAudioCount === 0)) {
    return { allowed: true };
  }

  // 确保 wallet 存在并按套餐初始化
  await seedWalletForPlan(userId, planLower || "free");
  const quota = await checkQuota(userId, imageCount, videoAudioCount);

  if (!quota.hasEnoughQuota) {
    const errorKey =
      quota.totalImageBalance < imageCount ? "monthly_photo" : "monthly_video_audio";
    return {
      allowed: false,
      error: getQuotaExceededMessage(errorKey as any, language),
    };
  }

  return { allowed: true };
}

// Get messages for a conversation
export async function GET(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await paramsPromise;

  if (!isDomesticRequest(req)) {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response("Unauthorized", { status: 401 });
    }
    const plan = getPlanInfo(userData.user.user_metadata);

    // Free 用户或本地会话不返回历史
    if (conversationId.startsWith("local-")) {
      return Response.json([]);
    }

    const { data, error } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("List messages error", error);
      return new Response("Failed to list messages", { status: 500 });
    }

    return Response.json(data ?? []);
  }

  // domestic -> CloudBase
  const user = await getDomesticUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const plan = getPlanInfo(user.metadata);

  // 本地会话不返回历史
  if (conversationId.startsWith("local-")) {
    return Response.json([]);
  }

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  try {
    const collection = db.collection("messages");
    let res = await collection.where({ conversationId, userId: user.id }).get();
    let records = res?.data || [];

    // 防御性兜底：如果按 userId 查不到，先按会话 ID 拿全部再过滤 userId，避免索引/类型问题
    if (!records.length) {
      const allByConv = await collection.where({ conversationId }).get();
      records = (allByConv?.data || []).filter((m: any) => m.userId === user.id);
    }

    const list = (records || [])
      .map((m: any) => ({
        id: m._id,
        role: m.role,
        content: m.content,
        created_at: m.createdAt,
        imageFileIds: m.imageFileIds || [],
        videoFileIds: m.videoFileIds || [],
        audioFileIds: (m as any).audioFileIds || [],
      }))
      .sort(
        (a: any, b: any) =>
          new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime(),
      );

    return Response.json(list);
  } catch (error) {
    console.error("CloudBase list messages error", error);
    return new Response("Failed to list messages", { status: 500 });
  }
}

// Insert a message into a conversation
export async function POST(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await paramsPromise;
  const reqBody = await req.json();
  const {
    role,
    content,
    client_id,
    tokens,
    images,
    imageFileIds,
    videos,
    videoFileIds,
    audios,
    audioFileIds,
    modelId, // 新增：当前使用的模型 ID
  } = reqBody;

  const normalizedClientId =
    typeof client_id === "string" && client_id.trim().length > 0
      ? client_id.trim()
      : null;

  // 构建媒体 payload
  const mediaPayload: MediaPayload = {
    images: Array.isArray(images) ? images : Array.isArray(imageFileIds) ? imageFileIds : [],
    videos: Array.isArray(videos) ? videos : Array.isArray(videoFileIds) ? videoFileIds : [],
    audios: Array.isArray(audios) ? audios : Array.isArray(audioFileIds) ? audioFileIds : [],
  };

  if (!isDomesticRequest(req)) {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response("Unauthorized", { status: 401 });
    }
    const userId = userData.user.id;
    const plan = getPlanInfo(userData.user.user_metadata);
    const effectivePlanLower = plan.planLower || "free";
    const isBasicUser = effectivePlanLower === "basic";

    // Enforce daily quota on user messages (只校验，不扣减)
    // 注意：只有外部模型才扣除 daily external quota，MornGPT 专家模型不扣除
    const currentModelId = modelId || "";
    const shouldCheckDailyQuota = role === "user" && isExternalModel(currentModelId);

    if (shouldCheckDailyQuota) {
      const today = new Date().toISOString().split("T")[0];
      const limit = (() => {
        if (effectivePlanLower === "enterprise") {
          return getEnterpriseDailyLimit();
        }
        if (effectivePlanLower === "pro") {
          return getProDailyLimit();
        }
        if (effectivePlanLower === "basic") {
          return getBasicDailyLimit();
        }
        return getFreeDailyLimit();
      })();

      // 使用 user_wallets 表跟踪每日配额
      let used = 0;
      const { data: walletRow, error: walletErr } = await supabase
        .from("user_wallets")
        .select("daily_external_day, daily_external_used, daily_external_plan, monthly_image_balance, monthly_video_balance")
        .eq("user_id", userId)
        .single();

      if (walletErr && walletErr.code !== "PGRST116") {
        console.error("Quota fetch error", walletErr);
        return new Response("Failed to check quota", { status: 500 });
      }

      // 检查是否是同一天/同一套餐，如果不是则重置计数（仅重置，不在此处扣减）
      const walletDay = walletRow?.daily_external_day;
      const walletPlan = walletRow?.daily_external_plan;
      const isNewDay = walletDay !== today;
      const isPlanChanged = !!walletPlan && walletPlan !== effectivePlanLower;

      if (isNewDay || isPlanChanged) {
        used = 0;
        const { error: resetErr } = await supabase
          .from("user_wallets")
          .update({
            daily_external_used: 0,
            daily_external_day: today,
            daily_external_plan: effectivePlanLower,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
        if (resetErr) {
          console.error("Quota reset error", resetErr);
          return new Response("Failed to reset quota", { status: 500 });
        }
      } else {
        used = walletRow?.daily_external_used ?? 0;
      }

      if (used >= limit) {
        return new Response(
          JSON.stringify({
            error: "Daily quota reached",
            remaining: 0,
            limit,
          }),
          { status: 402, headers: { "Content-Type": "application/json" } },
        );
      }

      // 注意：此处只做“校验”，不做“扣减”。实际扣减在 AI 成功输出后由 /chat/stream 执行，避免无响应误扣。

      // Basic 高级多模态媒体配额检查（国际版）- 使用 user_wallets
      if (isBasicUser) {
        const currentModelId = modelId || "qwen3-omni-flash";
        const modelCategory = getModelCategory(currentModelId);
        const hasMedia =
          (mediaPayload.images?.length || 0) > 0 ||
          (mediaPayload.videos?.length || 0) > 0 ||
          (mediaPayload.audios?.length || 0) > 0;
        if (modelCategory === "advanced_multimodal" && hasMedia) {
          const imageCount = getImageCount(mediaPayload);
          const videoAudioCount = getVideoAudioCount(mediaPayload);

          // 从已查询的 walletRow 获取月度余额
          const monthlyImageBalance = walletRow?.monthly_image_balance ?? 0;
          const monthlyVideoBalance = walletRow?.monthly_video_balance ?? 0;

          if (imageCount > 0 && monthlyImageBalance < imageCount) {
            return new Response(
              JSON.stringify({
                error: getQuotaExceededMessage("monthly_photo", "en"),
                quotaType: "monthly_photo",
                remaining: Math.max(0, monthlyImageBalance),
              }),
              { status: 402, headers: { "Content-Type": "application/json" } },
            );
          }

          if (videoAudioCount > 0 && monthlyVideoBalance < videoAudioCount) {
            return new Response(
              JSON.stringify({
                error: getQuotaExceededMessage("monthly_video_audio", "en"),
                quotaType: "monthly_video_audio",
                remaining: Math.max(0, monthlyVideoBalance),
              }),
              { status: 402, headers: { "Content-Type": "application/json" } },
            );
          }

          // 注意：此处只做“校验”，不做“扣减”。实际扣减在 AI 成功输出后由 /chat/stream 执行，避免无响应误扣。
        }
      }

    }

    // Free 用户或本地会话不落库消息
    if (conversationId.startsWith("local-")) {
      return new Response(null, { status: 201 });
    }

    // Idempotency: avoid duplicate inserts for the same client_id in a conversation
    if (normalizedClientId) {
      const { data: existing, error: existingErr } = await supabase
        .from("messages")
        .select("id, content")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .eq("client_id", normalizedClientId)
        .maybeSingle();

      if (existingErr) {
        console.warn("[messages][dedupe] lookup failed", existingErr);
      } else if (existing) {
        const existingContent = typeof existing.content === "string" ? existing.content : "";
        const nextContent = typeof content === "string" ? content : "";
        const shouldUpdate = nextContent.length > existingContent.length;
        if (shouldUpdate) {
          const { error: updateErr } = await supabase
            .from("messages")
            .update({ content, tokens: tokens || null })
            .eq("id", existing.id)
            .eq("conversation_id", conversationId)
            .eq("user_id", userId);
          if (updateErr) {
            console.error("[messages][dedupe] update failed", updateErr);
          }
        }

        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId)
          .eq("user_id", userId);

        return new Response(null, { status: 200 });
      }
    }

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      user_id: userId,
      role,
      content,
      client_id: normalizedClientId,
      tokens: tokens || null,
    });
    if (error) {
      console.error("Insert message error", error);
      return new Response("Failed to insert message", { status: 500 });
    }

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("user_id", userId);

    return new Response(null, { status: 201 });
  }

  // domestic -> CloudBase
  const user = await getDomesticUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const plan = getPlanInfo(user.metadata);

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  try {
    // ============================================================
    // 国内版媒体配额校验（仅检查，扣减在 AI 成功后）
    // ============================================================
    if (role === "user") {
      const currentModelId = modelId || "qwen3-omni-flash";
      const quotaResult = await validateMediaQuotaWithWallet({
        userId: user.id,
        planLower: plan.planLower || "free",
        modelId: currentModelId,
        mediaPayload,
        language: "zh",
      });

      if (!quotaResult.allowed) {
        return new Response(
          JSON.stringify({
            error: quotaResult.error,
            remaining: 0,
          }),
          { status: 402, headers: { "Content-Type": "application/json" } },
        );
      }

      // 国内版：外部模型 & Omni 纯文本对话，检查每日外部模型额度（只校验，扣减在 AI 成功输出后）
      const category = getModelCategory(currentModelId);
      const imageCount = getImageCount(mediaPayload);
      const videoAudioCount = getVideoAudioCount(mediaPayload);
      const shouldCheckDailyExternal =
        category === "external" ||
        (category === "advanced_multimodal" && imageCount === 0 && videoAudioCount === 0);

      if (shouldCheckDailyExternal) {
        const effectivePlanLower = plan.planActive ? plan.planLower || "free" : "free";
        const dailyCheck = await checkDailyExternalQuota(user.id, effectivePlanLower, 1);
        if (!dailyCheck.allowed) {
          return new Response(
            JSON.stringify({
              error: getQuotaExceededMessage("daily", "zh"),
              quotaType: "daily",
              remaining: 0,
              limit: dailyCheck.limit,
            }),
            { status: 402, headers: { "Content-Type": "application/json" } },
          );
        }
      }
    }

    // Free 用户或本地会话：不落库，仅返回成功
    if (conversationId.startsWith("local-")) {
      return new Response(null, { status: 201 });
    }

    const now = new Date().toISOString();

    // Idempotency: avoid duplicate inserts for the same clientId in a conversation
    if (normalizedClientId) {
      const existRes = await db
        .collection("messages")
        .where({ conversationId, userId: user.id, clientId: normalizedClientId })
        .get();
      const existing = (existRes?.data || [])[0] as any | undefined;
      if (existing?._id) {
        const existingContent = typeof existing.content === "string" ? existing.content : "";
        const nextContent = typeof content === "string" ? content : "";
        const shouldUpdate = nextContent.length > existingContent.length;
        if (shouldUpdate) {
          await db.collection("messages").doc(existing._id).update({
            content,
            tokens: tokens || null,
            updatedAt: now,
          });
        }

        // touch conversation
        await db.collection("conversations").doc(conversationId).update({
          updatedAt: now,
        });

        return Response.json({ id: existing._id }, { status: 200 });
      }
    }

    const addRes = await db.collection("messages").add({
      conversationId,
      userId: user.id,
      role,
      content,
      clientId: normalizedClientId,
      tokens: tokens || null,
      createdAt: now,
      imageFileIds: mediaPayload.images,
      videoFileIds: mediaPayload.videos,
      audioFileIds: mediaPayload.audios,
    });

    // touch conversation
    await db.collection("conversations").doc(conversationId).update({
      updatedAt: now,
    });

    return Response.json({ id: addRes.id }, { status: 201 });
  } catch (error) {
    console.error("CloudBase insert message error", error);
    return new Response("Failed to insert message", { status: 500 });
  }
}

// Delete a message from a conversation
export async function DELETE(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await paramsPromise;
  const { messageId } = await req.json();

  if (!messageId) {
    return new Response("messageId required", { status: 400 });
  }

  if (!isDomesticRequest(req)) {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response("Unauthorized", { status: 401 });
    }
    const userId = userData.user.id;

    const { data: msg, error: fetchErr } = await supabase
      .from("messages")
      .select("id")
      .eq("id", messageId)
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .single();

    if (fetchErr || !msg) {
      return new Response("Message not found", { status: 404 });
    }

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId)
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);

    if (error) {
      console.error("Delete message error", error);
      return new Response("Failed to delete message", { status: 500 });
    }

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("user_id", userId);

    return new Response(null, { status: 204 });
  }

  // domestic -> CloudBase
  const user = await getDomesticUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  try {
    // verify ownership; allow delete by _id or clientId (front-end may send client id)
    let targetMsg: any | null = null;

    const msgRes = await db.collection("messages").doc(messageId).get();
    if (msgRes?.data?.[0]) {
      targetMsg = msgRes.data[0];
    } else {
      const byClient = await db
        .collection("messages")
        .where({ clientId: messageId, conversationId, userId: user.id })
        .limit(1)
        .get();
      targetMsg = byClient?.data?.[0] || null;
    }

    if (!targetMsg || targetMsg.conversationId !== conversationId || targetMsg.userId !== user.id) {
      return new Response("Message not found", { status: 404 });
    }

    const docId = targetMsg._id || messageId;
    await db.collection("messages").doc(docId).remove();
    await db.collection("conversations").doc(conversationId).update({
      updatedAt: new Date().toISOString(),
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("CloudBase delete message error", error);
    return new Response("Failed to delete message", { status: 500 });
  }
}
