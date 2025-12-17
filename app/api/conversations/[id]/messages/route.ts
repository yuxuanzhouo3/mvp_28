import { NextRequest } from "next/server";
import { isAfter } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { checkQuota, seedWalletForPlan } from "@/services/wallet";
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
  const langIsZh = IS_DOMESTIC_VERSION;
  const hasCloudToken = !!req.cookies.get("auth-token");
  return langIsZh || hasCloudToken;
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
    const userPlan =
      (userData.user.user_metadata as any)?.plan ||
      ((userData.user.user_metadata as any)?.pro ? "Pro" : null);
    const isFreeUser =
      !userPlan ||
      (typeof userPlan === "string" &&
        userPlan.toLowerCase() === "free");

    // Free 用户或本地会话不返回历史
    if (isFreeUser || conversationId.startsWith("local-")) {
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

  // Free 用户或本地会话不返回历史
  if (plan.isFree || conversationId.startsWith("local-")) {
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
    let missingQuotaTable = false;
    const userPlan =
      (userData.user.user_metadata as any)?.plan ||
      ((userData.user.user_metadata as any)?.pro ? "Pro" : null);
    const planLower = typeof userPlan === "string" ? userPlan.toLowerCase() : "";
    const isFreeUser = !planLower || planLower === "free";
    const isBasicUser = planLower === "basic";

    // Enforce daily quota for Free/Basic users on user messages
    if (role === "user" && (isFreeUser || isBasicUser)) {
      const today = new Date().toISOString().split("T")[0];
      const isBasic = isBasicUser;
      const limit = (() => {
        if (isBasic) {
          return getBasicDailyLimit();
        }
        return getFreeDailyLimit();
      })();

      let used = 0;
      if (isBasic) {
        const { data: quotaRow, error: quotaErr } = await supabase
          .from("basic_quotas")
          .select("used, limit_per_day")
          .eq("user_id", userId)
          .eq("day", today)
          .single();
        if (quotaErr && quotaErr.code !== "PGRST116") {
          console.error("Quota fetch error", quotaErr);
          return new Response("Failed to check quota", { status: 500 });
        }
        used = quotaRow?.used ?? 0;
      } else {
        const { data: quotaRow, error: quotaErr } = await supabase
          .from("free_quotas")
          .select("used, limit_per_day")
          .eq("user_id", userId)
          .eq("day", today)
          .single();
        if (quotaErr && quotaErr.code !== "PGRST116") {
          console.error("Quota fetch error", quotaErr);
          return new Response("Failed to check quota", { status: 500 });
        }
        used = quotaRow?.used ?? 0;
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

      const newUsed = used + 1;
      if (isBasic) {
        const { error: upsertErr } = await supabase.from("basic_quotas").upsert(
          {
            user_id: userId,
            day: today,
            used: newUsed,
            limit_per_day: limit,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,day" },
        );
        if (upsertErr) {
          console.error("Quota upsert error", upsertErr);
          return new Response("Failed to update quota", { status: 500 });
        }
      } else if (!missingQuotaTable) {
        const { error: upsertErr } = await supabase.from("free_quotas").upsert(
          {
            user_id: userId,
            day: today,
            used: newUsed,
            limit_per_day: limit,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,day" },
        );
        if (upsertErr) {
          console.error("Quota upsert error", upsertErr);
          return new Response("Failed to update quota", { status: 500 });
        }
      }

      // Basic 高级多模态媒体配额检查（国际版）
      if (isBasic) {
        const currentModelId = modelId || "qwen3-omni-flash";
        const modelCategory = getModelCategory(currentModelId);
        const hasMedia =
          (mediaPayload.images?.length || 0) > 0 ||
          (mediaPayload.videos?.length || 0) > 0 ||
          (mediaPayload.audios?.length || 0) > 0;
        if (modelCategory === "advanced_multimodal" && hasMedia) {
          const currentMonth = getCurrentYearMonth();
          const imageCount = getImageCount(mediaPayload);
          const videoAudioCount = getVideoAudioCount(mediaPayload);
          const photoLimit = getBasicMonthlyPhotoLimit();
          const videoAudioLimit = getBasicMonthlyVideoAudioLimit();

          const { data: mediaRow, error: mediaErr } = await supabase
            .from("basic_quotas")
            .select("month_used_photo, month_used_video_audio")
            .eq("user_id", userId)
            .eq("month", currentMonth)
            .single();

          if (mediaErr && mediaErr.code !== "PGRST116") {
            console.error("Basic media quota fetch error", mediaErr);
            return new Response("Failed to check media quota", { status: 500 });
          }

          const monthUsedPhoto = mediaRow?.month_used_photo ?? 0;
          const monthUsedVideoAudio = mediaRow?.month_used_video_audio ?? 0;

          if (imageCount > 0 && monthUsedPhoto + imageCount > photoLimit) {
            return new Response(
              JSON.stringify({
                error: getQuotaExceededMessage("monthly_photo", "en"),
                quotaType: "monthly_photo",
                remaining: Math.max(0, photoLimit - monthUsedPhoto),
              }),
              { status: 402, headers: { "Content-Type": "application/json" } },
            );
          }

          if (videoAudioCount > 0 && monthUsedVideoAudio + videoAudioCount > videoAudioLimit) {
            return new Response(
              JSON.stringify({
                error: getQuotaExceededMessage("monthly_video_audio", "en"),
                quotaType: "monthly_video_audio",
                remaining: Math.max(0, videoAudioLimit - monthUsedVideoAudio),
              }),
              { status: 402, headers: { "Content-Type": "application/json" } },
            );
          }

          const { error: mediaUpsertErr } = await supabase.from("basic_quotas").upsert(
            {
              user_id: userId,
              month: currentMonth,
              month_used_photo: monthUsedPhoto + imageCount,
              month_used_video_audio: monthUsedVideoAudio + videoAudioCount,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,month" },
          );
          if (mediaUpsertErr) {
            console.error("Basic media quota upsert error", mediaUpsertErr);
            return new Response("Failed to update media quota", { status: 500 });
          }
        }
      }

    }

    // Free 用户或本地会话不落库消息
    if (isFreeUser || conversationId.startsWith("local-")) {
      return new Response(null, { status: 201 });
    }

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      user_id: userId,
      role,
      content,
      client_id: client_id || null,
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
    }

    // Free 用户或本地会话：不落库，仅返回成功
    if (plan.isFree || conversationId.startsWith("local-")) {
      return new Response(null, { status: 201 });
    }

    const now = new Date().toISOString();
    const addRes = await db.collection("messages").add({
      conversationId,
      userId: user.id,
      role,
      content,
      clientId: client_id || null,
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
