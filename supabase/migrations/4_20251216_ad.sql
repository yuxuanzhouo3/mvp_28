-- =============================================================================
-- 1. 创建广告表 (advertisements)
-- =============================================================================
create table if not exists public.advertisements (
  id uuid default gen_random_uuid() primary key,
  
  -- 基础信息
  title text not null,           -- 标题 (后台管理用)
  position text not null,        -- 位置标识 (如 "top", "sidebar")
  
  -- 资源信息
  media_type text not null,      -- 类型 ("image" 或 "video")
  media_url text not null,       -- 资源的完整 URL
  target_url text,               -- 点击跳转链接 (可选)
  
  -- 控制开关
  is_active boolean default true,-- 上下架状态
  priority int default 0,        -- 轮播权重 (数字越大越靠前)
  
  -- 审计时间
  created_at timestamptz default now()
);

-- =============================================================================
-- 2. 创建索引 (加速查询)
-- 解释：因为你的查询通常是 "找某个位置 + 必须是激活的 + 按权重排序"
-- =============================================================================
create index if not exists idx_ads_simple 
on public.advertisements(position, is_active, priority desc);

-- =============================================================================
-- 3. 启用 RLS (行级安全策略) - 🚨 非常重要
-- 默认情况下，Supabase 拒绝所有未授权的访问。我们需要明确放行。
-- =============================================================================
alter table public.advertisements enable row level security;

-- 策略 A: 允许所有人 (Public) "读取" 广告
-- 条件：只能看到 is_active = true 的广告。
-- (这样你在后台把广告设为 false 后，前端用户就立即看不到了，即使他们知道接口也查不到)
create policy "Public can view active ads"
on public.advertisements for select
using ( is_active = true );

-- 策略 B: 允许后台管理 (Service Role) "所有操作"
-- 注意：Supabase 的 Service Role (你的 Next.js 后端/Admin) 默认拥有所有权限，
-- 甚至不需要这里写 Policy，它会自动绕过 RLS。
-- 所以这里不需要为写操作写额外的 Policy，只要你的 Admin 代码用的是 service_role key 即可。

-- (可选) 如果你的 Admin 后台用的是普通登录用户，你需要取消下面这行的注释并修改邮箱：
-- create policy "Admins can manage ads"
-- on public.advertisements for all
-- using ( auth.jwt() ->> 'email' = '你的管理员邮箱@example.com' );


-- =============================================================================
-- 4. (附赠) 创建 Storage 存储桶并配置权限
-- 这一步是为了让你能上传广告图
-- =============================================================================

-- 4.1 创建一个叫 'ads' 的公共桶
insert into storage.buckets (id, name, public)
values ('ads', 'ads', true)
on conflict (id) do nothing;

-- 4.2 允许所有人读取 'ads' 桶里的图片 (用于前端展示)
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'ads' );

-- 4.3 允许已登录用户上传图片 (或者你可以限制更严)
create policy "Authenticated users can upload"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'ads' );