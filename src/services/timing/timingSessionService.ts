// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/store/useTimingStore.ts
/**
 * TimingSession CRUD + 冲突处理
 *
 * 存储策略：Supabase timing_sessions 表（见 scripts/timing_sessions_schema.sql）
 * 同一时刻最多 1 个 active session（开启新 session 时自动结束旧的）
 */
import { supabase } from '../../api/supabase';

export type TimingType = 'work' | 'lunch' | 'class' | 'dinner' | 'custom';
export type TimingSource = 'reminder_confirm' | 'manual_input' | 'reminder_popup_input';

export interface TimingSession {
  id: string;
  userId: string;
  type: TimingType;
  startedAt: number;
  endedAt?: number;
  source: TimingSource;
  date: string; // 'YYYY-MM-DD'
}

// ─────────────────────────────────────────────
// DB row ↔ domain model conversion
// ─────────────────────────────────────────────

interface DbRow {
  id: string;
  user_id: string;
  type: string;
  started_at: string;
  ended_at: string | null;
  source: string;
  date: string;
}

function rowToSession(row: DbRow): TimingSession {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as TimingType,
    startedAt: new Date(row.started_at).getTime(),
    endedAt: row.ended_at ? new Date(row.ended_at).getTime() : undefined,
    source: row.source as TimingSource,
    date: row.date,
  };
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/** 开启新计时 session，自动结束当前 active session */
export async function startSession(
  userId: string,
  type: TimingType,
  source: TimingSource,
): Promise<TimingSession | null> {
  const now = new Date().toISOString();

  // 先结束所有未结束的 session（同一用户当日）
  await supabase
    .from('timing_sessions')
    .update({ ended_at: now })
    .eq('user_id', userId)
    .eq('date', todayKey())
    .is('ended_at', null);

  const { data, error } = await supabase
    .from('timing_sessions')
    .insert({
      user_id: userId,
      type,
      started_at: now,
      ended_at: null,
      source,
      date: todayKey(),
    })
    .select()
    .single();

  if (error || !data) {
    import.meta.env.DEV && console.log('[timingSession] startSession error', error);
    return null;
  }

  return rowToSession(data as DbRow);
}

/** 结束当前 active session */
export async function endActiveSession(userId: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from('timing_sessions')
    .update({ ended_at: now })
    .eq('user_id', userId)
    .eq('date', todayKey())
    .is('ended_at', null);
}

/** 获取今日所有 session */
export async function fetchTodaySessions(userId: string): Promise<TimingSession[]> {
  const { data, error } = await supabase
    .from('timing_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('date', todayKey())
    .order('started_at', { ascending: true });

  if (error || !data) return [];
  return (data as DbRow[]).map(rowToSession);
}

/** 获取当前 active session（ended_at 为 null） */
export async function fetchActiveSession(userId: string): Promise<TimingSession | null> {
  const { data, error } = await supabase
    .from('timing_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('date', todayKey())
    .is('ended_at', null)
    .maybeSingle();

  if (error || !data) return null;
  return rowToSession(data as DbRow);
}
