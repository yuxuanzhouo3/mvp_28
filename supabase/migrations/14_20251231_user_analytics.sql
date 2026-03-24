-- =============================================================================
-- 用户数据统计系统 - 迁移脚本
-- 功能：用户行为分析、设备追踪、国内外数据区分
-- =============================================================================

-- =============================================================================
-- 1. 创建用户分析表 (user_analytics)
-- 记录用户访问、活动、设备信息等
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_analytics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,

  -- 来源标识 (区分国内外版本)
  source text NOT NULL DEFAULT 'global',  -- 'global' = 国际版, 'cn' = 国内版

  -- 设备信息
  device_type text,                       -- 'desktop', 'mobile', 'tablet'
  os text,                                -- 'Windows', 'macOS', 'iOS', 'Android', 'Linux'
  browser text,                           -- 'Chrome', 'Safari', 'Firefox', 'Edge', 'App'
  app_version text,                       -- 客户端版本号 '1.2.0'
  screen_resolution text,                 -- 屏幕分辨率 '1920x1080'
  language text,                          -- 浏览器语言 'zh-CN', 'en-US'

  -- 地理信息
  country text,                           -- 国家代码 'CN', 'US'
  region text,                            -- 地区/省份
  city text,                              -- 城市
  ip_address text,                        -- IP地址 (可选，注意隐私)

  -- 活动信息
  event_type text NOT NULL,               -- 事件类型
  -- 'session_start'    - 会话开始
  -- 'session_end'      - 会话结束
  -- 'page_view'        - 页面访问
  -- 'feature_use'      - 功能使用
  -- 'payment'          - 支付行为
  -- 'subscription'     - 订阅变更
  -- 'error'            - 错误上报

  event_data jsonb DEFAULT '{}'::jsonb,   -- 事件详细数据
  session_id text,                        -- 会话ID (用于关联同一次访问)
  referrer text,                          -- 来源页面

  -- 时间戳
  created_at timestamptz DEFAULT now()
);

-- 添加表注释
COMMENT ON TABLE public.user_analytics IS '用户行为分析表 - 记录用户访问、活动、设备信息';
COMMENT ON COLUMN public.user_analytics.source IS '数据来源: global=国际版, cn=国内版';
COMMENT ON COLUMN public.user_analytics.event_type IS '事件类型: session_start/session_end/page_view/feature_use/payment/subscription/error';

-- =============================================================================
-- 2. 创建索引 (优化查询性能)
-- =============================================================================
-- 按来源和时间查询 (国内外数据分开统计)
CREATE INDEX IF NOT EXISTS idx_analytics_source_time
ON public.user_analytics(source, created_at DESC);

-- 按用户查询 (查看单个用户行为)
CREATE INDEX IF NOT EXISTS idx_analytics_user_time
ON public.user_analytics(user_id, created_at DESC);

-- 按事件类型查询 (统计各类事件)
CREATE INDEX IF NOT EXISTS idx_analytics_event_time
ON public.user_analytics(event_type, created_at DESC);

-- 按设备类型查询 (设备分布统计)
CREATE INDEX IF NOT EXISTS idx_analytics_device
ON public.user_analytics(device_type, os);

-- 按时间范围查询 (日报/周报/月报) - 使用 created_at 直接索引
-- 注意: 不使用 DATE() 函数索引，因为 timestamptz 上的 DATE() 不是 IMMUTABLE
CREATE INDEX IF NOT EXISTS idx_analytics_created_source
ON public.user_analytics(created_at, source);

-- =============================================================================
-- 3. 启用 RLS (行级安全策略)
-- =============================================================================
ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的分析数据
CREATE POLICY "Users can view own analytics"
ON public.user_analytics FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Service Role (后台管理) 拥有完全访问权限
-- 注意：service_role 默认绑定 BYPASSRLS，此策略作为显式声明
CREATE POLICY "Allow service role full access"
ON public.user_analytics FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- 4. 为现有表添加 source 字段 (区分数据来源)
-- =============================================================================

-- 4.1 payments 表添加 source 字段
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS source text DEFAULT 'global';

COMMENT ON COLUMN public.payments.source IS '数据来源: global=国际版, cn=国内版';

-- 4.2 subscriptions 表添加 source 字段
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS source text DEFAULT 'global';

COMMENT ON COLUMN public.subscriptions.source IS '数据来源: global=国际版, cn=国内版';

-- 4.3 profiles 表添加 source 字段
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS source text DEFAULT 'global';

COMMENT ON COLUMN public.profiles.source IS '数据来源: global=国际版, cn=国内版';

-- =============================================================================
-- 5. 创建统计视图 (方便后台查询)
-- =============================================================================

-- 5.1 每日用户统计视图
CREATE OR REPLACE VIEW public.v_daily_user_stats AS
SELECT
  DATE(created_at) as stat_date,
  source,
  COUNT(DISTINCT user_id) as active_users,
  COUNT(*) FILTER (WHERE event_type = 'session_start') as sessions,
  COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
  COUNT(*) FILTER (WHERE event_type = 'feature_use') as feature_uses
