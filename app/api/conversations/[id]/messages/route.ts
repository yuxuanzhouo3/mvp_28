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
  const { role, content, client_id, tokens } = await req.json();

  if (!isDomesticRequest(req)) {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response("Unauthorized", { status: 401 });
    }
    const userId = userData.user.id;

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

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  try {
    const now = new Date().toISOString();
    const addRes = await db.collection("messages").add({
      conversationId,
      userId: user.id,
      role,
      content,
      clientId: client_id || null,
      tokens: tokens || null,
      createdAt: now,
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
