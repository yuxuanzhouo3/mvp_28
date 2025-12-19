-- =============================================================================
-- 0. 启用加密扩展 (为了能在 SQL 里直接算哈希)
-- =============================================================================
create extension if not exists pgcrypto;

-- =============================================================================
-- 1. 创建管理员表
-- =============================================================================
create table if not exists public.admin_users (
  id uuid default gen_random_uuid() primary key,
  username text not null unique,
  password_hash text not null,
  created_at timestamptz default now()
);

-- =============================================================================
-- 2. 解决 RLS 安全警告 (关键步骤)
-- =============================================================================
-- 2.1 开启行级安全
alter table public.admin_users enable row level security;

-- 2.2 我们故意 **不创建** 任何针对 public/authenticated 角色的 Policy。
-- 效果：前端 API (Anon Key) 完全无法访问此表。
-- 只有后端代码 (使用 Service Role Key) 可以绕过 RLS 进行读写。
-- 这对管理员表来说是最安全的设置。

-- =============================================================================
-- 3. 插入初始管理员账号 (自动计算哈希)
-- =============================================================================
insert into public.admin_users (username, password_hash)
values (
  'morngpt',
  -- 使用 crypt 函数直接将明文加密为 bcrypt hash
  crypt('Zyx!213416', gen_salt('bf'))
)
on conflict (username) do nothing; -- 防止重复插入报错