-- DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/PROJECT_MAP.md
-- Apply on Supabase SQL editor when enabling plant image fallback telemetry.

CREATE TABLE IF NOT EXISTS public.plant_asset_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_plant_id text NOT NULL,
  resolved_asset_url text NOT NULL,
  fallback_level smallint NOT NULL CHECK (fallback_level BETWEEN 1 AND 4),
  root_type text NOT NULL,
  plant_stage text NOT NULL,
  lang text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plant_asset_events_created_at_idx
  ON public.plant_asset_events (created_at DESC);

CREATE INDEX IF NOT EXISTS plant_asset_events_user_created_at_idx
  ON public.plant_asset_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS plant_asset_events_fallback_level_idx
  ON public.plant_asset_events (fallback_level);

ALTER TABLE public.plant_asset_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plant_asset_events_select_own" ON public.plant_asset_events;
CREATE POLICY "plant_asset_events_select_own"
  ON public.plant_asset_events
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "plant_asset_events_insert_own" ON public.plant_asset_events;
CREATE POLICY "plant_asset_events_insert_own"
  ON public.plant_asset_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
