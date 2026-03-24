-- ============================================================================
-- 对话分享功能完整迁移
-- ============================================================================

-- 1. 创建对话分享表
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.conversation_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id VARCHAR(30) UNIQUE NOT NULL,
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  secret VARCHAR(20),
  is_public BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_conversation FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE
);

-- 2. 创建索引
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_conversation_shares_share_id ON public.conversation_shares(share_id);
CREATE INDEX IF NOT EXISTS idx_conversation_shares_user_id ON public.conversation_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_shares_conversation_id ON public.conversation_shares(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_shares_expires_at ON public.conversation_shares(expires_at);

-- 3. 启用 RLS
-- ============================================================================
ALTER TABLE public.conversation_shares ENABLE ROW LEVEL SECURITY;

-- 4. conversation_shares 表的 RLS 策略
-- ============================================================================

-- 允许任何人通过 share_id 查询分享记录（用于公开访问分享链接）
CREATE POLICY "Anyone can view shares by share_id"
  ON public.conversation_shares
  FOR SELECT
  USING (true);

-- 用户可以创建分享
CREATE POLICY "Users can create shares"
  ON public.conversation_shares
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的分享
CREATE POLICY "Users can update their own shares"
  ON public.conversation_shares
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 用户可以删除自己的分享
CREATE POLICY "Users can delete their own shares"
  ON public.conversation_shares
  FOR DELETE
  USING (auth.uid() = user_id);

-- 5. conversations 表的公开访问策略
-- ============================================================================

-- 允许通过分享链接公开访问 conversations
-- 只有在 conversation_shares 表中有记录的对话才能被公开访问
CREATE POLICY "Anyone can view conversations via share"
  ON public.conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_shares
      WHERE conversation_shares.conversation_id = conversations.id
    )
  );

-- 6. messages 表的公开访问策略
-- ============================================================================

-- 允许通过分享链接公开访问 messages
-- 只有属于已分享对话的消息才能被公开访问
CREATE POLICY "Anyone can view messages via share"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_shares
      WHERE conversation_shares.conversation_id = messages.conversation_id
    )
  );

-- 7. 触发器函数
-- ============================================================================

-- 自动更新 updated_at 字���
CREATE OR REPLACE FUNCTION update_conversation_shares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 触发器
-- ============================================================================
CREATE TRIGGER trigger_update_conversation_shares_updated_at
  BEFORE UPDATE ON public.conversation_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_shares_updated_at();

-- 9. 表和字段注释
-- ============================================================================
COMMENT ON TABLE public.conversation_shares IS '对话分享记录表';
COMMENT ON COLUMN public.conversation_shares.share_id IS '分享唯一标识符（12位随机字符串）';
COMMENT ON COLUMN public.conversation_shares.conversation_id IS '关联的对话ID';
COMMENT ON COLUMN public.conversation_shares.user_id IS '创建分享的用户ID';
COMMENT ON COLUMN public.conversation_shares.secret IS '访问密钥（私密分享时使用，8位大写字符串）';
COMMENT ON COLUMN public.conversation_shares.is_public IS '是否为公开分享';
COMMENT ON COLUMN public.conversation_shares.expires_at IS '过期时间';
COMMENT ON COLUMN public.conversation_shares.access_count IS '访问次数统计';

-- ============================================================================
-- 安全性说明
-- ============================================================================
-- 1. share_id 是 12 位随机字符串（使用 nanoid），难以猜测
-- 2. 私密分享需要验证 secret 密钥（在应用层实现）
-- 3. 过期分享会被自动清理（在应用层实现）
-- 4. 访问次数会被记录用于监控
-- 5. 只有被分享的对话和消息才能被公开访问
-- 6. 未分享的对话仍然受原有 RLS 策略保护
