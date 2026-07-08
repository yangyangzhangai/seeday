-- Move growing Auth metadata fields out of JWT-backed user_metadata.
-- Run this in Supabase SQL Editor before deploying the frontend that writes these tables.

begin;

create table if not exists public.user_login_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  login_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, login_date)
);

alter table public.user_login_days enable row level security;

drop policy if exists "user_login_days_select_own" on public.user_login_days;
drop policy if exists "user_login_days_insert_own" on public.user_login_days;
drop policy if exists "user_login_days_update_own" on public.user_login_days;
drop policy if exists "user_login_days_delete_own" on public.user_login_days;

create policy "user_login_days_select_own"
  on public.user_login_days
  for select
  using (auth.uid() = user_id);

create policy "user_login_days_insert_own"
  on public.user_login_days
  for insert
  with check (auth.uid() = user_id);

create policy "user_login_days_update_own"
  on public.user_login_days
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_login_days_delete_own"
  on public.user_login_days
  for delete
  using (auth.uid() = user_id);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb,
  avatar_url text,
  long_term_profile_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles add column if not exists avatar_url text;

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
drop policy if exists "user_profiles_insert_own" on public.user_profiles;
drop policy if exists "user_profiles_update_own" on public.user_profiles;
drop policy if exists "user_profiles_delete_own" on public.user_profiles;

create policy "user_profiles_select_own"
  on public.user_profiles
  for select
  using (auth.uid() = user_id);

create policy "user_profiles_insert_own"
  on public.user_profiles
  for insert
  with check (auth.uid() = user_id);

create policy "user_profiles_update_own"
  on public.user_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_profiles_delete_own"
  on public.user_profiles
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
  before update on public.user_profiles
  for each row
  execute function public.set_updated_at();

insert into public.user_login_days (user_id, login_date)
select
  u.id,
  day_text::date as login_date
from auth.users u
cross join lateral jsonb_array_elements_text(
  case
    when jsonb_typeof(u.raw_user_meta_data -> 'login_days') = 'array'
    then u.raw_user_meta_data -> 'login_days'
    else '[]'::jsonb
  end
) as days(day_text)
where day_text ~ '^\d{4}-\d{2}-\d{2}$'
on conflict (user_id, login_date) do nothing;

insert into public.user_profiles (
  user_id,
  profile,
  avatar_url,
  long_term_profile_enabled,
  created_at,
  updated_at
)
select
  u.id,
  u.raw_user_meta_data -> 'user_profile_v2' as profile,
  case
    when coalesce(u.raw_user_meta_data ->> 'avatar_url', '') = '' then null
    when coalesce(u.raw_user_meta_data ->> 'avatar_url', '') like 'data:%' then null
    else u.raw_user_meta_data ->> 'avatar_url'
  end as avatar_url,
  case
    when lower(u.raw_user_meta_data ->> 'long_term_profile_enabled') = 'true' then true
    else false
  end as long_term_profile_enabled,
  now(),
  now()
from auth.users u
where u.raw_user_meta_data ? 'user_profile_v2'
   or u.raw_user_meta_data ? 'long_term_profile_enabled'
   or (
     u.raw_user_meta_data ? 'avatar_url'
     and coalesce(u.raw_user_meta_data ->> 'avatar_url', '') <> ''
     and coalesce(u.raw_user_meta_data ->> 'avatar_url', '') not like 'data:%'
   )
on conflict (user_id) do update
set
  profile = coalesce(excluded.profile, public.user_profiles.profile),
  avatar_url = coalesce(excluded.avatar_url, public.user_profiles.avatar_url),
  long_term_profile_enabled = excluded.long_term_profile_enabled,
  updated_at = now();

notify pgrst, 'reload schema';

commit;

-- Verify after running:
--
-- select count(*) as user_login_days_rows from public.user_login_days;
-- select count(*) as user_profiles_rows from public.user_profiles;
-- select user_id, length(profile::text) as profile_chars, long_term_profile_enabled
-- from public.user_profiles
-- order by updated_at desc
-- limit 20;

-- Cleanup only after the new frontend has been deployed and verified:
--
-- update auth.users
-- set raw_user_meta_data =
--   raw_user_meta_data
--   - 'avatar_url'
--   - 'login_days'
--   - 'user_profile_v2'
--   - 'long_term_profile_enabled';
--
-- notify pgrst, 'reload schema';
