-- 202512071900_paypal_payments_subscriptions.sql
-- Create payments & subscriptions tables and secure them with RLS (owner-only).

-- Enable uuid generator
create extension if not exists "pgcrypto";

-- Subscriptions table
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  plan text not null,
  period text not null,              -- monthly | annual
  status text not null default 'active',
  provider text default 'paypal',
  provider_order_id text,
  started_at timestamptz default now(),
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index subscriptions_user_provider_idx
  on public.subscriptions(user_id, provider);

-- Payments table
create table public.payments (
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

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute procedure public.set_updated_at();

-- Enable RLS
alter table public.subscriptions enable row level security;
alter table public.payments      enable row level security;

-- Subscriptions policies (owner-only)
drop policy if exists subscriptions_select_owner on public.subscriptions;
drop policy if exists subscriptions_insert_owner on public.subscriptions;
drop policy if exists subscriptions_update_owner on public.subscriptions;

create policy subscriptions_select_owner on public.subscriptions
  for select using (auth.uid() = user_id);

create policy subscriptions_insert_owner on public.subscriptions
  for insert with check (auth.uid() = user_id);

create policy subscriptions_update_owner on public.subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Payments policies (owner-only)
drop policy if exists payments_select_owner on public.payments;
drop policy if exists payments_insert_owner on public.payments;
drop policy if exists payments_update_owner on public.payments;

create policy payments_select_owner on public.payments
  for select using (auth.uid() = user_id);

create policy payments_insert_owner on public.payments
  for insert with check (auth.uid() = user_id);

create policy payments_update_owner on public.payments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
