// DOC-DEPS: LLM.md -> src/api/README.md -> docs/PROACTIVE_REMINDER_SPEC.md
import { supabase } from './supabase';
import type {
  ReminderResponseDraft,
  ReminderResponseRecord,
} from '../services/reminder/reminderResponse';

interface ReminderResponseRow {
  user_id: string;
  occurrence_key: string;
  occurrence_date: string;
  reminder_type: ReminderResponseDraft['reminderType'];
  scheduled_for: string;
  response_kind: ReminderResponseDraft['responseKind'];
  responded_at: string;
}

function toDbRow(userId: string, response: ReminderResponseDraft): ReminderResponseRow {
  return {
    user_id: userId,
    occurrence_key: response.occurrenceKey,
    occurrence_date: response.occurrenceDate,
    reminder_type: response.reminderType,
    scheduled_for: response.scheduledFor,
    response_kind: response.responseKind,
    responded_at: response.respondedAt,
  };
}

function fromDbRow(row: ReminderResponseRow): ReminderResponseRecord {
  return {
    userId: row.user_id,
    occurrenceKey: row.occurrence_key,
    occurrenceDate: row.occurrence_date,
    reminderType: row.reminder_type,
    scheduledFor: row.scheduled_for,
    responseKind: row.response_kind,
    respondedAt: row.responded_at,
  };
}

export async function upsertReminderResponse(
  userId: string,
  response: ReminderResponseDraft,
): Promise<void> {
  const { error } = await supabase
    .from('reminder_responses')
    .upsert(toDbRow(userId, response), { onConflict: 'user_id,occurrence_key' });
  if (error) throw error;
}

export async function fetchReminderResponses(
  userId: string,
  occurrenceDate: string,
): Promise<ReminderResponseRecord[]> {
  const { data, error } = await supabase
    .from('reminder_responses')
    .select([
      'user_id',
      'occurrence_key',
      'occurrence_date',
      'reminder_type',
      'scheduled_for',
      'response_kind',
      'responded_at',
    ].join(','))
    .eq('user_id', userId)
    .eq('occurrence_date', occurrenceDate);
  if (error) throw error;
  return ((data ?? []) as ReminderResponseRow[]).map(fromDbRow);
}

export function parseReminderResponseRow(
  row: Record<string, unknown>,
): ReminderResponseRecord | null {
  if (
    typeof row.user_id !== 'string'
    || typeof row.occurrence_key !== 'string'
    || typeof row.occurrence_date !== 'string'
    || typeof row.reminder_type !== 'string'
    || typeof row.scheduled_for !== 'string'
    || typeof row.response_kind !== 'string'
    || typeof row.responded_at !== 'string'
  ) {
    return null;
  }
  return fromDbRow(row as unknown as ReminderResponseRow);
}
