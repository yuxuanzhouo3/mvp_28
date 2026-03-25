import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { IS_DOMESTIC_VERSION } from "@/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/conversations/trash - List soft-deleted conversations
export async function GET(req: NextRequest) {
    if (IS_DOMESTIC_VERSION) {
        return Response.json({ conversations: [] });
    }

    let userId: string;
    let supabase: any;

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

    const { data, error } = await supabase
        .from("conversations")
        .select("id, title, model, created_at, updated_at, deleted_at, model_type")
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

    if (error) {
        console.error("[TRASH] List error:", error);
        return new Response("Failed to list deleted conversations", { status: 500 });
    }

    const list = (data ?? []).map((c: any) => ({
        id: c.id,
        title: c.title,
        model: c.model,
        created_at: c.created_at,
        deleted_at: c.deleted_at,
        modelType: c.model_type || null,
    }));

    return Response.json({ conversations: list });
}

// DELETE /api/conversations/trash - Empty trash (permanently delete all)
export async function DELETE(req: NextRequest) {
    if (IS_DOMESTIC_VERSION) {
        return new Response("Not supported", { status: 501 });
    }

    let userId: string;
    let supabase: any;

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

    // Get all soft-deleted conversation IDs
    const { data: deletedConvs } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", userId)
        .not("deleted_at", "is", null);

    if (deletedConvs && deletedConvs.length > 0) {
        const ids = deletedConvs.map((c: any) => c.id);
        // Delete messages first
        await supabase.from("messages").delete().in("conversation_id", ids);
        // Then delete conversations
        await supabase.from("conversations").delete().in("id", ids);
    }

    return Response.json({ success: true, deleted: deletedConvs?.length || 0 });
}
