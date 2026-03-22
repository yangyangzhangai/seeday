-- Minimal Supabase schema verification for the current frontend codebase.
-- Run this in Supabase SQL Editor.
-- This script is read-only.

-- =========================================================
-- 1. Required public tables used by the current code
-- =========================================================
with expected(table_name) as (
  values
    ('messages'),
    ('moods'),
    ('todos'),
    ('bottles'),
    ('focus_sessions'),
    ('annotations'),
    ('reports'),
    ('stardust_memories'),
    ('daily_plant_records'),
    ('plant_direction_config'),
    ('user_stats')
)
select
  e.table_name,
  case when t.table_name is not null then 'ok' else 'missing' end as status
from expected e
left join information_schema.tables t
  on t.table_schema = 'public'
 and t.table_name = e.table_name
order by e.table_name;

-- =========================================================
-- 2. Required columns already referenced by the code
-- =========================================================
with expected(table_name, column_name) as (
  values
    ('messages', 'id'),
    ('messages', 'user_id'),
    ('messages', 'content'),
    ('messages', 'timestamp'),
    ('messages', 'type'),
    ('messages', 'duration'),
    ('messages', 'activity_type'),
    ('messages', 'is_mood'),
    ('messages', 'image_url'),
    ('messages', 'image_url_2'),
    ('messages', 'mood_descriptions'),
    ('messages', 'is_active'),
    ('messages', 'detached'),

    ('moods', 'user_id'),
    ('moods', 'message_id'),
    ('moods', 'mood_label'),
    ('moods', 'custom_label'),
    ('moods', 'is_custom'),
    ('moods', 'note'),
    ('moods', 'source'),

    ('todos', 'id'),
    ('todos', 'user_id'),
    ('todos', 'content'),
    ('todos', 'completed'),
    ('todos', 'priority'),
    ('todos', 'category'),
    ('todos', 'due_date'),
    ('todos', 'scope'),
    ('todos', 'created_at'),
    ('todos', 'recurrence'),
    ('todos', 'recurrence_days'),
    ('todos', 'recurrence_id'),
    ('todos', 'completed_at'),
    ('todos', 'is_pinned'),
    ('todos', 'started_at'),
    ('todos', 'duration'),
    ('todos', 'bottle_id'),
    ('todos', 'sort_order'),
    ('todos', 'is_template'),
    ('todos', 'template_id'),

    ('bottles', 'id'),
    ('bottles', 'user_id'),
    ('bottles', 'name'),
    ('bottles', 'type'),
    ('bottles', 'stars'),
    ('bottles', 'round'),
    ('bottles', 'status'),
    ('bottles', 'created_at'),
    ('bottles', 'updated_at'),

    ('focus_sessions', 'id'),
    ('focus_sessions', 'user_id'),
    ('focus_sessions', 'todo_id'),
    ('focus_sessions', 'started_at'),
    ('focus_sessions', 'ended_at'),
    ('focus_sessions', 'set_duration'),
    ('focus_sessions', 'actual_duration'),

    ('annotations', 'id'),
    ('annotations', 'user_id'),
    ('annotations', 'content'),
    ('annotations', 'tone'),
    ('annotations', 'event_timestamp'),
    ('annotations', 'related_event'),
    ('annotations', 'created_at'),

    ('reports', 'id'),
    ('reports', 'user_id'),
    ('reports', 'title'),
    ('reports', 'date'),
    ('reports', 'start_date'),
    ('reports', 'end_date'),
    ('reports', 'type'),
    ('reports', 'content'),
    ('reports', 'ai_analysis'),
    ('reports', 'stats'),

    ('stardust_memories', 'id'),
    ('stardust_memories', 'message_id'),
    ('stardust_memories', 'user_id'),
    ('stardust_memories', 'message'),
    ('stardust_memories', 'emoji_char'),
    ('stardust_memories', 'user_raw_content'),
    ('stardust_memories', 'created_at'),
    ('stardust_memories', 'alien_name'),

    ('daily_plant_records', 'id'),
    ('daily_plant_records', 'user_id'),
    ('daily_plant_records', 'date'),
    ('daily_plant_records', 'timezone'),
    ('daily_plant_records', 'root_metrics'),
    ('daily_plant_records', 'root_type'),
    ('daily_plant_records', 'plant_id'),
    ('daily_plant_records', 'plant_stage'),
    ('daily_plant_records', 'is_special'),
    ('daily_plant_records', 'is_support_variant'),
    ('daily_plant_records', 'diary_text'),
    ('daily_plant_records', 'generated_at'),
    ('daily_plant_records', 'cycle_id'),

    ('plant_direction_config', 'user_id'),
    ('plant_direction_config', 'direction_index'),
    ('plant_direction_config', 'category_key'),

    ('user_stats', 'user_id'),
    ('user_stats', 'login_streak'),
    ('user_stats', 'last_login_date'),
    ('user_stats', 'updated_at')
)
select
  e.table_name,
  e.column_name,
  case when c.column_name is not null then 'ok' else 'missing' end as status
