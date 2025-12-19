// lib/integrations/supabase-admin.ts - Supabase Admin Client (使用 Service Role Key)
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleKeyFromEnv,
  getSupabaseUrlFromEnv,
} from "@/lib/supabase/env";

const supabaseUrl = getSupabaseUrlFromEnv();
const supabaseServiceRoleKey = getSupabaseServiceRoleKeyFromEnv();

/**
 * Supabase Admin Client - 使用 Service Role Key
 * 用于 Webhook 和后台任务，绕过 RLS
 *
 * 注意：在国内版构建时，Supabase 环境变量可能不存在，此时返回 null
 */
let supabaseAdmin: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
} else {
  console.warn(
    "[supabaseAdmin] Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY; admin operations will fail."
  );
}

export { supabaseAdmin };
