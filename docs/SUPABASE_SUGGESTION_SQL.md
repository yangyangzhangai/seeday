# Supabase SQL for AI Suggestion Feedback

Updated: 2026-03-29

## Purpose

Add the required column for AI suggestion acceptance feedback used by the annotation flow.

## SQL (run in Supabase SQL Editor)

```sql
begin;

alter table public.annotations
  add column if not exists suggestion_accepted boolean;

commit;
```

## Verify

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'annotations'
  and column_name = 'suggestion_accepted';
```
