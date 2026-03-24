-- ===========================================================================
-- 添加 messages 表缺失的列
-- 注意：conversations 表的 model_type 和 expert_model_id 已在 migration 9 中定义
-- ===========================================================================

-- 添加 folder_id 列 (用于对话文件夹功能)
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS folder_id TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_folder_id
ON public.conversations(folder_id);

-- ===========================================================================
-- messages 表字段
-- ===========================================================================

-- 添加 tokens 列 (用于记录消息的 token 数量)
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS tokens INTEGER;

-- 添加 client_id 列 (用于消息去重)
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS client_id TEXT;

-- 添加媒体文件 ID 列 (用于多模态模型)
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS image_file_ids JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS video_file_ids JSONB DEFAULT '[]'::jsonb;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_messages_client_id
ON public.messages(client_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
ON public.messages(conversation_id);
