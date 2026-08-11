-- Phase13: Auth user profile foundation
-- 2026-08-11
-- Purpose: keep current single-admin operation simple while leaving a safe path to future RBAC.
-- Run once in Supabase SQL Editor while signed in as project owner/postgres.

begin;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'admin'
    check (role in ('admin','editor','viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
on public.user_profiles
for select
to authenticated
using (auth.uid() = user_id);

-- No browser-side INSERT/UPDATE/DELETE policy yet.
-- With the current one-person operation, profile administration remains server/dashboard-side.

insert into public.user_profiles (user_id, display_name, role, is_active)
select id, coalesce(raw_user_meta_data->>'display_name', email), 'admin', true
from auth.users
on conflict (user_id) do nothing;

commit;

-- Verification
select
  up.user_id,
  up.display_name,
  up.role,
  up.is_active,
  up.created_at,
  au.email
from public.user_profiles up
join auth.users au on au.id = up.user_id
order by up.created_at;
