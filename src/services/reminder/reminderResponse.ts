// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/services/reminder/reminderTypes.ts
import { toLocalDateStr } from '../../lib/dateUtils';
import type { ReminderType } from './reminderTypes';

export type ReminderResponseKind =
  | 'confirm'
  | 'manual'
  | 'view_report'
  | 'grow_plant'
  | 'snooze'
  | 'close';

export interface ReminderOccurrence {
  occurrenceKey: string;
  occurrenceDate: string;
  scheduledFor: string;
}

export interface ReminderResponseDraft extends ReminderOccurrence {
  reminderType: ReminderType;
  responseKind: ReminderResponseKind;
  respondedAt: string;
}

export interface ReminderResponseRecord extends ReminderResponseDraft {
  userId: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function buildReminderOccurrence(
  reminderType: ReminderType,
  scheduledAt: Date,
): ReminderOccurrence {
  const occurrenceDate = toLocalDateStr(scheduledAt);
  const localTime = `${pad(scheduledAt.getHours())}${pad(scheduledAt.getMinutes())}`;
  return {
    occurrenceKey: `${occurrenceDate}:${reminderType}:${localTime}`,
    occurrenceDate,
    scheduledFor: scheduledAt.toISOString(),
  };
}

export function resolveReminderOccurrence(
  reminderType: ReminderType,
  occurrence?: Partial<ReminderOccurrence> | null,
): ReminderOccurrence {
  if (
    occurrence?.occurrenceKey
    && occurrence.occurrenceDate
    && occurrence.scheduledFor
  ) {
    return occurrence as ReminderOccurrence;
  }
  return buildReminderOccurrence(reminderType, new Date());
}

export function isOccurrenceForType(
  occurrenceKey: string,
  reminderType: ReminderType,
): boolean {
  return occurrenceKey.includes(`:${reminderType}:`);
}
