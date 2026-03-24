-- ===========================================================================
-- 🛠️ 注册修复补丁：重载 handle_new_user 触发器
-- ===========================================================================

-- 1. 重建 handle_new_user 函数 (确保适配最新的表结构)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- 1.1 插入 Profile
  insert into public.profiles (id, email, name, avatar)
  values (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;

  -- 1.2 插入 Wallet (核心修复点)
  -- 我们显式指定所有字段，并为 billing_cycle_anchor 设置默认值
  insert into public.user_wallets (
    user_id,
    plan,
    subscription_tier,
    monthly_image_balance,
    monthly_video_balance,
    addon_image_balance,
    addon_video_balance,
    daily_external_plan,
    daily_external_used,
    billing_cycle_anchor -- 👈 确保插入时涵盖新字段 (虽然它是 nullable，但显式处理更安全)
  )
  values (
    new.id,
    'Free',
    'Free',
    30, -- Free 图片额度
    5,  -- Free 视频额度
    0,
    0,
    'free',
    0,
    EXTRACT(DAY FROM now()) -- 👈 新用户的锚点默认为注册当天的日期
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 2. 确保权限正确 (防止 Permission Denied 导致注册失败)
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on function public.handle_new_user() to service_role;

-- 3. 验证触发器是否存在 (如果之前被误删，这里会补上)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 输出修复结果
select 'Registration trigger fixed successfully' as status;