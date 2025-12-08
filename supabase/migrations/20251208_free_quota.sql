-- Free daily quota table
create table if not exists free_quotas (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  used integer not null default 0,
  limit_per_day integer not null default 10,
  updated_at timestamptz default now(),
  primary key (user_id, day)
);

create index if not exists free_quotas_day_idx on free_quotas(day);

alter table free_quotas enable row level security;

-- Policies (drop first to keep migration idempotent)
drop policy if exists "free_quotas_select_own" on free_quotas;
drop policy if exists "free_quotas_insert_own" on free_quotas;
drop policy if exists "free_quotas_update_own" on free_quotas;

create policy "free_quotas_select_own" on free_quotas
  for select using (auth.uid() = user_id);

create policy "free_quotas_insert_own" on free_quotas
  for insert with check (auth.uid() = user_id);

create policy "free_quotas_update_own" on free_quotas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
