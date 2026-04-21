BEGIN;

-- Add sub-todo and AI decompose columns to public.todos
-- These columns are required by toDbTodo() in src/lib/dbMappers.ts
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS parent_id uuid;
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS suggested_duration integer;

-- Also ensure soft-delete and update tracking columns exist
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS updated_at timestamptz;

COMMIT;
