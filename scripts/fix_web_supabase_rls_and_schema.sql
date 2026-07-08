-- Repair for Supabase 400/RLS errors seen during auth local-to-cloud sync.
-- Run in Supabase SQL Editor, then refresh/re-login on the web app.
--
-- Covers the tables touched by:
--   syncLocalDataToSupabase()
--   updateLoginStreak()
--   useChatStore/useStardustStore fetches

begin;

-- ---------------------------------------------------------------------------
-- Tables and columns expected by the current frontend.
-- create table if not exists handles empty/missing projects; alter table handles
-- older projects that already have a subset of the schema.
-- ---------------------------------------------------------------------------

create table if not exists public.messages (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  "timestamp" bigint not null,
  type text,
  duration integer,
  activity_type text,
  is_mood boolean not null default false,
  image_url text,
  image_url_2 text,
  mood_descriptions jsonb,
  is_active boolean not null default false,
  detached boolean not null default false
);

alter table public.messages add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.messages add column if not exists id uuid;
alter table public.messages add column if not exists content text;
alter table public.messages add column if not exists "timestamp" bigint;
alter table public.messages add column if not exists type text;
alter table public.messages add column if not exists duration integer;
alter table public.messages add column if not exists activity_type text;
alter table public.messages add column if not exists is_mood boolean default false;
alter table public.messages add column if not exists image_url text;
alter table public.messages add column if not exists image_url_2 text;
alter table public.messages add column if not exists mood_descriptions jsonb;
alter table public.messages add column if not exists is_active boolean default false;
alter table public.messages add column if not exists detached boolean default false;

create table if not exists public.moods (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null,
  mood_label text,
  custom_label text,
  is_custom boolean,
  note text,
  source text,
  updated_at timestamptz not null default now()
);

alter table public.moods add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.moods add column if not exists message_id uuid;
alter table public.moods add column if not exists mood_label text;
alter table public.moods add column if not exists custom_label text;
alter table public.moods add column if not exists is_custom boolean;
alter table public.moods add column if not exists note text;
alter table public.moods add column if not exists source text;
alter table public.moods add column if not exists updated_at timestamptz default now();

create unique index if not exists moods_user_message_uidx on public.moods(user_id, message_id);

create table if not exists public.todos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  completed boolean not null default false,
  priority text,
  category text,
  due_date bigint,
  scope text,
  created_at bigint not null,
  recurrence text,
  recurrence_days smallint[],
  recurrence_id uuid,
  completed_at bigint,
  is_pinned boolean not null default false,
  started_at bigint,
  duration integer,
  bottle_id uuid,
  sort_order bigint,
  is_template boolean not null default false,
  template_id uuid,
  parent_id uuid,
  suggested_duration integer,
  deleted_at timestamptz,
  updated_at timestamptz
);

alter table public.todos add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.todos add column if not exists id uuid;
alter table public.todos add column if not exists content text;
alter table public.todos add column if not exists completed boolean default false;
alter table public.todos add column if not exists priority text;
alter table public.todos add column if not exists category text;
alter table public.todos add column if not exists due_date bigint;
alter table public.todos add column if not exists scope text;
alter table public.todos add column if not exists created_at bigint;
alter table public.todos add column if not exists recurrence text;
alter table public.todos add column if not exists recurrence_days smallint[];
alter table public.todos add column if not exists recurrence_id uuid;
alter table public.todos add column if not exists completed_at bigint;
alter table public.todos add column if not exists is_pinned boolean default false;
alter table public.todos add column if not exists started_at bigint;
alter table public.todos add column if not exists duration integer;
alter table public.todos add column if not exists bottle_id uuid;
alter table public.todos add column if not exists sort_order bigint;
alter table public.todos add column if not exists is_template boolean default false;
alter table public.todos add column if not exists template_id uuid;
alter table public.todos add column if not exists parent_id uuid;
alter table public.todos add column if not exists suggested_duration integer;
alter table public.todos add column if not exists deleted_at timestamptz;
alter table public.todos add column if not exists updated_at timestamptz;

create table if not exists public.bottles (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text,
  stars integer not null default 0,
  round integer not null default 1,
  status text,
  bottle_checkin_dates text[],
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz
);

