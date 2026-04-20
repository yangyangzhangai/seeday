// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/README.md
import { supabase } from '../api/supabase';
import { isLegacyChatActivityType } from '../lib/activityType';
import { withDbRetry } from '../lib/dbRetry';

function toLocalDateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function fetchActivityStreak(userId: string, force = false): Promise<number> {
  const today = toLocalDateStr(Date.now());
  const dateKey = `streakDate_${userId}`;
  const valueKey = `streakValue_${userId}`;

  if (!force && localStorage.getItem(dateKey) === today) {
    const cached = localStorage.getItem(valueKey);
    return cached !== null ? Number(cached) : 0;
  }

  try {
    const { data } = await supabase
      .from('messages')
      .select('timestamp, activity_type')
      .eq('user_id', userId)
      .eq('is_mood', false);

    if (!data) return 0;
    const dates = new Set(
      data
        .filter((row) => !isLegacyChatActivityType(row.activity_type))
        .map((row) => toLocalDateStr(Number(row.timestamp))),
    );

    let streak = 0;
    const d = new Date();
    while (dates.has(toLocalDateStr(d.getTime()))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }

    localStorage.setItem(dateKey, today);
    localStorage.setItem(valueKey, String(streak));
    return streak;
  } catch {
    return 0;
  }
}

export async function updateLoginStreak(userId: string): Promise<void> {
  await withDbRetry('AuthStore:loginStreak', async () => {
    const today = toLocalDateStr(Date.now());
    const { data } = await supabase
      .from('user_stats')
      .select('login_streak, last_login_date')
      .eq('user_id', userId)
      .maybeSingle();

    if (data?.last_login_date === today) return;

    const yesterday = toLocalDateStr(Date.now() - 86_400_000);
    const newStreak = data?.last_login_date === yesterday ? (data.login_streak ?? 0) + 1 : 1;

    const { error } = await supabase.from('user_stats').upsert(
      { user_id: userId, login_streak: newStreak, last_login_date: today, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    if (error) throw new Error(error.message);
  });
}
