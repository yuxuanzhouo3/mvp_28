"use server";

/**
 * Admin User Management Server Actions
 * Provides user listing, search, and ban/unban functionality for the admin panel
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAdminSession } from "@/utils/session";

export interface AdminUser {
    id: string;
    email: string | null;
    display_name: string | null;
    avatar_url: string | null;
    plan: string | null;
    is_paid: boolean;
    created_at: string;
    last_login_at: string | null;
    is_banned: boolean;
    conversations_count?: number;
}

export interface UserListResult {
    success: boolean;
    error?: string;
    data?: {
        users: AdminUser[];
        total: number;
        page: number;
        pageSize: number;
    };
}

export async function getAdminUsers(
    page: number = 1,
    pageSize: number = 20,
    search: string = "",
    filter: "all" | "paid" | "free" | "banned" = "all"
): Promise<UserListResult> {
    const session = await getAdminSession();
    if (!session) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        if (!supabaseAdmin) {
            return { success: false, error: "Supabase admin not configured" };
        }

        const offset = (page - 1) * pageSize;

        // Build query
        let query = supabaseAdmin
            .from("profiles")
            .select("*", { count: "exact" });

        // Apply search
        if (search.trim()) {
            query = query.or(
                `email.ilike.%${search}%,display_name.ilike.%${search}%`
            );
        }

        // Apply filter
        switch (filter) {
            case "paid":
                query = query.eq("is_paid", true);
                break;
            case "free":
                query = query.eq("is_paid", false);
                break;
            case "banned":
                query = query.eq("is_banned", true);
                break;
        }

        // Apply pagination and order
        const { data: users, count, error } = await query
            .order("created_at", { ascending: false })
            .range(offset, offset + pageSize - 1);

        if (error) {
            console.error("[ADMIN_USERS] Query error:", error);
            return { success: false, error: error.message };
        }

        return {
            success: true,
            data: {
                users: (users || []).map((u: any) => ({
                    id: u.id,
                    email: u.email || null,
                    display_name: u.display_name || u.nickname || null,
                    avatar_url: u.avatar_url || null,
                    plan: u.plan || "free",
                    is_paid: u.is_paid === true,
                    created_at: u.created_at,
                    last_login_at: u.last_login_at || null,
                    is_banned: u.is_banned === true,
                })),
                total: count || 0,
                page,
                pageSize,
            },
        };
    } catch (err: any) {
        console.error("[ADMIN_USERS] Error:", err);
        return { success: false, error: err.message || "Unknown error" };
    }
}

export async function toggleUserBan(
    userId: string,
    ban: boolean
): Promise<{ success: boolean; error?: string }> {
    const session = await getAdminSession();
    if (!session) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        if (!supabaseAdmin) {
            return { success: false, error: "Supabase admin not configured" };
        }

        const { error } = await supabaseAdmin
            .from("profiles")
            .update({ is_banned: ban })
            .eq("id", userId);

        if (error) {
            console.error("[ADMIN_USERS] Ban toggle error:", error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message || "Unknown error" };
    }
}
