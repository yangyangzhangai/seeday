import { supabase } from '../api/supabase';
import { ACTIVITY_RECORD_TYPES, isLegacyChatActivityType, normalizeActivityType } from '../lib/activityType';

export function queueBackfillLegacyActivityTypes(
  rows: Array<{ id: string; content: string; activity_type?: string | null }>,
  userId: string,
): void {
  const validTypes = new Set<string>([...ACTIVITY_RECORD_TYPES, 'mood']);
  rows.forEach((row) => {
    const current = row.activity_type?.trim().toLowerCase();
    if (isLegacyChatActivityType(current)) {
      return;
    }
    if (!current || !validTypes.has(current)) {
      void supabase
        .from('messages')
        .update({ activity_type: normalizeActivityType(row.activity_type, row.content) })
        .eq('id', row.id)
        .eq('user_id', userId);
    }
  });
}
