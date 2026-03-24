-- =============================================================================
-- MornGPT Expert Chat Logs (17 tables)
-- 每个专家模型一张表，用于收集对话数据（用户ID、提问/时间、回复/时间）。
-- =============================================================================

create extension if not exists "pgcrypto";

-- A: Growth Advisory
create table if not exists public.mgx_a_growth_advisory (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_a_growth_advisory_user_id
on public.mgx_a_growth_advisory(user_id);
alter table public.mgx_a_growth_advisory enable row level security;

-- B: Interview/Job
create table if not exists public.mgx_b_interview_job (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_b_interview_job_user_id
on public.mgx_b_interview_job(user_id);
alter table public.mgx_b_interview_job enable row level security;

-- C: AI Coder
create table if not exists public.mgx_c_ai_coder (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_c_ai_coder_user_id
on public.mgx_c_ai_coder(user_id);
alter table public.mgx_c_ai_coder enable row level security;

-- D: Content Detection
create table if not exists public.mgx_d_content_detection (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_d_content_detection_user_id
on public.mgx_d_content_detection(user_id);
alter table public.mgx_d_content_detection enable row level security;

-- E: Medical Advice
create table if not exists public.mgx_e_medical_advice (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_e_medical_advice_user_id
on public.mgx_e_medical_advice(user_id);
alter table public.mgx_e_medical_advice enable row level security;

-- H: Multi-GPT
create table if not exists public.mgx_h_multi_gpt (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_h_multi_gpt_user_id
on public.mgx_h_multi_gpt(user_id);
alter table public.mgx_h_multi_gpt enable row level security;

-- L: AI Lawyer
create table if not exists public.mgx_l_ai_lawyer (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_l_ai_lawyer_user_id
on public.mgx_l_ai_lawyer(user_id);
alter table public.mgx_l_ai_lawyer enable row level security;

-- N: Entertainment Advisor
create table if not exists public.mgx_n_entertainment_advisor (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_n_entertainment_advisor_user_id
on public.mgx_n_entertainment_advisor(user_id);
alter table public.mgx_n_entertainment_advisor enable row level security;

-- O: Housing
create table if not exists public.mgx_o_housing (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_o_housing_user_id
on public.mgx_o_housing(user_id);
alter table public.mgx_o_housing enable row level security;

-- P: Person Matching
create table if not exists public.mgx_p_person_matching (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_p_person_matching_user_id
on public.mgx_p_person_matching(user_id);
alter table public.mgx_p_person_matching enable row level security;

-- Q: AI Teacher
create table if not exists public.mgx_q_ai_teacher (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_q_ai_teacher_user_id
on public.mgx_q_ai_teacher(user_id);
alter table public.mgx_q_ai_teacher enable row level security;

-- R: Travel Planning
create table if not exists public.mgx_r_travel_planning (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_r_travel_planning_user_id
on public.mgx_r_travel_planning(user_id);
alter table public.mgx_r_travel_planning enable row level security;

-- S: Product Search
create table if not exists public.mgx_s_product_search (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_s_product_search_user_id
on public.mgx_s_product_search(user_id);
alter table public.mgx_s_product_search enable row level security;

-- T: Fashion
create table if not exists public.mgx_t_fashion (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_t_fashion_user_id
on public.mgx_t_fashion(user_id);
alter table public.mgx_t_fashion enable row level security;

-- U: Food & Dining
create table if not exists public.mgx_u_food_dining (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_u_food_dining_user_id
on public.mgx_u_food_dining(user_id);
alter table public.mgx_u_food_dining enable row level security;

-- W: Content Generation
create table if not exists public.mgx_w_content_generation (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_w_content_generation_user_id
on public.mgx_w_content_generation(user_id);
alter table public.mgx_w_content_generation enable row level security;

-- Z: AI Protection
create table if not exists public.mgx_z_ai_protection (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  user_message text not null,
  user_message_at timestamptz not null,
  assistant_message text not null,
  assistant_message_at timestamptz not null,
  model_id text not null,
  created_at timestamptz default now()
);
create index if not exists idx_mgx_z_ai_protection_user_id
on public.mgx_z_ai_protection(user_id);
alter table public.mgx_z_ai_protection enable row level security;

-- Ensure service_role has access
grant all privileges on all tables in schema public to postgres, service_role;
