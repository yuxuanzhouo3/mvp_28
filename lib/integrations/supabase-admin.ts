// lib/integrations/supabase-admin.ts - Supabase Admin Client (使用 Service Role Key)
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    "Missing Supabase admin environment variables. Some features may not work."
  );
}

/**
 * Supabase Admin Client - 使用 Service Role Key
 * 用于 Webhook 和后台任务，绕过 RLS
 */
export const supabaseAdmin = createClient(
  supabaseUrl || "",
  supabaseServiceRoleKey || "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
