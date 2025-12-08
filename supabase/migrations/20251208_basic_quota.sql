-- Monthly quota table for Basic plan
create table if not exists basic_quotas (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null, -- store first day of month (UTC)
  used integer not null default 0,
  limit_per_month integer not null default 100,
  updated_at timestamptz default now(),
  primary key (user_id, month)
);

create index if not exists basic_quotas_month_idx on basic_quotas(month);

alter table basic_quotas enable row level security;

drop policy if exists "basic_quotas_select_own" on basic_quotas;
drop policy if exists "basic_quotas_insert_own" on basic_quotas;
drop policy if exists "basic_quotas_update_own" on basic_quotas;

create policy "basic_quotas_select_own" on basic_quotas
  for select using (auth.uid() = user_id);

create policy "basic_quotas_insert_own" on basic_quotas
  for insert with check (auth.uid() = user_id);

create policy "basic_quotas_update_own" on basic_quotas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
