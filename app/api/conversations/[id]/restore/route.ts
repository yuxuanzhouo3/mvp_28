import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { IS_DOMESTIC_VERSION } from "@/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/conversations/[id]/restore - Restore a soft-deleted conversation
export async function POST(
    req: NextRequest,
    { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
    const { id } = await paramsPromise;

    if (IS_DOMESTIC_VERSION) {
        return new Response("Not supported in domestic version", { status: 501 });
    }

    let userId: string;
    let supabase: any;

    // Auth: same pattern as the main [id]/route.ts
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    let customToken = cookieStore.get('custom-jwt-token')?.value;

    if (!customToken) {
        const authHeader = req.headers.get("authorization");
        customToken = authHeader?.replace(/^Bearer\s+/i, "");
    }

    if (customToken) {
        try {
            const jwt = require('jsonwebtoken');
            const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
            const decoded = jwt.verify(customToken, JWT_SECRET) as any;
            userId = decoded.sub;
            supabase = await createServiceRoleClient();
        } catch (error) {
            return new Response("Unauthorized", { status: 401 });
        }
    } else {
        supabase = await createClient();
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
            return new Response("Unauthorized", { status: 401 });
        }
        userId = userData.user.id;
    }

    // Verify the conversation exists and is soft-deleted
    const { data: conv, error: checkError } = await supabase
        .from("conversations")
        .select("id, user_id, deleted_at")
        .eq("id", id)
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .single();

    if (checkError || !conv) {
        return new Response("Not found or not deleted", { status: 404 });
    }

    // Restore: set deleted_at back to null
    const { error } = await supabase
        .from("conversations")
        .update({ deleted_at: null })
        .eq("id", id)
        .eq("user_id", userId);

    if (error) {
        console.error("[RESTORE] ❌ Restore failed:", error);
        return new Response("Failed to restore conversation", { status: 500 });
    }

    console.log(`[RESTORE] ✅ Restored conversation ${id} for user ${userId}`);
    return Response.json({ restored: true });
}
