export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export const dynamic = "force-dynamic";

interface DeleteDataRequest {
  conversations?: boolean;
  messages?: boolean;
  bookmarks?: boolean;
  settings?: boolean;
}

async function deleteDomesticUserData(req: NextRequest, options: DeleteDataRequest) {
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
  const deleted: string[] = [];
  const errors: string[] = [];

  // Delete messages
  if (options.messages) {
    try {
      const msgs = await db.collection("messages").where({ userId: uid }).get();
      for (const m of msgs?.data || []) {
        await db.collection("messages").doc(m._id).remove();
      }
      deleted.push("messages");
    } catch (e: any) {
      errors.push(`messages: ${e?.message || "failed"}`);
    }
  }

  // Delete conversations
  if (options.conversations) {
    try {
      const convs = await db.collection("conversations").where({ userId: uid }).get();
      for (const c of convs?.data || []) {
        await db.collection("conversations").doc(c._id).remove();
      }
      deleted.push("conversations");
    } catch (e: any) {
      errors.push(`conversations: ${e?.message || "failed"}`);
    }
  }

  // Delete sessions (bookmarks)
  if (options.bookmarks) {
    try {
      const sessions = await db.collection("sessions").where({ userId: uid }).get();
      for (const s of sessions?.data || []) {
        await db.collection("sessions").doc(s._id).remove();
      }
      deleted.push("bookmarks");
    } catch (e: any) {
      errors.push(`bookmarks: ${e?.message || "failed"}`);
    }
  }

  // Reset user settings
  if (options.settings) {
    try {
      await db.collection("users").doc(uid).update({
        settings: {},
        updatedAt: new Date().toISOString(),
      });
      deleted.push("settings");
    } catch (e: any) {
      errors.push(`settings: ${e?.message || "failed"}`);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { deleted, errors, message: "Some data could not be deleted" },
      { status: 207 }
    );
  }

  return NextResponse.json({ deleted, message: "Data deleted successfully" });
}

async function deleteInternationalUserData(options: DeleteDataRequest) {
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
      { error: "Supabase service key missing" },
      { status: 500 }
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userId = authUser.user.id;
  const deleted: string[] = [];
  const errors: string[] = [];

  // Delete messages
  if (options.messages) {
    const result = await admin.from("messages").delete().eq("user_id", userId);
    if (result.error) {
      errors.push(`messages: ${result.error.message}`);
    } else {
      deleted.push("messages");
    }
  }

  // Delete conversations
  if (options.conversations) {
    const result = await admin.from("conversations").delete().eq("user_id", userId);
    if (result.error) {
      errors.push(`conversations: ${result.error.message}`);
    } else {
      deleted.push("conversations");
    }
  }

  // Delete bookmarks (if table exists)
  if (options.bookmarks) {
    try {
      const result = await admin.from("bookmarks").delete().eq("user_id", userId);
      if (result.error && !result.error.message.includes("does not exist")) {
        errors.push(`bookmarks: ${result.error.message}`);
      } else {
        deleted.push("bookmarks");
      }
    } catch {
      deleted.push("bookmarks"); // Table might not exist, consider it deleted
    }
  }

  // Reset user settings in user_metadata
  if (options.settings) {
    const result = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { settings: {} },
    });
    if (result.error) {
      errors.push(`settings: ${result.error.message}`);
    } else {
      deleted.push("settings");
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { deleted, errors, message: "Some data could not be deleted" },
      { status: 207 }
    );
  }

  return NextResponse.json({ deleted, message: "Data deleted successfully" });
}

export async function POST(req: NextRequest) {
  try {
    const body: DeleteDataRequest = await req.json();

    // Validate that at least one option is selected
    if (!body.conversations && !body.messages && !body.bookmarks && !body.settings) {
      return NextResponse.json(
        { error: "Please select at least one data type to delete" },
        { status: 400 }
      );
    }

    if (IS_DOMESTIC_VERSION) {
      return deleteDomesticUserData(req, body);
    }
    return deleteInternationalUserData(body);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
