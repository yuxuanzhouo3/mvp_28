import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 单例模式：缓存客户端实例，避免重复创建
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  // 如果已经有实例，直接返回
  if (supabaseInstance) {
    return supabaseInstance;
  }

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  // 创建客户端
  // 使用 implicit 流程避免 PKCE code_verifier 存储问题
  // implicit 流程直接在 URL hash 中返回 tokens，不需要 code_verifier
  supabaseInstance = createBrowserClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "implicit", // 使用隐式流程，直接获取 tokens
    },
  });

  return supabaseInstance;
}

/**
 * 重置客户端实例（用于调试/清理）
 */
export function resetClient() {
  supabaseInstance = null;
}
