BEGIN;

CREATE TABLE IF NOT EXISTS public.daily_plant_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  timezone text NOT NULL CHECK (length(trim(timezone)) > 0),
  root_metrics jsonb NOT NULL,
  root_type text NOT NULL CHECK (root_type IN ('tap', 'fib', 'sha', 'bra', 'bul')),
  plant_id text NOT NULL,
  plant_stage text NOT NULL CHECK (plant_stage IN ('early', 'mid', 'late')),
  is_special boolean NOT NULL DEFAULT false,
  is_support_variant boolean NOT NULL DEFAULT false,
  diary_text text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  cycle_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_plant_records_user_date_unique UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS daily_plant_records_user_generated_at_idx
  ON public.daily_plant_records (user_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS public.plant_direction_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction_index smallint NOT NULL CHECK (direction_index BETWEEN 0 AND 4),
  category_key text NOT NULL CHECK (category_key IN ('entertainment', 'social', 'work_study', 'exercise', 'life')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plant_direction_config_user_direction_unique UNIQUE (user_id, direction_index),
  CONSTRAINT plant_direction_config_user_category_unique UNIQUE (user_id, category_key)
);

ALTER TABLE public.daily_plant_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_direction_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_plant_records_select_own" ON public.daily_plant_records;
CREATE POLICY "daily_plant_records_select_own"
  ON public.daily_plant_records
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_plant_records_insert_own" ON public.daily_plant_records;
CREATE POLICY "daily_plant_records_insert_own"
  ON public.daily_plant_records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_plant_records_update_own" ON public.daily_plant_records;
CREATE POLICY "daily_plant_records_update_own"
  ON public.daily_plant_records
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_plant_records_delete_own" ON public.daily_plant_records;
CREATE POLICY "daily_plant_records_delete_own"
  ON public.daily_plant_records
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "plant_direction_config_select_own" ON public.plant_direction_config;
CREATE POLICY "plant_direction_config_select_own"
  ON public.plant_direction_config
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "plant_direction_config_insert_own" ON public.plant_direction_config;
CREATE POLICY "plant_direction_config_insert_own"
  ON public.plant_direction_config
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "plant_direction_config_update_own" ON public.plant_direction_config;
CREATE POLICY "plant_direction_config_update_own"
  ON public.plant_direction_config
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "plant_direction_config_delete_own" ON public.plant_direction_config;
CREATE POLICY "plant_direction_config_delete_own"
  ON public.plant_direction_config
  FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
