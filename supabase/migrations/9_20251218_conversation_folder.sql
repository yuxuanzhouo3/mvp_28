-- =============================================================================
-- Conversations: persist model type + expert id for folder grouping
-- Folder keys: General / MornGPT / External (derived from model_type)
-- =============================================================================

alter table public.conversations
  add column if not exists model_type text;

alter table public.conversations
  add column if not exists expert_model_id text;

create index if not exists idx_conversations_model_type
  on public.conversations(model_type);

create index if not exists idx_conversations_expert_model_id
  on public.conversations(expert_model_id);