alter table public.bottles add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.bottles add column if not exists id uuid;
alter table public.bottles add column if not exists name text;
alter table public.bottles add column if not exists type text;
alter table public.bottles add column if not exists stars integer default 0;
alter table public.bottles add column if not exists round integer default 1;
alter table public.bottles add column if not exists status text;
alter table public.bottles add column if not exists bottle_checkin_dates text[];
alter table public.bottles add column if not exists created_at timestamptz;
alter table public.bottles add column if not exists updated_at timestamptz;
alter table public.bottles add column if not exists deleted_at timestamptz;

create table if not exists public.focus_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  todo_id uuid,
  started_at timestamptz not null,
  ended_at timestamptz,
  set_duration integer,
  actual_duration integer
);

alter table public.focus_sessions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.focus_sessions add column if not exists id uuid;
alter table public.focus_sessions add column if not exists todo_id uuid;
alter table public.focus_sessions add column if not exists started_at timestamptz;
alter table public.focus_sessions add column if not exists ended_at timestamptz;
alter table public.focus_sessions add column if not exists set_duration integer;
alter table public.focus_sessions add column if not exists actual_duration integer;

create table if not exists public.reports (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  date bigint not null,
  start_date bigint,
  end_date bigint,
  type text,
  content text,
  ai_analysis text,
  teaser_text text,
  user_note text,
  stats jsonb
);

alter table public.reports add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.reports add column if not exists id uuid;
alter table public.reports add column if not exists title text;
alter table public.reports add column if not exists date bigint;
alter table public.reports add column if not exists start_date bigint;
alter table public.reports add column if not exists end_date bigint;
alter table public.reports add column if not exists type text;
alter table public.reports add column if not exists content text;
alter table public.reports add column if not exists ai_analysis text;
alter table public.reports add column if not exists teaser_text text;
alter table public.reports add column if not exists user_note text;
alter table public.reports add column if not exists stats jsonb;

create table if not exists public.stardust_memories (
  id uuid primary key,
  message_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text,
  emoji_char text,
  user_raw_content text,
  created_at timestamptz not null default now(),
  alien_name text
);

alter table public.stardust_memories add column if not exists message_id uuid;
alter table public.stardust_memories add column if not exists id uuid;
alter table public.stardust_memories add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.stardust_memories add column if not exists message text;
alter table public.stardust_memories add column if not exists emoji_char text;
alter table public.stardust_memories add column if not exists user_raw_content text;
alter table public.stardust_memories add column if not exists created_at timestamptz default now();
alter table public.stardust_memories add column if not exists alien_name text;

create table if not exists public.user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_streak integer not null default 0,
  last_login_date date,
  updated_at timestamptz not null default now()
);

alter table public.user_stats add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.user_stats add column if not exists login_streak integer default 0;
alter table public.user_stats add column if not exists last_login_date date;
alter table public.user_stats add column if not exists updated_at timestamptz default now();

create unique index if not exists user_stats_user_id_uidx on public.user_stats(user_id);

-- Upsert targets used by the frontend.
create unique index if not exists messages_id_uidx on public.messages(id);
create unique index if not exists todos_id_uidx on public.todos(id);
create unique index if not exists bottles_id_uidx on public.bottles(id);
create unique index if not exists focus_sessions_id_uidx on public.focus_sessions(id);
create unique index if not exists reports_id_uidx on public.reports(id);
create unique index if not exists stardust_memories_id_uidx on public.stardust_memories(id);

create table if not exists public.annotations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  tone text,
  event_timestamp bigint,
  related_event jsonb,
  today_context jsonb,
  suggestion_accepted boolean,
  created_at timestamptz not null default now()
);

alter table public.annotations add column if not exists id uuid;
alter table public.annotations add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.annotations add column if not exists content text;
alter table public.annotations add column if not exists tone text;
alter table public.annotations add column if not exists event_timestamp bigint;
alter table public.annotations add column if not exists related_event jsonb;
alter table public.annotations add column if not exists today_context jsonb;
alter table public.annotations add column if not exists suggestion_accepted boolean;
alter table public.annotations add column if not exists created_at timestamptz default now();
create unique index if not exists annotations_id_uidx on public.annotations(id);

