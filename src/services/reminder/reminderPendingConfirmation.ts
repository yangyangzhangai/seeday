// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/services/reminder/reminderResponse.ts
import type { ReminderOccurrence } from './reminderResponse';
import type { ReminderType } from './reminderTypes';

const PENDING_NOTIFICATION_CONFIRM_MAX_AGE = 10 * 60 * 1000;

interface PendingNotificationConfirm {
  type: ReminderType;
  occurrence?: ReminderOccurrence;
}

export function queuePendingNotificationConfirm(
  pending: PendingNotificationConfirm,
  storageKey: string,
): void {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ ...pending, createdAt: Date.now() }),
    );
  } catch {
    // ignore localStorage failures
  }
}

export function consumePendingNotificationConfirm(
  storageKey: string,
): PendingNotificationConfirm | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    localStorage.removeItem(storageKey);
    const parsed = JSON.parse(raw) as PendingNotificationConfirm & { createdAt?: number };
    if (!parsed?.type || typeof parsed.createdAt !== 'number') return null;
    if (Date.now() - parsed.createdAt > PENDING_NOTIFICATION_CONFIRM_MAX_AGE) return null;
    return { type: parsed.type, occurrence: parsed.occurrence };
  } catch {
    return null;
  }
}
