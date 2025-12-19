// lib/supabase/env.ts - Supabase 服务端环境变量读取（兼容国内版运行时注入）

function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return undefined;
}

/**
 * Supabase URL（服务端优先）
 *
 * 说明：
 * - `NEXT_PUBLIC_...` 变量在 Next.js 中通常会在构建期被内联，容器运行时再注入可能无效。
 * - 后台/Server Actions 等服务端逻辑优先读取非 NEXT_PUBLIC 的 `SUPABASE_URL`，以支持国内版部署的运行时注入。
 */
export function getSupabaseUrlFromEnv(): string | undefined {
  return firstNonEmpty(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/**
 * Supabase Anon/Publishable Key
 *
 * - 客户端（浏览器）必须使用 `NEXT_PUBLIC_...`
 * - 服务端可兼容 `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY`，便于不同平台注入
 */
export function getSupabaseAnonKeyFromEnv(): string | undefined {
  return firstNonEmpty(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY
  );
}

/**
 * Supabase Service Role Key（服务端）
 *
 * 兼容多种常见命名，避免不同平台/历史配置导致后台能力不可用。
 */
export function getSupabaseServiceRoleKeyFromEnv(): string | undefined {
  return firstNonEmpty(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_KEY,
    process.env.SERVICE_ROLE_KEY,
    process.env.SUPABASE_SECRET_KEY
  );
}
