import { createClient } from "@/lib/supabase/server";
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

function isDomesticRequest() {
  return IS_DOMESTIC_VERSION;
}

// Delete a conversation (cascade messages)
export async function DELETE(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const { id } = await paramsPromise;

  if (!isDomesticRequest()) {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response("Unauthorized", { status: 401 });
    }
    const userId = userData.user.id;

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Delete conversation error", error);
      return new Response("Failed to delete conversation", { status: 500 });
    }

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

    await db.collection("conversations").doc(id).remove();
    // cascade delete messages
    const msgs = await db
      .collection("messages")
      .where({ conversationId: id })
      .get();
    for (const m of msgs.data || []) {
      await db.collection("messages").doc(m._id).remove();
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("CloudBase delete conversation error", error);
    return new Response("Failed to delete conversation", { status: 500 });
  }
}