from expected e
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = e.table_name
 and c.column_name = e.column_name
order by e.table_name, e.column_name;

-- =========================================================
-- 3. Recommended extra columns to verify
-- These are not all fully wired in code yet, but are likely
-- the next fields you may want to add.
-- =========================================================
with expected(table_name, column_name, note) as (
  values
    ('moods', 'linked_mood_message_id', 'optional: only needed if you want full cross-device linked-mood restore')
)
select
  e.table_name,
  e.column_name,
  case when c.column_name is not null then 'present' else 'not_present' end as status,
  e.note
from expected e
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = e.table_name
 and c.column_name = e.column_name
order by e.table_name, e.column_name;

-- =========================================================
-- 4. Important unique / primary constraints
-- =========================================================
with expected(table_name, normalized_cols, note) as (
  values
    ('moods', 'user_id,message_id', 'required by upsert(onConflict user_id,message_id)'),
    ('daily_plant_records', 'user_id,date', 'recommended: one daily plant row per user/date'),
    ('plant_direction_config', 'user_id,direction_index', 'recommended: one category per direction slot'),
    ('plant_direction_config', 'user_id,category_key', 'recommended: one slot per category'),
    ('user_stats', 'user_id', 'expected primary key')
),
actual as (
  select
    cls.relname as table_name,
    replace(string_agg(att.attname, ',' order by ord.ordinality), ' ', '') as normalized_cols
  from pg_index idx
  join pg_class cls
    on cls.oid = idx.indrelid
  join pg_namespace ns
    on ns.oid = cls.relnamespace
  join lateral unnest(idx.indkey) with ordinality as ord(attnum, ordinality)
    on true
  join pg_attribute att
    on att.attrelid = cls.oid
   and att.attnum = ord.attnum
  where ns.nspname = 'public'
    and (idx.indisunique or idx.indisprimary)
  group by cls.oid, cls.relname, idx.indexrelid
)
select
  e.table_name,
  e.normalized_cols as columns,
  case
    when exists (
      select 1
      from actual a
      where a.table_name = e.table_name
        and a.normalized_cols = e.normalized_cols
    ) then 'ok'
    else 'missing'
  end as status,
  e.note
from expected e
order by e.table_name, e.normalized_cols;

-- =========================================================
-- 5. RLS enabled check
-- =========================================================
with expected(table_name) as (
  values
    ('messages'),
    ('moods'),
    ('todos'),
    ('bottles'),
    ('focus_sessions'),
    ('annotations'),
    ('reports'),
    ('stardust_memories'),
    ('daily_plant_records'),
    ('plant_direction_config'),
    ('user_stats')
),
actual as (
  select
    c.relname as table_name,
    c.relrowsecurity
  from pg_class c
  join pg_namespace ns
    on ns.oid = c.relnamespace
  where ns.nspname = 'public'
    and c.relkind = 'r'
)
select
  e.table_name,
  case
    when a.table_name is null then 'table_missing'
    when a.relrowsecurity then 'enabled'
    else 'disabled'
  end as rls_status
from expected e
left join actual a
  on a.table_name = e.table_name
order by e.table_name;

-- =========================================================
-- 6. Optional: quick auth metadata spot-check
-- Read-only sample of the latest users.
-- Skip this if you do not want to inspect auth.users.
-- =========================================================
select
  id,
  created_at,
  raw_user_meta_data ->> 'display_name' as display_name,
  raw_user_meta_data ->> 'ai_mode' as ai_mode,
  raw_user_meta_data ->> 'ai_mode_enabled' as ai_mode_enabled,
  raw_user_meta_data ->> 'daily_goal_enabled' as daily_goal_enabled,
  raw_user_meta_data ->> 'annotation_drop_rate' as annotation_drop_rate,
  raw_user_meta_data ->> 'daily_goal' as daily_goal,
  raw_user_meta_data ->> 'daily_goal_date' as daily_goal_date,
  raw_user_meta_data -> 'login_days' as login_days,
  raw_app_meta_data ->> 'membership_plan' as app_membership_plan,
  raw_user_meta_data ->> 'membership_plan' as user_membership_plan
from auth.users
order by created_at desc
limit 20;
