-- timing_sessions 表
-- 用于存储 ProactiveReminder 系统的自动计时记录（见 PROACTIVE_REMINDER_SPEC.md §4.6）
-- 同一用户同一天最多 1 个 ended_at IS NULL 的行（active session）

CREATE TABLE IF NOT EXISTS public.timing_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('work','lunch','class','dinner','custom')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  source      text        NOT NULL CHECK (source IN ('reminder_confirm','manual_input','reminder_popup_input')),
  date        date        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 按用户+日期查询（最常用路径）
CREATE INDEX IF NOT EXISTS timing_sessions_user_date_idx
  ON public.timing_sessions (user_id, date);

-- RLS：只允许本人读写自己的记录
ALTER TABLE public.timing_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timing_sessions_select_own"
  ON public.timing_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "timing_sessions_insert_own"
  ON public.timing_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "timing_sessions_update_own"
  ON public.timing_sessions FOR UPDATE
  USING (auth.uid() = user_id);
