import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getDomesticUser(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return null;
  const auth = new CloudBaseAuthService();
  return await auth.validateToken(token);
}

function isDomesticRequest(req: NextRequest) {
  const langIsZh = IS_DOMESTIC_VERSION;
  const hasCloudToken = !!req.cookies.get("auth-token");
  return langIsZh || hasCloudToken;
}

const getDailyLimit = () => {
  const raw = process.env.NEXT_PUBLIC_FREE_DAILY_LIMIT || "10";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(1000, n);
};

const getMonthlyLimit = () => {
  const raw = process.env.NEXT_PUBLIC_BASIC_MONTHLY_LIMIT || "100";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(100000, n);
};

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

    console.log(
      "[cloudbase] messages list size",
      records.length || 0,
      "for",
      user.id,
      "conv",
      conversationId,
    );

    const list = (records || [])
      .map((m: any) => ({
        id: m._id,
        role: m.role,
        content: m.content,
        created_at: m.createdAt,
        imageFileIds: m.imageFileIds || [],
        videoFileIds: m.videoFileIds || [],
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
  const { role, content, client_id, tokens, images, imageFileIds, videos, videoFileIds } = reqBody;

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

    // Enforce daily quota only for Free users and only on user messages
    if (role === "user" && (isFreeUser || isBasicUser)) {
      const today = new Date().toISOString().split("T")[0];
      const isBasic = isBasicUser;
      const limit = (() => {
        if (isBasic) {
          const raw = process.env.NEXT_PUBLIC_BASIC_MONTHLY_LIMIT || "100";
          const n = parseInt(raw, 10);
          if (!Number.isFinite(n) || n <= 0) return 100;
          return Math.min(100000, n);
        }
        const raw = process.env.NEXT_PUBLIC_FREE_DAILY_LIMIT || "10";
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n) || n <= 0) return 10;
        return Math.min(1000, n);
      })();

      let used = 0;
      if (isBasic) {
        const monthStart = new Date(today);
        monthStart.setDate(1);
        const monthStr = monthStart.toISOString().split("T")[0];
        const { data: quotaRow, error: quotaErr } = await supabase
          .from("basic_quotas")
          .select("used, limit_per_month")
          .eq("user_id", userId)
          .eq("month", monthStr)
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
        const monthStart = new Date(today);
        monthStart.setDate(1);
        const monthStr = monthStart.toISOString().split("T")[0];
        const { error: upsertErr } = await supabase.from("basic_quotas").upsert(
          {
            user_id: userId,
            month: monthStr,
            used: newUsed,
            limit_per_month: limit,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,month" },
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
    // Quota enforcement for Free/Basic users on user messages
    if (role === "user" && (plan.isFree || plan.isBasic)) {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const monthStart = new Date(todayStr);
      monthStart.setDate(1);
      const monthStr = monthStart.toISOString().split("T")[0];

      const limit = plan.isBasic ? getMonthlyLimit() : getDailyLimit();
      const collectionName = plan.isBasic ? "basic_quotas" : "free_quotas";
      const periodField = plan.isBasic ? "month" : "day";
      const periodValue = plan.isBasic ? monthStr : todayStr;

      const quotaColl = db.collection(collectionName);
      const existing = await quotaColl
        .where({ userId: user.id, [periodField]: periodValue })
        .limit(1)
        .get();
      const quotaRow = existing?.data?.[0];
      const used = quotaRow?.used ?? 0;

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
      const payload: any = {
        userId: user.id,
        [periodField]: periodValue,
        used: newUsed,
        updatedAt: now.toISOString(),
      };
      if (plan.isBasic) {
        payload.limit_per_month = limit;
      } else {
        payload.limit_per_day = limit;
      }

      console.log(
        "[cloudbase] quota before update",
        plan.isBasic ? "basic" : "free",
        "user",
        user.id,
        "period",
        periodValue,
        "used",
        used,
        "limit",
        limit,
      );

      if (quotaRow?._id) {
        await quotaColl.doc(quotaRow._id).update(payload);
      } else {
        await quotaColl.add(payload);
      }

      console.log(
        "[cloudbase] quota update",
        plan.isBasic ? "basic" : "free",
        "user",
        user.id,
        "period",
        periodValue,
        "used",
        newUsed,
        "limit",
        limit,
      );
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
      imageFileIds: Array.isArray(images)
        ? images
        : Array.isArray(imageFileIds)
          ? imageFileIds
          : [],
      videoFileIds: Array.isArray(videos)
        ? videos
        : Array.isArray(videoFileIds)
          ? videoFileIds
          : [],
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


