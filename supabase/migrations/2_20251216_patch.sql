-- ===========================================================================
-- 增量补丁：适配防漂移算法 & 并发扣费
-- 只需要运行这一次，不会删除现有数据
-- ===========================================================================

-- 1. 修改 user_wallets 表：添加账单锚点字段
-- 解释：这是为了配合你的 TypeScript 代码中的 getNextBillingDateSticky 算法
-- 它记录用户最初是几号买的（比如31号），防止月份变动导致扣费日漂移
alter table public.user_wallets 
add column if not exists billing_cycle_anchor integer;

-- 2. 新增原子扣费函数 (RPC)
-- 解释：这是为了配合 consumeSupabaseQuota 中的 supabase.rpc('deduct_quota')
-- 它能保证在高并发下（比如同时点5次生成），余额不会扣成负数
create or replace function deduct_quota(
  p_user_id uuid,
  p_image_count int,
  p_video_count int
) returns jsonb as $$
declare
  v_wallet public.user_wallets%rowtype;
  v_deducted_monthly_image int := 0;
  v_deducted_addon_image int := 0;
  v_deducted_monthly_video int := 0;
  v_deducted_addon_video int := 0;
  v_remain_image int;
  v_remain_video int;
begin
  -- 锁定行 (Row-level locking) 防止并发修改
  select * into v_wallet from public.user_wallets 
  where user_id = p_user_id 
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Wallet not found');
  end if;

  -- === 图片扣减逻辑 (FEFO: 先扣月度，再扣加油包) ===
  v_remain_image := p_image_count;
  
  if v_remain_image > 0 and v_wallet.monthly_image_balance > 0 then
    v_deducted_monthly_image := least(v_remain_image, v_wallet.monthly_image_balance);
    v_remain_image := v_remain_image - v_deducted_monthly_image;
  end if;
  
  if v_remain_image > 0 and v_wallet.addon_image_balance > 0 then
    v_deducted_addon_image := least(v_remain_image, v_wallet.addon_image_balance);
    v_remain_image := v_remain_image - v_deducted_addon_image;
  end if;

  if v_remain_image > 0 then
    return jsonb_build_object('success', false, 'error', 'Insufficient image quota');
  end if;

  -- === 视频扣减逻辑 (FEFO) ===
  v_remain_video := p_video_count;
  
  if v_remain_video > 0 and v_wallet.monthly_video_balance > 0 then
    v_deducted_monthly_video := least(v_remain_video, v_wallet.monthly_video_balance);
    v_remain_video := v_remain_video - v_deducted_monthly_video;
  end if;
  
  if v_remain_video > 0 and v_wallet.addon_video_balance > 0 then
    v_deducted_addon_video := least(v_remain_video, v_wallet.addon_video_balance);
    v_remain_video := v_remain_video - v_deducted_addon_video;
  end if;

  if v_remain_video > 0 then
    return jsonb_build_object('success', false, 'error', 'Insufficient video quota');
  end if;

  -- === 执行更新 ===
  update public.user_wallets
  set 
    monthly_image_balance = monthly_image_balance - v_deducted_monthly_image,
    addon_image_balance = addon_image_balance - v_deducted_addon_image,
    monthly_video_balance = monthly_video_balance - v_deducted_monthly_video,
    addon_video_balance = addon_video_balance - v_deducted_addon_video,
    updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object(
    'success', true,
    'deducted', jsonb_build_object(
      'monthly_image', v_deducted_monthly_image,
      'addon_image', v_deducted_addon_image,
      'monthly_video', v_deducted_monthly_video,
      'addon_video', v_deducted_addon_video
    )
  );
end;
$$ language plpgsql security definer;