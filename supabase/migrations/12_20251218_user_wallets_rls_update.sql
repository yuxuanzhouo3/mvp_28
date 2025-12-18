-- ===========================================================================
-- 修复 user_wallets 表的 RLS 策略，允许用户更新自己的钱包数据
-- ===========================================================================

-- 删除旧的只读策略
DROP POLICY IF EXISTS "Users view own wallet" ON public.user_wallets;

-- 创建新的完整 CRUD 策略
CREATE POLICY "Users manage own wallet" ON public.user_wallets
FOR ALL USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
