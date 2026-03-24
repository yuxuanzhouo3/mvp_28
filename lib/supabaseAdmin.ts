import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleKeyFromEnv,
  getSupabaseUrlFromEnv,
} from "@/lib/supabase/env";

const url = getSupabaseUrlFromEnv();
const serviceKey = getSupabaseServiceRoleKeyFromEnv();

if (!url || !serviceKey) {
  console.warn(
    "[supabaseAdmin] Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY; admin operations will fail.",
  );
}

export const supabaseAdmin =
  url && serviceKey
    ? createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;
