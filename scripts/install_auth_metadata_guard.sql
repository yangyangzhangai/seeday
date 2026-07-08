-- Global guard for Supabase Auth metadata that is copied into JWTs.
-- Run this once in the Supabase SQL editor after backing up affected rows.

begin;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb,
  avatar_url text,
  long_term_profile_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles add column if not exists avatar_url text;
alter table public.user_profiles add column if not exists long_term_profile_enabled boolean;
alter table public.user_profiles alter column long_term_profile_enabled set default false;
update public.user_profiles
set long_term_profile_enabled = false
where long_term_profile_enabled is null;
alter table public.user_profiles alter column long_term_profile_enabled set not null;

insert into public.user_profiles (
  user_id,
  avatar_url,
  created_at,
  updated_at
)
select
  u.id,
  u.raw_user_meta_data ->> 'avatar_url' as avatar_url,
  now(),
  now()
from auth.users u
where coalesce(u.raw_user_meta_data ->> 'avatar_url', '') <> ''
  and coalesce(u.raw_user_meta_data ->> 'avatar_url', '') not like 'data:%'
  and length(coalesce(u.raw_user_meta_data ->> 'avatar_url', '')) <= 2048
on conflict (user_id) do update
set
  avatar_url = coalesce(public.user_profiles.avatar_url, excluded.avatar_url),
  updated_at = now();

update auth.users
set raw_user_meta_data =
  coalesce(raw_user_meta_data, '{}'::jsonb)
  - 'avatar_url'
  - 'login_days'
  - 'user_profile_v2'
  - 'long_term_profile_enabled'
  - 'today_narrative_cache_v1'
  - 'lateral_association_state_v1'
where coalesce(raw_user_meta_data, '{}'::jsonb) ?| array[
  'avatar_url',
  'login_days',
  'user_profile_v2',
  'long_term_profile_enabled',
  'today_narrative_cache_v1',
  'lateral_association_state_v1'
];

create or replace function public.strip_jwt_heavy_user_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata_key text;
  metadata_value jsonb;
  string_value text;
begin
  new.raw_user_meta_data = coalesce(new.raw_user_meta_data, '{}'::jsonb)
    - 'avatar_url'
    - 'login_days'
    - 'user_profile_v2'
    - 'long_term_profile_enabled'
    - 'today_narrative_cache_v1'
    - 'lateral_association_state_v1';

  for metadata_key, metadata_value in
    select key, value from jsonb_each(new.raw_user_meta_data)
  loop
    if jsonb_typeof(metadata_value) = 'string' then
      string_value = metadata_value #>> '{}';
      if lower(left(trim(string_value), 5)) = 'data:' or length(string_value) > 2048 then
        new.raw_user_meta_data = new.raw_user_meta_data - metadata_key;
      end if;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists strip_jwt_heavy_user_metadata_before_write on auth.users;

create trigger strip_jwt_heavy_user_metadata_before_write
before insert or update of raw_user_meta_data
on auth.users
for each row
execute function public.strip_jwt_heavy_user_metadata();

notify pgrst, 'reload schema';
notify pgrst, 'reload config';

commit;

-- Verify after running:
-- select
--   id,
--   email,
--   length(coalesce(raw_user_meta_data::text, '')) as metadata_chars,
--   length(coalesce(raw_user_meta_data ->> 'avatar_url', '')) as avatar_chars,
--   left(coalesce(raw_user_meta_data ->> 'avatar_url', ''), 40) as avatar_prefix
-- from auth.users
-- order by metadata_chars desc
-- limit 20;
