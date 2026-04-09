// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/types/userProfile.ts
import type { PrimaryUse, UserProfileManual, VisibleAnniversary } from '../../../types/userProfile';

export interface AnniversaryDraft {
  id: string;
  label: string;
  dateInput: string;
  repeating: boolean;
  source: 'user' | 'ai_auto';
  createdAt: string;
}

export const DEFAULT_WAKE_TIME = '07:30';
export const DEFAULT_SLEEP_TIME = '23:00';
export const DEFAULT_BREAKFAST = '08:00';
export const DEFAULT_LUNCH = '12:30';
export const DEFAULT_DINNER = '18:30';
export const MAX_ANNIVERSARIES = 10;

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isMonthDay(value: string): boolean {
  return /^\d{2}-\d{2}$/.test(value);
}

function monthDayToInputDate(monthDay: string): string {
  const now = new Date();
  const year = now.getFullYear();
  return `${year}-${monthDay}`;
}

export function toHour(timeText: string): number | null {
  const match = timeText.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  return Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

export function toHourText(hour: number | undefined, fallback: string): string {
  if (!Number.isFinite(hour)) return fallback;
  return `${String(Math.max(0, Math.min(23, Number(hour)))).padStart(2, '0')}:00`;
}

export function toAnniversaryDrafts(items: VisibleAnniversary[] | undefined): AnniversaryDraft[] {
  if (!items?.length) return [];
  return items.map((item, index) => ({
    id: item.id || `ann-${index}`,
    label: item.label || '',
    dateInput: isIsoDate(item.date)
      ? item.date
      : isMonthDay(item.date)
      ? monthDayToInputDate(item.date)
      : '',
    repeating: item.repeating || isMonthDay(item.date),
    source: item.source === 'ai_auto' ? 'ai_auto' : 'user',
    createdAt: item.createdAt || new Date().toISOString(),
  }));
}

export function createAnniversaryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildManualPayload(
  prevManual: UserProfileManual | undefined,
  values: {
    primaryUse: PrimaryUse | '';
    wakeTime: string;
    sleepTime: string;
    mealHours: number[];
    currentGoal: string;
    lifeGoal: string;
  },
): UserProfileManual {
  return {
    ...(prevManual || {}),
    primaryUse: values.primaryUse || undefined,
    wakeTime: values.wakeTime || undefined,
    sleepTime: values.sleepTime || undefined,
    mealTimes: values.mealHours.length ? values.mealHours : undefined,
    currentGoal: values.currentGoal.trim() || undefined,
    lifeGoal: values.lifeGoal.trim() || undefined,
  };
}

export function buildAnniversariesPayload(anniversaries: AnniversaryDraft[]): VisibleAnniversary[] {
  return anniversaries
    .filter((item) => item.label.trim() && item.dateInput)
    .map((item) => ({
      id: item.id || createAnniversaryId(),
      label: item.label.trim(),
      date: item.repeating ? item.dateInput.slice(5) : item.dateInput,
      repeating: item.repeating,
      source: item.source,
      createdAt: item.createdAt || new Date().toISOString(),
    }));
}

export function hasPartialAnniversaryDraft(anniversaries: AnniversaryDraft[]): boolean {
  return anniversaries.some((item) => {
    const hasLabel = item.label.trim().length > 0;
    const hasDate = item.dateInput.length > 0;
    return hasLabel !== hasDate;
  });
}