create table if not exists public.timing_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  source text not null,
  date date not null,
  created_at timestamptz not null default now()
);

alter table public.timing_sessions add column if not exists id uuid;
alter table public.timing_sessions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.timing_sessions add column if not exists type text;
alter table public.timing_sessions add column if not exists started_at timestamptz default now();
alter table public.timing_sessions add column if not exists ended_at timestamptz;
alter table public.timing_sessions add column if not exists source text;
alter table public.timing_sessions add column if not exists date date;
alter table public.timing_sessions add column if not exists created_at timestamptz default now();
create unique index if not exists timing_sessions_id_uidx on public.timing_sessions(id);
create index if not exists timing_sessions_user_date_idx on public.timing_sessions(user_id, date);

create table if not exists public.user_login_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  login_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, login_date)
);

alter table public.user_login_days add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.user_login_days add column if not exists login_date date;
alter table public.user_login_days add column if not exists created_at timestamptz default now();
create unique index if not exists user_login_days_user_date_uidx on public.user_login_days(user_id, login_date);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb,
  avatar_url text,
  long_term_profile_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.user_profiles add column if not exists profile jsonb;
alter table public.user_profiles add column if not exists avatar_url text;
alter table public.user_profiles add column if not exists long_term_profile_enabled boolean default false;
alter table public.user_profiles add column if not exists created_at timestamptz default now();
alter table public.user_profiles add column if not exists updated_at timestamptz default now();
create unique index if not exists user_profiles_user_id_uidx on public.user_profiles(user_id);

-- ---------------------------------------------------------------------------
-- Grants and RLS policies.
-- PostgREST needs grants; RLS still limits every row to auth.uid() = user_id.
-- Some older tables have user_id as text rather than uuid, so policies compare
-- text-to-text to avoid "operator does not exist: uuid = text".
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.moods to authenticated;
grant select, insert, update, delete on public.todos to authenticated;
grant select, insert, update, delete on public.bottles to authenticated;
grant select, insert, update, delete on public.focus_sessions to authenticated;
grant select, insert, update, delete on public.reports to authenticated;
grant select, insert, update, delete on public.stardust_memories to authenticated;
grant select, insert, update on public.user_stats to authenticated;
grant select, insert, update, delete on public.annotations to authenticated;
grant select, insert, update, delete on public.timing_sessions to authenticated;
grant select, insert, update, delete on public.user_login_days to authenticated;
grant select, insert, update, delete on public.user_profiles to authenticated;

alter table public.messages enable row level security;
alter table public.moods enable row level security;
alter table public.todos enable row level security;
alter table public.bottles enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.reports enable row level security;
alter table public.stardust_memories enable row level security;
alter table public.user_stats enable row level security;
alter table public.annotations enable row level security;
alter table public.timing_sessions enable row level security;
alter table public.user_login_days enable row level security;
alter table public.user_profiles enable row level security;

-- Remove older broad/public policies that can leave data more open than intended.
drop policy if exists "Enable read access for all users" on public.bottles;
drop policy if exists "Allow all access" on public.messages;
drop policy if exists "Allow all access" on public.todos;
drop policy if exists "Users can view their own reports" on public.reports;
drop policy if exists "Users can insert their own reports" on public.reports;
drop policy if exists "Users can update their own reports" on public.reports;
drop policy if exists "Users can delete their own reports" on public.reports;
drop policy if exists "用户只能查看自己的珍藏" on public.stardust_memories;
drop policy if exists "用户只能插入自己的珍藏" on public.stardust_memories;
drop policy if exists "用户只能更新自己的珍藏" on public.stardust_memories;
drop policy if exists "用户只能删除自己的珍藏" on public.stardust_memories;
drop policy if exists "user_stats_upsert_own" on public.user_stats;

drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own" on public.messages for select to authenticated using (auth.uid()::text = user_id::text);
drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own" on public.messages for insert to authenticated with check (auth.uid()::text = user_id::text);
drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own" on public.messages for update to authenticated using (auth.uid()::text = user_id::text) with check (auth.uid()::text = user_id::text);
drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own" on public.messages for delete to authenticated using (auth.uid()::text = user_id::text);

