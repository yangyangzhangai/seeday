# Supabase SQL for Today Context Persistence

Updated: 2026-04-06

## Purpose

Add `today_context` to `public.annotations` so each AI annotation can persist the daily context snapshot used at generation time (for replay and analytics).

## SQL (run in Supabase SQL Editor)

```sql
begin;

alter table public.annotations
  add column if not exists today_context jsonb;

comment on column public.annotations.today_context is
  'Today context snapshot used when generating annotation. Shape: { date, version, items[] }';

create index if not exists idx_annotations_today_context_gin
  on public.annotations using gin (today_context);

create index if not exists idx_annotations_today_context_date
  on public.annotations ((today_context->>'date'));

commit;
```

## Verify

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'annotations'
  and column_name = 'today_context';

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'annotations'
  and indexname in (
    'idx_annotations_today_context_gin',
    'idx_annotations_today_context_date'
  );
```

## Backfill (optional)

If you want old rows to have a stable empty payload instead of `null`:

```sql
update public.annotations
set today_context = jsonb_build_object('date', null, 'version', 'v1', 'items', '[]'::jsonb)
where today_context is null;
```
