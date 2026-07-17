import i18next from 'i18next';
import { useChatStore } from '../../store/useChatStore';
import { useReminderStore } from '../../store/useReminderStore';
import { useTimingStore } from '../../store/useTimingStore';
import type { ReminderType } from './reminderTypes';
import type { TimingType } from '../timing/timingSessionService';

export type ReminderTimingAction =
  | { kind: 'start'; type: TimingType }
  | { kind: 'end' }
  | null;

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
): Promise<void> {
  const reminderStore = useReminderStore.getState();
  if (reminderStore.shouldSkipReminder(reminderType)) return;
  reminderStore.markConfirmed(reminderType);
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
  options?: { reminderType?: ReminderType; userId?: string | null },
): Promise<boolean> {
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }

  if (options?.reminderType) {
    await applyReminderTimingAction(options.reminderType, options.userId);
    useReminderStore.getState().markConfirmed(options.reminderType);
  }

  await useChatStore.getState().sendMessage(trimmed);
  return true;
}