FROM public.user_analytics
GROUP BY DATE(created_at), source
ORDER BY stat_date DESC;

-- 5.2 设备分布统计视图
CREATE OR REPLACE VIEW public.v_device_stats AS
SELECT
  source,
  device_type,
  os,
  browser,
  COUNT(DISTINCT user_id) as user_count,
  COUNT(*) as event_count
FROM public.user_analytics
WHERE device_type IS NOT NULL
GROUP BY source, device_type, os, browser
ORDER BY user_count DESC;

-- 5.3 付费统计视图 (按来源分组)
CREATE OR REPLACE VIEW public.v_payment_stats AS
SELECT
  source,
  DATE(created_at) as stat_date,
  COUNT(*) as payment_count,
  COUNT(DISTINCT user_id) as paying_users,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  currency
FROM public.payments
WHERE status = 'success' OR status = 'completed'
GROUP BY source, DATE(created_at), currency
ORDER BY stat_date DESC;

-- =============================================================================
-- 6. 创建汇总统计函数 (RPC 调用)
-- =============================================================================

-- 获取整体统计数据
CREATE OR REPLACE FUNCTION get_admin_stats(
  p_source text DEFAULT 'all',           -- 'all', 'global', 'cn'
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_start date;
  v_end date;
BEGIN
  -- 默认统计最近30天
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
      WHERE (p_source = 'all' OR source = p_source)
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
      WHERE (status = 'success' OR status = 'completed')
        AND (p_source = 'all' OR source = p_source)
    ),
    'subscriptions', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE status = 'active'),
        'by_plan', (
          SELECT jsonb_object_agg(plan, cnt)
          FROM (
            SELECT plan, COUNT(*) as cnt
            FROM public.subscriptions
            WHERE (p_source = 'all' OR source = p_source)
            GROUP BY plan
          ) sub
        )
      )
      FROM public.subscriptions
      WHERE (p_source = 'all' OR source = p_source)
    ),
    'active_users', (
      SELECT jsonb_build_object(
        'dau', COUNT(DISTINCT user_id) FILTER (WHERE DATE(created_at) = CURRENT_DATE),
        'wau', COUNT(DISTINCT user_id) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
        'mau', COUNT(DISTINCT user_id) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')
      )
      FROM public.user_analytics
      WHERE (p_source = 'all' OR source = p_source)
    ),
    'devices', (
      SELECT jsonb_build_object(
        'by_type', (
          SELECT jsonb_object_agg(device_type, cnt)
          FROM (
            SELECT COALESCE(device_type, 'unknown') as device_type, COUNT(DISTINCT user_id) as cnt
            FROM public.user_analytics
            WHERE (p_source = 'all' OR source = p_source)
              AND created_at >= v_start AND created_at <= v_end
            GROUP BY device_type
          ) sub
        ),
        'by_os', (
          SELECT jsonb_object_agg(os, cnt)
          FROM (
            SELECT COALESCE(os, 'unknown') as os, COUNT(DISTINCT user_id) as cnt
            FROM public.user_analytics
            WHERE (p_source = 'all' OR source = p_source)
              AND created_at >= v_start AND created_at <= v_end
            GROUP BY os
          ) sub
        )
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
-- 7. 视图安全设置 (防止普通用户访问后台统计)
-- =============================================================================

-- 7.1 撤销 anon 和 authenticated 对视图的默认访问权限
REVOKE ALL ON public.v_daily_user_stats FROM anon, authenticated;
REVOKE ALL ON public.v_device_stats FROM anon, authenticated;
REVOKE ALL ON public.v_payment_stats FROM anon, authenticated;

-- 7.2 只授权给 postgres 和 service_role (后台管理使用)
GRANT ALL PRIVILEGES ON public.user_analytics TO postgres, service_role;
GRANT SELECT ON public.v_daily_user_stats TO postgres, service_role;
GRANT SELECT ON public.v_device_stats TO postgres, service_role;
GRANT SELECT ON public.v_payment_stats TO postgres, service_role;
GRANT EXECUTE ON FUNCTION get_admin_stats TO service_role;

-- 7.3 撤销 anon/authenticated 对统计函数的执行权限
REVOKE EXECUTE ON FUNCTION get_admin_stats FROM anon, authenticated;


-- 撤销普通用户对统计视图的访问权限
REVOKE ALL ON public.v_daily_user_stats FROM anon, authenticated;
REVOKE ALL ON public.v_device_stats FROM anon, authenticated;
REVOKE ALL ON public.v_payment_stats FROM anon, authenticated;

-- 撤销普通用户对统计函数的执行权限
REVOKE EXECUTE ON FUNCTION get_admin_stats FROM anon, authenticated;