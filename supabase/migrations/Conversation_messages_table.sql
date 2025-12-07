-- Chat persistence schema
-- Run this in Supabase SQL editor or CLI

create extension if not exists pgcrypto;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text default '新对话',
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  tokens jsonb,
  client_id text unique, -- optional id from client to dedupe
  created_at timestamptz not null default now()
);

-- fast ordering by time per conversation
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

-- RLS
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- only owner can see/modify their conversations
create policy "Conversations select own"
  on public.conversations
  for select
  using (auth.uid() = user_id);

create policy "Conversations insert own"
  on public.conversations
  for insert
  with check (auth.uid() = user_id);

create policy "Conversations update own"
  on public.conversations
  for update
  using (auth.uid() = user_id);

create policy "Conversations delete own"
  on public.conversations
  for delete
  using (auth.uid() = user_id);

-- messages follow conversation owner
create policy "Messages select own conv"
  on public.messages
  for select
  using (auth.uid() = user_id);

create policy "Messages insert own conv"
  on public.messages
  for insert
  with check (auth.uid() = user_id);

create policy "Messages delete own conv"
  on public.messages
  for delete
  using (auth.uid() = user_id);
