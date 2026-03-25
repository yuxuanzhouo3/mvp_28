-- Add soft delete support for conversations (recycle bin / 30-day recovery)
-- This migration adds a deleted_at column and updates RLS policies

-- 1. Add deleted_at column
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Create index for efficient soft-delete queries
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON conversations(deleted_at);

-- 3. Create function to auto-purge conversations deleted > 30 days ago
-- This can be called via a cron job or Supabase scheduled function
CREATE OR REPLACE FUNCTION purge_deleted_conversations()
RETURNS void AS $$
BEGIN
  -- Delete messages associated with conversations deleted > 30 days ago
  DELETE FROM messages WHERE conversation_id IN (
    SELECT id FROM conversations
    WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'
  );
  -- Delete the conversations themselves
  DELETE FROM conversations
  WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
