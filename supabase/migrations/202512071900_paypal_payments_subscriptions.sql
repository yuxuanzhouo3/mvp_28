-- 确保扩展                                                                                                          
  create extension if not exists "pgcrypto";                                                                           
                                                                                                                       
  -- 表若已存在则跳过                                                                                                  
  create table if not exists public.subscriptions (                                                                    
    id uuid primary key default gen_random_uuid(),                                                                     
    user_id uuid references auth.users on delete cascade,                                                              
    plan text not null,                                                                                                
    period text not null,                                                                                              
    status text not null default 'active',                                                                             
    provider text default 'paypal',                                                                                    
    provider_order_id text,                                                                                            
    started_at timestamptz default now(),                                                                              
    expires_at timestamptz,                                                                                            
    created_at timestamptz default now(),                                                                              
    updated_at timestamptz default now()                                                                               
  );                                                                                                                   
                                                                                                                       
  create table if not exists public.payments (                                                                         
    id uuid primary key default gen_random_uuid(),                                                                     
    user_id uuid references auth.users on delete cascade,                                                              
    provider text not null,                                                                                            
    provider_order_id text,                                                                                            
    amount numeric(10,2),                                                                                              
    currency text,                                                                                                     
    status text,                                                                                                       
    plan text,                                                                                                         
    period text,                                                                                                       
    created_at timestamptz default now()                                                                               
  );                                                                                                                   
                                                                                                                       
  -- 索引：允许同一 user/provider 多档位，并行存储                                                                     
  drop index if exists subscriptions_user_provider_idx;                                                                
  create unique index if not exists subscriptions_user_provider_plan_idx                                               
    on public.subscriptions(user_id, provider, plan);                                                                  
                                                                                                                       
  -- RLS 启用与策略                                                                                                    
  alter table public.subscriptions enable row level security;                                                          
  alter table public.payments      enable row level security;                                                          
                                                                                                                       
  drop policy if exists subscriptions_select_owner on public.subscriptions;                                            
  drop policy if exists subscriptions_insert_owner on public.subscriptions;                                            
  drop policy if exists subscriptions_update_owner on public.subscriptions;                                            
                                                                                                                       
  create policy subscriptions_select_owner on public.subscriptions                                                     
    for select using (auth.uid() = user_id);                                                                           
  create policy subscriptions_insert_owner on public.subscriptions                                                     
    for insert with check (auth.uid() = user_id);                                                                      
  create policy subscriptions_update_owner on public.subscriptions                                                     
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);                                         
                                                                                                                       
  drop policy if exists payments_select_owner on public.payments;                                                      
  drop policy if exists payments_insert_owner on public.payments;                                                      
  drop policy if exists payments_update_owner on public.payments;                                                      
                                                                                                                       
  create policy payments_select_owner on public.payments                                                               
    for select using (auth.uid() = user_id);                                                                           
  create policy payments_insert_owner on public.payments                                                               
    for insert with check (auth.uid() = user_id);                                                                      
  create policy payments_update_owner on public.payments                                                               
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);