BEGIN;

CREATE TABLE IF NOT EXISTS public.live_input_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('classification', 'correction')),
  raw_input text,
  input_length integer NOT NULL DEFAULT 0 CHECK (input_length >= 0),
  kind text CHECK (kind IN ('activity', 'mood')),
  internal_kind text CHECK (internal_kind IN ('new_activity', 'activity_with_mood', 'standalone_mood', 'mood_about_last_activity')),
  confidence text CHECK (confidence IN ('high', 'medium', 'low')),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_activity_id text,
  contains_mood_signal boolean NOT NULL DEFAULT false,
  extracted_mood text,
  message_id text,
  from_kind text CHECK (from_kind IN ('activity', 'mood')),
  to_kind text CHECK (to_kind IN ('activity', 'mood')),
  session_id text,
  lang text,
  platform text,
  app_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_input_events_created_at_idx
  ON public.live_input_events (created_at DESC);

CREATE INDEX IF NOT EXISTS live_input_events_user_created_at_idx
  ON public.live_input_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS live_input_events_event_type_idx
  ON public.live_input_events (event_type);

CREATE INDEX IF NOT EXISTS live_input_events_internal_kind_idx
  ON public.live_input_events (internal_kind);

ALTER TABLE public.live_input_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_input_events_select_own" ON public.live_input_events;
CREATE POLICY "live_input_events_select_own"
  ON public.live_input_events
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "live_input_events_insert_own" ON public.live_input_events;
CREATE POLICY "live_input_events_insert_own"
  ON public.live_input_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "live_input_events_delete_own" ON public.live_input_events;
CREATE POLICY "live_input_events_delete_own"
  ON public.live_input_events
  FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
