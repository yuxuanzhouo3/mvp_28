-- ===========================================================================
-- Supabase 最终版全量构建脚本 (修复 2BP01 依赖报错 + 唯一约束版)
-- ===========================================================================

-- ⚠️ 警告：以下操作会级联删除 public 下的所有业务数据！
-- ===========================================================================
-- 1. 彻底清理旧环境 (Nuke Phase)
-- ===========================================================================
begin;
  -- 1.1 清理 auth.users 上的残留触发器 (这是报错的核心原因)
  drop trigger if exists on_auth_user_created on auth.users;
  drop trigger if exists on_auth_user_confirmed on auth.users; -- [新增] 移除那个导致报错的残留触发器
  
  -- 1.2 清理函数 (使用 CASCADE 强力清除任何依赖)
  drop function if exists public.handle_new_user() cascade;
  drop function if exists public.handle_user_confirmed() cascade; -- [修改] 加上 CASCADE 解决 2BP01 错误

  -- 1.3 移除所有业务表 (使用 CASCADE 强力清除表之间的外键依赖)
  drop table if exists public.messages cascade;
  drop table if exists public.conversations cascade;
  drop table if exists public.payments cascade;
  drop table if exists public.subscriptions cascade;
  drop table if exists public.user_wallets cascade;
  drop table if exists public.profiles cascade;
commit;

-- ===========================================================================
-- 2. 基础配置
-- ===========================================================================
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- 赋予权限
grant usage on schema public to postgres, anon, authenticated, service_role;

-- ===========================================================================
-- 3. 建表 (严格模式：必须包含 Primary Key)
-- ===========================================================================

-- 3.1 Profiles
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  name text,
  avatar text,
  region text default 'US',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint profiles_pkey primary key (id)
);

-- 3.2 User Wallets
create table public.user_wallets (
  user_id uuid not null references auth.users on delete cascade,
  plan text default 'Free',
  subscription_tier text default 'Free',
  plan_exp timestamptz,
  pro boolean default false,
  pending_downgrade text,
  monthly_image_balance integer default 0,
  monthly_video_balance integer default 0,
  monthly_reset_at timestamptz default now(),
  addon_image_balance integer default 0,
  addon_video_balance integer default 0,
  daily_external_day date default current_date,
  daily_external_plan text default 'free',
  daily_external_used integer default 0,
  updated_at timestamptz default now(),
  constraint user_wallets_pkey primary key (user_id)
);

-- 3.3 Subscriptions (关键修改：添加唯一约束)
create table public.subscriptions (
  id uuid default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  plan text not null,
  period text not null,
  status text not null,
  type text default 'SUBSCRIPTION',
  provider text,
  provider_order_id text,
  started_at timestamptz default now(),
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  primary key (id),
  
  -- [关键修复] 添加唯一约束，防止 ON CONFLICT (user_id) 报错
  constraint subscriptions_user_id_key unique (user_id)
);

-- 3.4 Payments
create table public.payments (
  id uuid default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  amount numeric(10,2) not null,
  currency text default 'USD',
  status text not null,
  type text not null,
  provider text,
  provider_order_id text,
  addon_package_id text,
  image_credits integer default 0,
  video_audio_credits integer default 0,
  created_at timestamptz default now(),
  primary key (id)
);

-- 3.5 Conversations
create table public.conversations (
  id uuid default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text,
  model text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id)
);

-- 3.6 Messages
create table public.messages (
  id uuid default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null,
  role text not null,
  content text not null,
  client_id text,
  audio_file_ids jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  primary key (id)
);

-- ===========================================================================
-- 4. 安全策略 (RLS)
-- ===========================================================================
alter table profiles enable row level security;
alter table user_wallets enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

create policy "Users manage own profiles" on profiles for all using (auth.uid() = id);
create policy "Users view own wallet" on user_wallets for select using (auth.uid() = user_id);
create policy "Users view own subscriptions" on subscriptions for select using (auth.uid() = user_id);
create policy "Users view own payments" on payments for select using (auth.uid() = user_id);
create policy "Users manage own conversations" on conversations for all using (auth.uid() = user_id);
create policy "Users manage own messages" on messages for all using (auth.uid() = user_id);

-- ===========================================================================
-- 5. 自动化 (触发器)
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- 1. 插入 Profile
  insert into public.profiles (id, email, name, avatar)
  values (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;

  -- 2. 插入 Wallet
  insert into public.user_wallets (
    user_id,
    plan,
    subscription_tier,
    monthly_image_balance,
    monthly_video_balance,
    addon_image_balance,
    addon_video_balance,
    daily_external_plan,
    daily_external_used
  )
  values (
    new.id,
    'Free',
    'Free',
    30,
    5,
    0,
    0,
    'free',
    0
  )
  on conflict (user_id) do nothing;

  return new;
exception
  when others then
    raise warning 'Handle new user trigger failed: %', SQLERRM;
    return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 绑定触发器
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ===========================================================================
-- 6. 最终授权
-- ===========================================================================
grant all privileges on all tables in schema public to postgres, service_role;
grant all privileges on all sequences in schema public to postgres, service_role;
grant execute on function public.handle_new_user() to service_role;