drop policy if exists "moods_select_own" on public.moods;
create policy "moods_select_own" on public.moods for select to authenticated using (auth.uid()::text = user_id::text);
drop policy if exists "moods_insert_own" on public.moods;
create policy "moods_insert_own" on public.moods for insert to authenticated with check (auth.uid()::text = user_id::text);
drop policy if exists "moods_update_own" on public.moods;
create policy "moods_update_own" on public.moods for update to authenticated using (auth.uid()::text = user_id::text) with check (auth.uid()::text = user_id::text);
drop policy if exists "moods_delete_own" on public.moods;
create policy "moods_delete_own" on public.moods for delete to authenticated using (auth.uid()::text = user_id::text);

drop policy if exists "todos_select_own" on public.todos;
create policy "todos_select_own" on public.todos for select to authenticated using (auth.uid()::text = user_id::text);
drop policy if exists "todos_insert_own" on public.todos;
create policy "todos_insert_own" on public.todos for insert to authenticated with check (auth.uid()::text = user_id::text);
drop policy if exists "todos_update_own" on public.todos;
create policy "todos_update_own" on public.todos for update to authenticated using (auth.uid()::text = user_id::text) with check (auth.uid()::text = user_id::text);
drop policy if exists "todos_delete_own" on public.todos;
create policy "todos_delete_own" on public.todos for delete to authenticated using (auth.uid()::text = user_id::text);

drop policy if exists "bottles_select_own" on public.bottles;
create policy "bottles_select_own" on public.bottles for select to authenticated using (auth.uid()::text = user_id::text);
drop policy if exists "bottles_insert_own" on public.bottles;
create policy "bottles_insert_own" on public.bottles for insert to authenticated with check (auth.uid()::text = user_id::text);
drop policy if exists "bottles_update_own" on public.bottles;
create policy "bottles_update_own" on public.bottles for update to authenticated using (auth.uid()::text = user_id::text) with check (auth.uid()::text = user_id::text);
drop policy if exists "bottles_delete_own" on public.bottles;
create policy "bottles_delete_own" on public.bottles for delete to authenticated using (auth.uid()::text = user_id::text);

drop policy if exists "focus_sessions_select_own" on public.focus_sessions;
create policy "focus_sessions_select_own" on public.focus_sessions for select to authenticated using (auth.uid()::text = user_id::text);
drop policy if exists "focus_sessions_insert_own" on public.focus_sessions;
create policy "focus_sessions_insert_own" on public.focus_sessions for insert to authenticated with check (auth.uid()::text = user_id::text);
drop policy if exists "focus_sessions_update_own" on public.focus_sessions;
create policy "focus_sessions_update_own" on public.focus_sessions for update to authenticated using (auth.uid()::text = user_id::text) with check (auth.uid()::text = user_id::text);
drop policy if exists "focus_sessions_delete_own" on public.focus_sessions;
create policy "focus_sessions_delete_own" on public.focus_sessions for delete to authenticated using (auth.uid()::text = user_id::text);

drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own" on public.reports for select to authenticated using (auth.uid()::text = user_id::text);
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports for insert to authenticated with check (auth.uid()::text = user_id::text);
drop policy if exists "reports_update_own" on public.reports;
create policy "reports_update_own" on public.reports for update to authenticated using (auth.uid()::text = user_id::text) with check (auth.uid()::text = user_id::text);
drop policy if exists "reports_delete_own" on public.reports;
create policy "reports_delete_own" on public.reports for delete to authenticated using (auth.uid()::text = user_id::text);

drop policy if exists "stardust_memories_select_own" on public.stardust_memories;
create policy "stardust_memories_select_own" on public.stardust_memories for select to authenticated using (auth.uid()::text = user_id::text);
drop policy if exists "stardust_memories_insert_own" on public.stardust_memories;
create policy "stardust_memories_insert_own" on public.stardust_memories for insert to authenticated with check (auth.uid()::text = user_id::text);
drop policy if exists "stardust_memories_update_own" on public.stardust_memories;
create policy "stardust_memories_update_own" on public.stardust_memories for update to authenticated using (auth.uid()::text = user_id::text) with check (auth.uid()::text = user_id::text);
drop policy if exists "stardust_memories_delete_own" on public.stardust_memories;
create policy "stardust_memories_delete_own" on public.stardust_memories for delete to authenticated using (auth.uid()::text = user_id::text);

