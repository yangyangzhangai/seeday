-- Unified account lifecycle state for onboarding, plan snapshot, and deletion intent.
-- Run after user_profiles/user_login_days migrations.

begin;

create table if not exists public.user_account_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_status text not null default 'active',
  onboarding_status text not null default 'required',
  onboarding_completed_at timestamptz,
  onboarding_version text,
  onboarding_last_step integer,
  onboarding_started_at timestamptz,
  onboarding_updated_at timestamptz,
  onboarding_reentry_allowed boolean not null default false,
  plan_snapshot text not null default 'free',
  plan_source text,
  plan_expires_at timestamptz,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  deletion_status text not null default 'none',
  deletion_requested_at timestamptz,
  deletion_effective_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_account_state enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "user_account_state_select_own" on public.user_account_state;
drop policy if exists "user_account_state_insert_own" on public.user_account_state;
drop policy if exists "user_account_state_update_own" on public.user_account_state;
drop policy if exists "user_account_state_delete_own" on public.user_account_state;

create policy "user_account_state_select_own"
  on public.user_account_state
  for select
  using (auth.uid() = user_id);

create policy "user_account_state_insert_own"
  on public.user_account_state
  for insert
  with check (auth.uid() = user_id);

create policy "user_account_state_update_own"
  on public.user_account_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_account_state_delete_own"
  on public.user_account_state
  for delete
  using (auth.uid() = user_id);

drop trigger if exists set_user_account_state_updated_at on public.user_account_state;
create trigger set_user_account_state_updated_at
  before update on public.user_account_state
  for each row
  execute function public.set_updated_at();

insert into public.user_account_state (
  user_id,
  account_status,
  onboarding_status,
  onboarding_completed_at,
  onboarding_version,
  onboarding_reentry_allowed,
  plan_snapshot,
  plan_source,
  plan_expires_at,
  trial_started_at,
  trial_ends_at,
  deletion_status,
  created_at,
  updated_at
)
select
  u.id,
  case
    when coalesce(u.raw_user_meta_data ->> 'pending_deletion_at', '') <> '' then 'pending_deletion'
    else 'active'
  end as account_status,
  case
    when coalesce((up.profile ->> 'onboardingCompleted')::boolean, false) = true then 'completed'
    when u.created_at >= now() - interval '72 hours' then 'required'
    else 'completed'
  end as onboarding_status,
  case
    when coalesce((up.profile ->> 'onboardingCompleted')::boolean, false) = true then coalesce(up.updated_at, now())
    else null
  end as onboarding_completed_at,
  case
    when coalesce((up.profile ->> 'onboardingCompleted')::boolean, false) = true then 'legacy_profile'
    when u.created_at >= now() - interval '72 hours' then 'v2_route_flow'
    else 'legacy_assumed_completed'
  end as onboarding_version,
  false as onboarding_reentry_allowed,
  case
    when lower(coalesce(u.raw_app_meta_data ->> 'membership_plan', u.raw_user_meta_data ->> 'membership_plan', 'free')) in ('plus', 'pro', 'premium', 'vip', 'member', 'paid') then 'plus'
    when coalesce(u.raw_app_meta_data ->> 'trial_started_at', u.raw_user_meta_data ->> 'trial_started_at', '') <> ''
      and coalesce(nullif(u.raw_app_meta_data ->> 'trial_started_at', '')::timestamptz, nullif(u.raw_user_meta_data ->> 'trial_started_at', '')::timestamptz) > now() - interval '7 days' then 'plus'
    else 'free'
  end as plan_snapshot,
  case
    when lower(coalesce(u.raw_app_meta_data ->> 'membership_plan', u.raw_user_meta_data ->> 'membership_plan', '')) in ('plus', 'pro', 'premium', 'vip', 'member', 'paid') then 'legacy_metadata'
    when coalesce(u.raw_app_meta_data ->> 'trial_started_at', u.raw_user_meta_data ->> 'trial_started_at', '') <> '' then 'trial'
    else 'default_free'
  end as plan_source,
  coalesce(nullif(u.raw_app_meta_data ->> 'membership_expires_at', ''), nullif(u.raw_user_meta_data ->> 'membership_expires_at', ''))::timestamptz as plan_expires_at,
  coalesce(nullif(u.raw_app_meta_data ->> 'trial_started_at', ''), nullif(u.raw_user_meta_data ->> 'trial_started_at', ''))::timestamptz as trial_started_at,
  case
    when coalesce(nullif(u.raw_app_meta_data ->> 'trial_started_at', ''), nullif(u.raw_user_meta_data ->> 'trial_started_at', '')) is null then null
    else coalesce(nullif(u.raw_app_meta_data ->> 'trial_started_at', ''), nullif(u.raw_user_meta_data ->> 'trial_started_at', ''))::timestamptz + interval '7 days'
  end as trial_ends_at,
  case
    when coalesce(u.raw_user_meta_data ->> 'pending_deletion_at', '') <> '' then 'requested'
    else 'none'
  end as deletion_status,
  now(),
  now()
from auth.users u
left join public.user_profiles up on up.user_id = u.id
on conflict (user_id) do update
set
  account_status = excluded.account_status,
  onboarding_status = excluded.onboarding_status,
  onboarding_completed_at = coalesce(public.user_account_state.onboarding_completed_at, excluded.onboarding_completed_at),
  onboarding_version = coalesce(public.user_account_state.onboarding_version, excluded.onboarding_version),
  plan_snapshot = excluded.plan_snapshot,
  plan_source = excluded.plan_source,
  plan_expires_at = coalesce(excluded.plan_expires_at, public.user_account_state.plan_expires_at),
  trial_started_at = coalesce(excluded.trial_started_at, public.user_account_state.trial_started_at),
  trial_ends_at = coalesce(excluded.trial_ends_at, public.user_account_state.trial_ends_at),
  deletion_status = excluded.deletion_status,
  updated_at = now();

notify pgrst, 'reload schema';

commit;
