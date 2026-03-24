import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getDomesticUser(req: NextRequest) {
  const cookieToken = req.cookies.get("auth-token")?.value;
  const headerToken =
    req.headers.get("x-auth-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    null;
  const token = cookieToken || headerToken || null;
  if (!token) return null;
  const auth = new CloudBaseAuthService();
  return await auth.validateToken(token);
}

function isDomesticRequest(req: NextRequest) {
  // 版本隔离：仅根据部署环境决定（避免 en 环境因残留 auth-token 误访问国内数据）
  return IS_DOMESTIC_VERSION;
}

// Delete a conversation (cascade messages)
export async function DELETE(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const { id } = await paramsPromise;

  if (!isDomesticRequest(req)) {
    let userId: string;
    let supabase: any;

    // 优先从 cookie 中读取自定义 JWT token，如果没有再从 Authorization header 读取
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    let customToken = cookieStore.get('custom-jwt-token')?.value;

    if (!customToken) {
      // 如果 cookie 中没有，尝试从 Authorization header 读取
      const authHeader = req.headers.get("authorization");
      customToken = authHeader?.replace(/^Bearer\s+/i, "");
    }

    if (customToken) {
      // 使用自定义 JWT 认证（Android Native Google Sign-In）
      try {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
        const decoded = jwt.verify(customToken, JWT_SECRET) as any;
        userId = decoded.sub;
        console.log('[DELETE] ✅ Using custom JWT auth for user:', userId);
        console.log('[DELETE] 🔑 Token source:', cookieStore.get('custom-jwt-token')?.value ? 'cookie' : 'header');
        // 使用 service role 客户端绕过 RLS 策略
        supabase = await createServiceRoleClient();
        console.log('[DELETE] 🔧 Using service role client to bypass RLS');
      } catch (error) {
        console.error('[DELETE] ❌ Custom JWT verification failed:', error);
        return new Response("Unauthorized", { status: 401 });
      }
    } else {
      // 使用 Supabase 认证
      console.log('[DELETE] 🔵 Using Supabase authentication');
      supabase = await createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.error('[DELETE] ❌ Supabase auth failed:', userError);
        return new Response("Unauthorized", { status: 401 });
      }
      userId = userData.user.id;
      console.log('[DELETE] ✅ Supabase auth success for user:', userId);
    }

    console.log(`[DELETE] 🔍 Verifying conversation ${id} belongs to user ${userId}`);

    // 先验证对话是否存在且属于当前用户
    const { data: existingConv, error: checkError } = await supabase
      .from("conversations")
      .select("id, user_id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (checkError || !existingConv) {
      console.error(`[DELETE] ❌ Conversation not found. Error:`, checkError);
      console.error(`[DELETE] ❌ Query params: id=${id}, user_id=${userId}`);
      return new Response("Not found", { status: 404 });
    }

    console.log(`[DELETE] ✅ Conversation verified:`, existingConv);

    // 确认存在后再删除
    console.log(`[DELETE] 🗑️ Deleting conversation ${id} for user ${userId}`);

    const { error, count } = await supabase
      .from("conversations")
      .delete({ count: 'exact' })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("[DELETE] ❌ Delete failed:", error);
      return new Response("Failed to delete conversation", { status: 500 });
    }

    console.log(`[DELETE] ✅ Successfully deleted! Affected rows: ${count}`);
    return new Response(null, { status: 204 });
  }

  // domestic -> CloudBase
  const user = await getDomesticUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  try {
    // ensure ownership
    const conv = await db.collection("conversations").doc(id).get();
    const data = conv.data?.[0];
    if (!data || data.userId !== user.id) {
      return new Response("Not found", { status: 404 });
    }

    // collect media fileIds for cleanup
    const msgs = await db.collection("messages").where({ conversationId: id }).get();
    const fileIds: string[] = Array.from(
      new Set(
        (msgs.data || []).flatMap((m: any) => [
          ...(m.imageFileIds || []),
          ...(m.videoFileIds || []),
          ...(m.audioFileIds || []),
        ]),
      ),
    ).filter((v: any): v is string => typeof v === "string" && v);

    await db.collection("conversations").doc(id).remove();
    // cascade delete messages
    for (const m of msgs.data || []) {
      await db.collection("messages").doc(m._id).remove();
    }

    // delete files quietly
    if (fileIds.length) {
      try {
        const app = connector.getApp();
        await app.deleteFile({ fileList: fileIds });
      } catch (err) {
        console.warn("[conversation delete] delete file skipped", err);
      }
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("CloudBase delete conversation error", error);
    return new Response("Failed to delete conversation", { status: 500 });
  }
}

// Update conversation title
export async function PATCH(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const { id } = await paramsPromise;
  const { title } = await req.json();

  if (!title || typeof title !== "string") {
    return new Response("Title required", { status: 400 });
  }

  if (!isDomesticRequest(req)) {
    let userId: string;
    let supabase: any;

    // 优先从 cookie 中读取自定义 JWT token，如果没有再从 Authorization header 读取
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    let customToken = cookieStore.get('custom-jwt-token')?.value;

    if (!customToken) {
      // 如果 cookie 中没有，尝试从 Authorization header 读取
      const authHeader = req.headers.get("authorization");
      customToken = authHeader?.replace(/^Bearer\s+/i, "");
    }

    if (customToken) {
      // 使用自定义 JWT 认证（Android Native Google Sign-In）
      try {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
        const decoded = jwt.verify(customToken, JWT_SECRET) as any;
        userId = decoded.sub;
        console.log('[conversation] Using custom JWT auth for user:', userId);
        // 使用 service role 客户端绕过 RLS 策略
        supabase = await createServiceRoleClient();
      } catch (error) {
        console.error('[conversation] Custom JWT verification failed:', error);
        return new Response("Unauthorized", { status: 401 });
      }
    } else {
      // 使用 Supabase 认证
      supabase = await createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        return new Response("Unauthorized", { status: 401 });
      }
      userId = userData.user.id;
    }

    // 先验证对话是否存在且属于当前用户
    const { data: existingConv, error: checkError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (checkError || !existingConv) {
      console.error("Conversation not found or unauthorized", checkError);
      return new Response("Not found", { status: 404 });
    }

    // 确认存在后再更新
    const { error } = await supabase
      .from("conversations")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Update conversation title error", error);
      return new Response("Failed to update", { status: 500 });
    }

    console.log(`[conversation] Successfully updated title for conversation ${id} for user ${userId}`);
    return Response.json({ success: true });
  }

  const user = await getDomesticUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();

  try {
    const conv = await db.collection("conversations").doc(id).get();
    const data = conv.data?.[0];
    if (!data || data.userId !== user.id) {
      return new Response("Not found", { status: 404 });
    }

    await db.collection("conversations").doc(id).update({
      title,
      updatedAt: new Date().toISOString(),
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("CloudBase update conversation error", error);
    return new Response("Failed to update", { status: 500 });
  }
}
