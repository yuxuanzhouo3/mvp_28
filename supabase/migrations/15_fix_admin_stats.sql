-- =============================================================================
-- 修复用户数据统计系统 - 补充缺失的表和字段
-- 执行方式：在 Supabase SQL Editor 中运行此脚本
-- =============================================================================

-- =============================================================================
-- 1. 创建 user_analytics 表（如果不存在）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_analytics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'global',
  device_type text,
  os text,
  browser text,
  app_version text,
  screen_resolution text,
  language text,
  country text,
  region text,
  city text,
  ip_address text,
  event_type text NOT NULL DEFAULT 'session_start',
  event_data jsonb DEFAULT '{}'::jsonb,
  session_id text,
  referrer text,
  created_at timestamptz DEFAULT now()
);

-- 添加表注释
COMMENT ON TABLE public.user_analytics IS '用户行为分析表 - 记录用户访问、活动、设备信息';

-- =============================================================================
-- 2. 为现有表添加 source 字段（如果不存在）
-- =============================================================================

-- profiles 表
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN source text DEFAULT 'global';
    COMMENT ON COLUMN public.profiles.source IS '数据来源: global=国际版, cn=国内版';
  END IF;
END $$;

-- payments 表
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN source text DEFAULT 'global';
    COMMENT ON COLUMN public.payments.source IS '数据来源: global=国际版, cn=国内版';
  END IF;
END $$;

-- subscriptions 表
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN source text DEFAULT 'global';
    COMMENT ON COLUMN public.subscriptions.source IS '数据来源: global=国际版, cn=国内版';
  END IF;
END $$;

-- =============================================================================
-- 3. 创建索引（如果不存在）
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_analytics_source_time
ON public.user_analytics(source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_user_time
ON public.user_analytics(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_event_time
ON public.user_analytics(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_device
ON public.user_analytics(device_type, os);

CREATE INDEX IF NOT EXISTS idx_analytics_created_source
ON public.user_analytics(created_at, source);

-- =============================================================================
-- 4. 启用 RLS
-- =============================================================================
ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Users can view own analytics" ON public.user_analytics;
DROP POLICY IF EXISTS "Service role can insert analytics" ON public.user_analytics;
DROP POLICY IF EXISTS "Allow service role full access" ON public.user_analytics;

-- 创建新策略：用户可以查看自己的分析数据
CREATE POLICY "Users can view own analytics"
ON public.user_analytics FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 创建新策略：允许 service_role 完全访问（用于服务端埋点）
-- 注意：service_role 默认绑定 BYPASSRLS，此策略作为显式声明
CREATE POLICY "Allow service role full access"
ON public.user_analytics FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 授予 service_role 完全权限
GRANT ALL ON public.user_analytics TO service_role;

-- =============================================================================
-- 5. 创建或替换统计函数
-- =============================================================================
CREATE OR REPLACE FUNCTION get_admin_stats(
  p_source text DEFAULT 'all',
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_start date;
  v_end date;
BEGIN
  v_start := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  v_end := COALESCE(p_end_date, CURRENT_DATE);

  SELECT jsonb_build_object(
    'users', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'new_today', COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE),
        'new_this_week', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
        'new_this_month', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')
      )
      FROM public.profiles
      WHERE (p_source = 'all' OR COALESCE(source, 'global') = p_source)
    ),
    'payments', (
      SELECT jsonb_build_object(
        'total_amount', COALESCE(SUM(amount), 0),
        'total_count', COUNT(*),
        'paying_users', COUNT(DISTINCT user_id),
        'today_amount', COALESCE(SUM(amount) FILTER (WHERE DATE(created_at) = CURRENT_DATE), 0),
        'this_month_amount', COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'), 0)
      )
      FROM public.payments
      WHERE (LOWER(status) = 'success' OR LOWER(status) = 'completed')
        AND (p_source = 'all' OR COALESCE(source, 'global') = p_source)
    ),
    'subscriptions', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE status = 'active'),
        'by_plan', COALESCE((
          SELECT jsonb_object_agg(plan, cnt)
          FROM (
            SELECT plan, COUNT(*) as cnt
            FROM public.subscriptions
            WHERE (p_source = 'all' OR COALESCE(source, 'global') = p_source)
            GROUP BY plan
          ) sub
        ), '{}'::jsonb)
      )
      FROM public.subscriptions
      WHERE (p_source = 'all' OR COALESCE(source, 'global') = p_source)
    ),
    'active_users', (
      SELECT jsonb_build_object(
        'dau', COUNT(DISTINCT user_id) FILTER (WHERE DATE(created_at) = CURRENT_DATE),
        'wau', COUNT(DISTINCT user_id) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
        'mau', COUNT(DISTINCT user_id) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')
      )
      FROM public.user_analytics
      WHERE (p_source = 'all' OR COALESCE(source, 'global') = p_source)
    ),
    'devices', (
      SELECT jsonb_build_object(
        'by_type', COALESCE((
          SELECT jsonb_object_agg(device_type, cnt)
          FROM (
            SELECT COALESCE(device_type, 'unknown') as device_type, COUNT(DISTINCT user_id) as cnt
            FROM public.user_analytics
            WHERE (p_source = 'all' OR COALESCE(source, 'global') = p_source)
              AND created_at >= v_start AND created_at <= v_end
            GROUP BY device_type
          ) sub
        ), '{}'::jsonb),
        'by_os', COALESCE((
          SELECT jsonb_object_agg(os, cnt)
          FROM (
            SELECT COALESCE(os, 'unknown') as os, COUNT(DISTINCT user_id) as cnt
            FROM public.user_analytics
            WHERE (p_source = 'all' OR COALESCE(source, 'global') = p_source)
              AND created_at >= v_start AND created_at <= v_end
            GROUP BY os
          ) sub
        ), '{}'::jsonb)
      )
    ),
    'query_params', jsonb_build_object(
      'source', p_source,
      'start_date', v_start,
      'end_date', v_end,
      'generated_at', now()
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. 授权
-- =============================================================================
GRANT ALL PRIVILEGES ON public.user_analytics TO postgres, service_role;
GRANT EXECUTE ON FUNCTION get_admin_stats TO service_role;

-- 撤销普通用户对统计函数的执行权限
REVOKE EXECUTE ON FUNCTION get_admin_stats FROM anon, authenticated;

-- =============================================================================
-- 完成提示
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ 数据统计系统修复完成！';
  RAISE NOTICE '- user_analytics 表已创建/更新';
  RAISE NOTICE '- profiles/payments/subscriptions 表已添加 source 字段';
  RAISE NOTICE '- get_admin_stats 函数已创建/更新';
END $$;
