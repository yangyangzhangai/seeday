-- Fix for the web errors seen on 2026-07-07:
-- - reports upsert rejected by RLS
-- - messages queries returning 400, usually caused by missing columns
-- - bottles/user_stats inserts rejected by RLS
--
-- Run in Supabase SQL Editor, then refresh/re-login on the web app.

begin;

-- Frontend/server code reads these messages columns.
alter table public.messages add column if not exists is_mood boolean default false;
alter table public.messages add column if not exists image_url text;
alter table public.messages add column if not exists image_url_2 text;
alter table public.messages add column if not exists mood_descriptions jsonb;
alter table public.messages add column if not exists is_active boolean default false;
alter table public.messages add column if not exists detached boolean default false;

-- Report persistence currently writes these columns.
alter table public.reports add column if not exists teaser_text text;
alter table public.reports add column if not exists user_note text;
alter table public.reports add column if not exists stats jsonb;

-- PostgREST still needs table privileges; RLS decides which rows are visible/writable.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.reports to authenticated;
grant select, insert, update, delete on public.bottles to authenticated;
grant select, insert, update on public.user_stats to authenticated;
grant select, insert, update, delete on public.daily_plant_records to authenticated;
grant select, insert, update, delete on public.plant_direction_config to authenticated;

alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.bottles enable row level security;
alter table public.user_stats enable row level security;
alter table public.daily_plant_records enable row level security;
alter table public.plant_direction_config enable row level security;

drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own"
  on public.messages for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own"
  on public.messages for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own"
  on public.messages for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own"
  on public.messages for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own"
  on public.reports for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "reports_update_own" on public.reports;
create policy "reports_update_own"
  on public.reports for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reports_delete_own" on public.reports;
create policy "reports_delete_own"
  on public.reports for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "bottles_select_own" on public.bottles;
create policy "bottles_select_own"
  on public.bottles for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "bottles_insert_own" on public.bottles;
create policy "bottles_insert_own"
  on public.bottles for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "bottles_update_own" on public.bottles;
create policy "bottles_update_own"
  on public.bottles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "bottles_delete_own" on public.bottles;
create policy "bottles_delete_own"
  on public.bottles for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_stats_select_own" on public.user_stats;
create policy "user_stats_select_own"
  on public.user_stats for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_stats_insert_own" on public.user_stats;
create policy "user_stats_insert_own"
  on public.user_stats for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_stats_update_own" on public.user_stats;
create policy "user_stats_update_own"
  on public.user_stats for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "daily_plant_records_select_own" on public.daily_plant_records;
create policy "daily_plant_records_select_own"
  on public.daily_plant_records for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "daily_plant_records_insert_own" on public.daily_plant_records;
create policy "daily_plant_records_insert_own"
  on public.daily_plant_records for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "daily_plant_records_update_own" on public.daily_plant_records;
create policy "daily_plant_records_update_own"
  on public.daily_plant_records for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "daily_plant_records_delete_own" on public.daily_plant_records;
create policy "daily_plant_records_delete_own"
  on public.daily_plant_records for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "plant_direction_config_select_own" on public.plant_direction_config;
create policy "plant_direction_config_select_own"
  on public.plant_direction_config for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "plant_direction_config_insert_own" on public.plant_direction_config;
create policy "plant_direction_config_insert_own"
  on public.plant_direction_config for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "plant_direction_config_update_own" on public.plant_direction_config;
create policy "plant_direction_config_update_own"
  on public.plant_direction_config for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "plant_direction_config_delete_own" on public.plant_direction_config;
create policy "plant_direction_config_delete_own"
  on public.plant_direction_config for delete
  to authenticated
  using (auth.uid() = user_id);

commit;

-- Optional verification after commit:
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'messages' and column_name in ('is_mood', 'image_url', 'image_url_2', 'mood_descriptions', 'is_active', 'detached'))
    or (table_name = 'reports' and column_name in ('teaser_text', 'user_note', 'stats'))
  )
order by table_name, column_name;

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('messages', 'reports', 'bottles', 'user_stats', 'daily_plant_records', 'plant_direction_config')
order by tablename, policyname;
