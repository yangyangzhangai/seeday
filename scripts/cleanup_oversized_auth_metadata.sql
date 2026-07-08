-- Emergency cleanup for oversized Supabase Auth user_metadata.
-- Oversized metadata is copied into every JWT, which can make REST requests
-- fail at the API gateway with a plain "400 Bad Request".

begin;

create table if not exists public.user_login_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  login_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, login_date)
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb,
  avatar_url text,
  long_term_profile_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles add column if not exists avatar_url text;

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
where u.id = 'cda9b186-d1e1-41a4-b25a-821a40660f66'::uuid
  and day_text ~ '^\d{4}-\d{2}-\d{2}$'
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
  lower(u.raw_user_meta_data ->> 'long_term_profile_enabled') = 'true',
  now(),
  now()
from auth.users u
where u.id = 'cda9b186-d1e1-41a4-b25a-821a40660f66'::uuid
  and (
    u.raw_user_meta_data ? 'user_profile_v2'
    or u.raw_user_meta_data ? 'long_term_profile_enabled'
    or u.raw_user_meta_data ? 'avatar_url'
  )
on conflict (user_id) do update
set
  profile = coalesce(excluded.profile, public.user_profiles.profile),
  avatar_url = coalesce(excluded.avatar_url, public.user_profiles.avatar_url),
  long_term_profile_enabled = excluded.long_term_profile_enabled,
  updated_at = now();

update auth.users
set raw_user_meta_data =
  raw_user_meta_data
  - 'avatar_url'
  - 'login_days'
  - 'user_profile_v2'
  - 'long_term_profile_enabled'
  - 'today_narrative_cache_v1'
  - 'lateral_association_state_v1'
where id = 'cda9b186-d1e1-41a4-b25a-821a40660f66'::uuid;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';

commit;

-- Verify:
-- select
--   id,
--   length(raw_user_meta_data::text) as metadata_chars,
--   raw_user_meta_data ? 'avatar_url' as has_avatar_url,
--   raw_user_meta_data ? 'login_days' as has_login_days,
--   raw_user_meta_data ? 'user_profile_v2' as has_profile_v2,
--   raw_user_meta_data ? 'today_narrative_cache_v1' as has_narrative_cache,
--   raw_user_meta_data ? 'lateral_association_state_v1' as has_association_cache
-- from auth.users
-- where id = 'cda9b186-d1e1-41a4-b25a-821a40660f66'::uuid;
