import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export const dynamic = "force-dynamic";

async function deleteDomesticAccount(req: NextRequest) {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("auth-token")?.value ||
    req.headers.get("x-auth-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = new CloudBaseAuthService();
  const user = await auth.validateToken(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connector = new CloudBaseConnector();
  await connector.initialize();
  const db = connector.getClient();
  const uid = user.id;
  const errors: string[] = [];

  // delete messages
  try {
    const msgs = await db.collection("messages").where({ userId: uid }).get();
    for (const m of msgs?.data || []) {
      await db.collection("messages").doc(m._id).remove();
    }
  } catch (e: any) {
    errors.push(e?.message || "delete messages failed");
  }

  // delete conversations
  try {
    const convs = await db.collection("conversations").where({ userId: uid }).get();
    for (const c of convs?.data || []) {
      await db.collection("conversations").doc(c._id).remove();
    }
  } catch (e: any) {
    errors.push(e?.message || "delete conversations failed");
  }

  // delete sessions
  try {
    const sessions = await db.collection("sessions").where({ userId: uid }).get();
    for (const s of sessions?.data || []) {
      await db.collection("sessions").doc(s._id).remove();
    }
  } catch (e: any) {
    errors.push(e?.message || "delete sessions failed");
  }

  // delete quotas (free/basic)
  try {
    const fq = await db.collection("free_quotas").where({ userId: uid }).get();
    for (const q of fq?.data || []) {
      await db.collection("free_quotas").doc(q._id).remove();
    }
    const bq = await db.collection("basic_quotas").where({ userId: uid }).get();
    for (const q of bq?.data || []) {
      await db.collection("basic_quotas").doc(q._id).remove();
    }
  } catch (e: any) {
    errors.push(e?.message || "delete quotas failed");
  }

  // delete payments & subscriptions
  try {
    const pays = await db.collection("payments").where({ userId: uid }).get();
    for (const p of pays?.data || []) {
      await db.collection("payments").doc(p._id).remove();
    }
    const subs = await db.collection("subscriptions").where({ userId: uid }).get();
    for (const s of subs?.data || []) {
      await db.collection("subscriptions").doc(s._id).remove();
    }
  } catch (e: any) {
    errors.push(e?.message || "delete payments/subscriptions failed");
  }

  // delete user
  try {
    await db.collection("users").doc(uid).remove();
  } catch (e: any) {
    errors.push(e?.message || "delete user failed");
  }

  const res = errors.length
    ? NextResponse.json({ error: "Failed to delete account", details: errors }, { status: 500 })
    : new NextResponse(null, { status: 204 });

  res.cookies.set("auth-token", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return res;
}

async function deleteInternationalAccount() {
  const supabase = await createServerClient();
  const { data: authUser, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        error: "Supabase service key missing",
        hint:
          "Set SUPABASE_SERVICE_ROLE_KEY (service role) in environment variables.",
      },
      { status: 500 }
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userId = authUser.user.id;
  const errors: string[] = [];

  const deleteMessages = await admin.from("messages").delete().eq("user_id", userId);
  if (deleteMessages.error) errors.push(deleteMessages.error.message);

  const deleteConversations = await admin
    .from("conversations")
    .delete()
    .eq("user_id", userId);
  if (deleteConversations.error) errors.push(deleteConversations.error.message);

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
  if (authDeleteError) errors.push(authDeleteError.message);

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Failed to delete account", details: errors },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 204 });
}

export async function DELETE(req: NextRequest) {
  // 版本隔离：仅当部署为国内版时才走 CloudBase，避免 en 环境因残留 auth-token 误删国内数据
  if (IS_DOMESTIC_VERSION) {
    return deleteDomesticAccount(req);
  }
  return deleteInternationalAccount();
}
