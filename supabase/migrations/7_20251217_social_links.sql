-- =============================================================================
-- 社交链接/专业产品 管理表 (social_links)
-- 用于管理侧边栏折叠后显示的小方块链接
-- =============================================================================

create table if not exists public.social_links (
  id uuid default gen_random_uuid() primary key,

  -- 基础信息
  title text not null,                -- 标题 (悬浮显示)
  description text,                   -- 描述 (悬浮显示)
  icon_url text not null,             -- 图标 URL (图片)
  target_url text not null,           -- 点击跳转链接

  -- 控制开关
  is_active boolean default true,     -- 上下架状态
  sort_order int default 0,           -- 排序顺序 (数字越小越靠前)

  -- 文件信息
  file_size bigint,                   -- 图标文件大小 (字节)

  -- 审计时间
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================================================
-- 创建索引 (加速查询)
-- =============================================================================
create index if not exists idx_social_links_active_order
on public.social_links(is_active, sort_order asc);

-- =============================================================================
-- 启用 RLS (行级安全策略)
-- =============================================================================
alter table public.social_links enable row level security;

-- 策略 A: 允许所有人 "读取" 活跃的社交链接
create policy "Public can view active social links"
on public.social_links for select
using ( is_active = true );

-- =============================================================================
-- 创建 Storage 存储桶 (用于存储社交链接图标)
-- =============================================================================

-- 创建一个叫 'social-icons' 的公共桶
insert into storage.buckets (id, name, public)
values ('social-icons', 'social-icons', true)
on conflict (id) do nothing;

-- 删除可能已存在的策略（避免冲突）
drop policy if exists "Public Access Social Icons" on storage.objects;
drop policy if exists "Authenticated users can upload social icons" on storage.objects;

-- 允许所有人读取 'social-icons' 桶里的图标 (用于前端展示)
create policy "Public Access Social Icons"
on storage.objects for select
using ( bucket_id = 'social-icons' );

-- 允许已登录用户上传图标
create policy "Authenticated users can upload social icons"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'social-icons' );

-- =============================================================================
-- 创建更新时间触发器
-- =============================================================================
create or replace function update_social_links_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_social_links_updated_at on public.social_links;
create trigger trigger_social_links_updated_at
before update on public.social_links
for each row
execute function update_social_links_updated_at();
