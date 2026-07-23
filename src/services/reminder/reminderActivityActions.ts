import i18next from 'i18next';
import { toLocalDateStr } from '../../lib/dateUtils';
import { useChatStore } from '../../store/useChatStore';
import { useReminderStore } from '../../store/useReminderStore';
import { useTimingStore } from '../../store/useTimingStore';
import type { ReminderType } from './reminderTypes';
import type { ReminderOccurrence } from './reminderResponse';
import type { TimingType } from '../timing/timingSessionService';

export type ReminderTimingAction =
  | { kind: 'start'; type: TimingType }
  | { kind: 'end' }
  | null;

const CONFIRM_DEDUPE_WINDOW_MS = 10_000;
const recentConfirmationClaims = new Map<string, number>();

function getConfirmationClaimKey(
  reminderType: ReminderType,
  userId?: string | null,
  occurrenceKey?: string,
): string {
  return occurrenceKey
    ? `${userId ?? 'guest'}:${occurrenceKey}`
    : `${toLocalDateStr(new Date())}:${userId ?? 'guest'}:${reminderType}`;
}

function claimReminderConfirmation(
  reminderType: ReminderType,
  userId?: string | null,
  occurrenceKey?: string,
): boolean {
  const now = Date.now();
  const key = getConfirmationClaimKey(reminderType, userId, occurrenceKey);
  const previousClaim = recentConfirmationClaims.get(key);
  if (previousClaim !== undefined && now - previousClaim < CONFIRM_DEDUPE_WINDOW_MS) {
    return false;
  }
  recentConfirmationClaims.set(key, now);
  return true;
}

export function rearmReminderConfirmationGuards(
  reminderTypes: ReminderType[],
  userId?: string | null,
): void {
  reminderTypes.forEach((type) => {
    recentConfirmationClaims.delete(getConfirmationClaimKey(type, userId));
  });
}

export function getTimingAction(reminderType: ReminderType): ReminderTimingAction {
  switch (reminderType) {
    case 'work_start':
    case 'class_morning_start':
    case 'class_afternoon_start':
    case 'class_evening_start':
      return { kind: 'start', type: 'work' };
    case 'lunch_start':
    case 'meal_lunch':
      return { kind: 'start', type: 'lunch' };
    case 'lunch_end':
      return { kind: 'start', type: 'work' };
    case 'work_end':
    case 'class_morning_end':
    case 'class_afternoon_end':
    case 'class_evening_end':
      return { kind: 'end' };
    case 'meal_dinner':
      return { kind: 'start', type: 'dinner' };
    case 'sleep':
      return { kind: 'end' };
    default:
      return null;
  }
}

export function getActivityTextForType(type: ReminderType): string | null {
  const key = `reminder_activity_${type}`;
  const translated = i18next.t(key, { defaultValue: '' });
  return translated || null;
}

export async function applyReminderTimingAction(
  reminderType: ReminderType,
  userId?: string | null,
): Promise<void> {
  const action = getTimingAction(reminderType);
  if (!action || !userId) {
    return;
  }

  const timing = useTimingStore.getState();
  if (action.kind === 'start') {
    await timing.start(userId, action.type, 'reminder_confirm');
    return;
  }

  await timing.endActive(userId);
}

export async function confirmReminderActivity(
  reminderType: ReminderType,
  userId?: string | null,
  occurrence?: ReminderOccurrence,
): Promise<void> {
  if (!claimReminderConfirmation(reminderType, userId, occurrence?.occurrenceKey)) return;
  const reminderStore = useReminderStore.getState();
  if (reminderStore.shouldSkipReminder(reminderType, occurrence?.occurrenceKey)) return;
  void reminderStore.recordResponse(reminderType, {
    userId,
    responseKind: 'confirm',
    occurrence,
  });
  await applyReminderTimingAction(reminderType, userId);

  const activityText = getActivityTextForType(reminderType);
  if (activityText) {
    await useChatStore.getState().sendAutoRecognizedInput(activityText, {
      skipTimingEnd: true,
    });
  }
}

export async function submitReminderManualActivity(
  content: string,
  options?: {
    reminderType?: ReminderType;
    userId?: string | null;
    occurrence?: ReminderOccurrence;
  },
): Promise<boolean> {
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }

  if (options?.reminderType) {
    await applyReminderTimingAction(options.reminderType, options.userId);
    void useReminderStore.getState().recordResponse(options.reminderType, {
      userId: options.userId,
      responseKind: 'manual',
      occurrence: options.occurrence,
    });
  }

  await useChatStore.getState().sendMessage(trimmed);
  return true;
}
