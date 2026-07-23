-- DchenOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/api/reminderResponses.ts
-- Cross-device receipt for one concrete routine reminder occurrence.

begin;

create table if not exists public.reminder_responses (
  user_id uuid not null references auth.users(id) on delete cascade,
  occurrence_key text not null,
  occurrence_date date not null,
  reminder_type text not null,
  scheduled_for timestamptz not null,
  response_kind text not null check (
    response_kind in ('confirm', 'manual', 'view_report', 'grow_plant', 'snooze', 'close')
  ),
  responded_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, occurrence_key)
);

create index if not exists reminder_responses_user_date_idx
  on public.reminder_responses (user_id, occurrence_date);

grant select, insert, update, delete on public.reminder_responses to authenticated;
alter table public.reminder_responses enable row level security;

drop policy if exists "reminder_responses_select_own" on public.reminder_responses;
create policy "reminder_responses_select_own"
  on public.reminder_responses for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "reminder_responses_insert_own" on public.reminder_responses;
create policy "reminder_responses_insert_own"
  on public.reminder_responses for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "reminder_responses_update_own" on public.reminder_responses;
create policy "reminder_responses_update_own"
  on public.reminder_responses for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reminder_responses_delete_own" on public.reminder_responses;
create policy "reminder_responses_delete_own"
  on public.reminder_responses for delete to authenticated
  using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reminder_responses'
  ) then
    alter publication supabase_realtime add table public.reminder_responses;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
