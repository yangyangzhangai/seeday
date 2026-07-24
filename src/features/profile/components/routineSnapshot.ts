// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/types/userProfile.ts
import type { UserProfileManualV2, UserProfileV2 } from '../../../types/userProfile';
import {
  DEFAULT_BREAKFAST,
  DEFAULT_DINNER,
  DEFAULT_LUNCH,
  DEFAULT_SLEEP_TIME,
  DEFAULT_WAKE_TIME,
  toHourText,
} from './userProfilePanelHelpers';

export interface RoutineSnapshot {
  wakeTime: string;
  sleepTime: string;
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
  reminderEnabled?: boolean;
  updatedAt?: string;
  pendingSync?: boolean;
}

const ROUTINE_STORAGE_PREFIX = 'profile:routine:v1:';
const TIME_TEXT_PATTERN = /^\d{2}:\d{2}$/;

export function getRoutineStorageKey(userId: string | null | undefined): string {
  return `${ROUTINE_STORAGE_PREFIX}${userId || 'guest'}`;
}

function isValidTimeText(value: unknown): value is string {
  return typeof value === 'string' && TIME_TEXT_PATTERN.test(value);
}

function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getRoutineSnapshotTimestamp(snapshot?: RoutineSnapshot | null): number {
  return toTimestamp(snapshot?.updatedAt);
}

export function readRoutineSnapshot(key: string): RoutineSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<RoutineSnapshot>;
    if (
      !isValidTimeText(value.wakeTime)
      || !isValidTimeText(value.sleepTime)
      || !isValidTimeText(value.breakfastTime)
      || !isValidTimeText(value.lunchTime)
      || !isValidTimeText(value.dinnerTime)
    ) {
      return null;
    }
    return {
      wakeTime: value.wakeTime,
      sleepTime: value.sleepTime,
      breakfastTime: value.breakfastTime,
      lunchTime: value.lunchTime,
      dinnerTime: value.dinnerTime,
      ...(typeof value.reminderEnabled === 'boolean' ? { reminderEnabled: value.reminderEnabled } : {}),
      ...(typeof value.updatedAt === 'string' && value.updatedAt ? { updatedAt: value.updatedAt } : {}),
      ...(value.pendingSync === true ? { pendingSync: true } : {}),
    };
  } catch {
    return null;
  }
}

export function writeRoutineSnapshot(key: string, snapshot: RoutineSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // ignore local storage write failures; cloud state still remains authoritative
  }
}

export function buildCloudRoutineSnapshot(profile: UserProfileV2 | null | undefined): RoutineSnapshot {
  const manual = profile?.manual as UserProfileManualV2 | undefined;
  const mealTimesText = Array.isArray(manual?.mealTimesText) ? manual.mealTimesText : [];
  const mealTimes = Array.isArray(manual?.mealTimes) ? manual.mealTimes : [];
  return {
    wakeTime: manual?.wakeTime || DEFAULT_WAKE_TIME,
    sleepTime: manual?.sleepTime || DEFAULT_SLEEP_TIME,
    breakfastTime: mealTimesText[0] || toHourText(mealTimes[0], DEFAULT_BREAKFAST),
    lunchTime: mealTimesText[1] || toHourText(mealTimes[1], DEFAULT_LUNCH),
    dinnerTime: mealTimesText[2] || toHourText(mealTimes[2], DEFAULT_DINNER),
    ...(typeof manual?.reminderEnabled === 'boolean' ? { reminderEnabled: manual.reminderEnabled } : {}),
    ...(profile?.updatedAt ? { updatedAt: profile.updatedAt } : {}),
  };
}

export function resolveRoutineSnapshot(
  localSnapshot: RoutineSnapshot | null,
  cloudSnapshot: RoutineSnapshot,
): { snapshot: RoutineSnapshot; source: 'local' | 'cloud' } {
  if (!localSnapshot) {
    return { snapshot: cloudSnapshot, source: 'cloud' };
  }

  const localTime = getRoutineSnapshotTimestamp(localSnapshot);
  const cloudTime = getRoutineSnapshotTimestamp(cloudSnapshot);

  if (localSnapshot.pendingSync && localTime >= cloudTime) {
    return { snapshot: localSnapshot, source: 'local' };
  }
  if (cloudTime >= localTime) {
    return { snapshot: cloudSnapshot, source: 'cloud' };
  }
  return { snapshot: localSnapshot, source: 'local' };
}

export function withRoutineSnapshotMeta(
  snapshot: RoutineSnapshot,
  options: { updatedAt: string; pendingSync: boolean },
): RoutineSnapshot {
  return {
    ...snapshot,
    updatedAt: options.updatedAt,
    pendingSync: options.pendingSync,
  };
}
