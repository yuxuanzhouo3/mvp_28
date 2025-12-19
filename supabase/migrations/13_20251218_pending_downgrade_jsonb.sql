-- ===========================================================================
-- Migration: 将 pending_downgrade 从 text 改为 jsonb 以支持多重降级队列
-- ===========================================================================

-- 1. 修改 user_wallets 表的 pending_downgrade 字段类型
-- 从 text 改为 jsonb，支持存储数组格式的降级队列
ALTER TABLE public.user_wallets
  ALTER COLUMN pending_downgrade TYPE jsonb
  USING CASE
    WHEN pending_downgrade IS NULL THEN NULL
    WHEN pending_downgrade = '' THEN NULL
    ELSE pending_downgrade::jsonb
  END;

-- 2. 添加注释说明字段用途
COMMENT ON COLUMN public.user_wallets.pending_downgrade IS
  '待生效的降级订阅队列，jsonb数组格式: [{targetPlan, effectiveAt, expiresAt}, ...]，按等级降序排列（高级先生效）';