drop policy if exists "user_stats_select_own" on public.user_stats;
create policy "user_stats_select_own" on public.user_stats for select to authenticated using (auth.uid()::text = user_id::text);
drop policy if exists "user_stats_insert_own" on public.user_stats;
create policy "user_stats_insert_own" on public.user_stats for insert to authenticated with check (auth.uid()::text = user_id::text);
drop policy if exists "user_stats_update_own" on public.user_stats;
create policy "user_stats_update_own" on public.user_stats for update to authenticated using (auth.uid()::text = user_id::text) with check (auth.uid()::text = user_id::text);

drop policy if exists "annotations_select_own" on public.annotations;
create policy "annotations_select_own" on public.annotations for select to authenticated using (auth.uid()::text = user_id::text);
drop policy if exists "annotations_insert_own" on public.annotations;
create policy "annotations_insert_own" on public.annotations for insert to authenticated with check (auth.uid()::text = user_id::text);
drop policy if exists "annotations_update_own" on public.annotations;
create policy "annotations_update_own" on public.annotations for update to authenticated using (auth.uid()::text = user_id::text) with check (auth.uid()::text = user_id::text);
drop policy if exists "annotations_delete_own" on public.annotations;
create policy "annotations_delete_own" on public.annotations for delete to authenticated using (auth.uid()::text = user_id::text);

drop policy if exists "timing_sessions_select_own" on public.timing_sessions;
create policy "timing_sessions_select_own" on public.timing_sessions for select to authenticated using (auth.uid()::text = user_id::text);
drop policy if exists "timing_sessions_insert_own" on public.timing_sessions;
create policy "timing_sessions_insert_own" on public.timing_sessions for insert to authenticated with check (auth.uid()::text = user_id::text);
drop policy if exists "timing_sessions_update_own" on public.timing_sessions;
create policy "timing_sessions_update_own" on public.timing_sessions for update to authenticated using (auth.uid()::text = user_id::text) with check (auth.uid()::text = user_id::text);
drop policy if exists "timing_sessions_delete_own" on public.timing_sessions;
create policy "timing_sessions_delete_own" on public.timing_sessions for delete to authenticated using (auth.uid()::text = user_id::text);

drop policy if exists "user_login_days_select_own" on public.user_login_days;
create policy "user_login_days_select_own" on public.user_login_days for select to authenticated using (auth.uid()::text = user_id::text);
drop policy if exists "user_login_days_insert_own" on public.user_login_days;
create policy "user_login_days_insert_own" on public.user_login_days for insert to authenticated with check (auth.uid()::text = user_id::text);
drop policy if exists "user_login_days_update_own" on public.user_login_days;
create policy "user_login_days_update_own" on public.user_login_days for update to authenticated using (auth.uid()::text = user_id::text) with check (auth.uid()::text = user_id::text);
drop policy if exists "user_login_days_delete_own" on public.user_login_days;
create policy "user_login_days_delete_own" on public.user_login_days for delete to authenticated using (auth.uid()::text = user_id::text);

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own" on public.user_profiles for select to authenticated using (auth.uid()::text = user_id::text);
drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own" on public.user_profiles for insert to authenticated with check (auth.uid()::text = user_id::text);
drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own" on public.user_profiles for update to authenticated using (auth.uid()::text = user_id::text) with check (auth.uid()::text = user_id::text);
drop policy if exists "user_profiles_delete_own" on public.user_profiles;
create policy "user_profiles_delete_own" on public.user_profiles for delete to authenticated using (auth.uid()::text = user_id::text);

commit;

-- Optional verification after commit:
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'messages',
    'moods',
    'todos',
    'bottles',
    'focus_sessions',
    'reports',
    'stardust_memories',
    'user_stats',
    'annotations',
    'timing_sessions',
    'user_login_days',
    'user_profiles'
  )
order by table_name, ordinal_position;

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'messages',
    'moods',
    'todos',
    'bottles',
    'focus_sessions',
    'reports',
    'stardust_memories',
    'user_stats',
    'annotations',
    'timing_sessions',
    'user_login_days',
    'user_profiles'
  )
order by tablename, policyname;
