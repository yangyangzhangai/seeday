BEGIN;

-- Align public.todos with the current frontend mapper.
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS bottle_id uuid;
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS sort_order bigint;
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS template_id uuid;
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS recurrence_days smallint[];

COMMIT;
