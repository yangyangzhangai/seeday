// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/types/userProfile.ts
import type { UserProfileV2, UserProfileManualV2 } from '../types/userProfile';

export const USER_PROFILE_METADATA_KEY = 'user_profile_v2';
export const LONG_TERM_PROFILE_ENABLED_KEY = 'long_term_profile_enabled';
const PRIMARY_USE_VALUES = new Set(['life_record', 'organize_thoughts', 'emotion_management', 'habit_building']);
const LIFE_STAGE_VALUES = new Set(['student', 'employed', 'freelance', 'other']);
const TIME_TEXT_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeTimeText(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  return TIME_TEXT_PATTERN.test(value) ? value : undefined;
}

function normalizeMealTimes(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const normalized = raw
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item >= 0 && item <= 23)
    .map((item) => Math.floor(item));
  if (normalized.length === 0) return undefined;
  return Array.from(new Set(normalized));
}

function normalizeMealTimesText(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const normalized = raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => TIME_TEXT_PATTERN.test(item));
  if (normalized.length === 0) return undefined;
  return normalized;
}

function normalizeClassSchedule(raw: unknown): UserProfileManualV2['classSchedule'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const value = raw as Record<string, unknown>;

  const weekdays = Array.isArray(value.weekdays)
    ? Array.from(new Set(
      value.weekdays
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6),
    ))
    : [1, 2, 3, 4, 5];

  const normalizeRange = (input: unknown) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
    const range = input as Record<string, unknown>;
    const start = normalizeTimeText(range.start);
    const end = normalizeTimeText(range.end);
    if (!start || !end) return undefined;
    return { start, end };
  };

  const morning = normalizeRange(value.morning);
  const afternoon = normalizeRange(value.afternoon);
  const evening = normalizeRange(value.evening);

  if (!morning && !afternoon && !evening) return undefined;

  return {
    weekdays,
    ...(morning ? { morning } : {}),
    ...(afternoon ? { afternoon } : {}),
    ...(evening ? { evening } : {}),
  };
}

function sanitizeManual(raw: unknown): UserProfileManualV2 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const value = raw as Record<string, unknown>;
  const mealTimes = normalizeMealTimes(value.mealTimes);
  const mealTimesText = normalizeMealTimesText(value.mealTimesText);
  const classSchedule = normalizeClassSchedule(value.classSchedule);
  const wakeTime = normalizeTimeText(value.wakeTime);
  const sleepTime = normalizeTimeText(value.sleepTime);
  const workStart = normalizeTimeText(value.workStart);
  const workEnd = normalizeTimeText(value.workEnd);
  const lunchStart = normalizeTimeText(value.lunchStart);
  const lunchEnd = normalizeTimeText(value.lunchEnd);
  const lunchTime = normalizeTimeText(value.lunchTime);
  const dinnerTime = normalizeTimeText(value.dinnerTime);
  const primaryUse = typeof value.primaryUse === 'string' && PRIMARY_USE_VALUES.has(value.primaryUse)
    ? (value.primaryUse as UserProfileV2['manual']['primaryUse'])
    : undefined;
  const lifeStage = typeof value.lifeStage === 'string' && LIFE_STAGE_VALUES.has(value.lifeStage)
    ? (value.lifeStage as UserProfileV2['manual']['lifeStage'])
    : undefined;
  const classSchedule = sanitizeClassSchedule(value.classSchedule);
  return {
    ...(primaryUse ? { primaryUse } : {}),
    ...(lifeStage ? { lifeStage } : {}),
    ...(wakeTime ? { wakeTime } : {}),
    ...(sleepTime ? { sleepTime } : {}),
    ...(mealTimes ? { mealTimes } : {}),
    ...(mealTimesText ? { mealTimesText } : {}),
    ...(typeof value.hasWorkSchedule === 'boolean' ? { hasWorkSchedule: value.hasWorkSchedule } : {}),
    ...(typeof value.hasClassSchedule === 'boolean' ? { hasClassSchedule: value.hasClassSchedule } : {}),
    ...(workStart ? { workStart } : {}),
    ...(workEnd ? { workEnd } : {}),
    ...(lunchStart ? { lunchStart } : {}),
    ...(lunchEnd ? { lunchEnd } : {}),
    ...(lunchTime ? { lunchTime } : {}),
    ...(dinnerTime ? { dinnerTime } : {}),
    ...(typeof value.reminderEnabled === 'boolean' ? { reminderEnabled: value.reminderEnabled } : {}),
    ...(classSchedule ? { classSchedule } : {}),
    ...(value.classScheduleSource === 'image' || value.classScheduleSource === 'manual'
      ? { classScheduleSource: value.classScheduleSource }
      : {}),
    ...(typeof value.currentGoal === 'string' ? { currentGoal: value.currentGoal } : {}),
    ...(typeof value.lifeGoal === 'string' ? { lifeGoal: value.lifeGoal } : {}),
    ...(Array.isArray(value.tags) ? { tags: value.tags.filter((tag): tag is string => typeof tag === 'string') } : {}),
    ...(typeof value.freeText === 'string' ? { freeText: value.freeText } : {}),
    // V2 作息调度字段
    ...(typeof value.hasWorkSchedule === 'boolean' ? { hasWorkSchedule: value.hasWorkSchedule } : {}),
    ...(typeof value.hasClassSchedule === 'boolean' ? { hasClassSchedule: value.hasClassSchedule } : {}),
    ...(isHHMM(value.workStart) ? { workStart: value.workStart } : {}),
    ...(isHHMM(value.workEnd) ? { workEnd: value.workEnd } : {}),
    ...(isHHMM(value.lunchStart) ? { lunchStart: value.lunchStart } : {}),
    ...(isHHMM(value.lunchEnd) ? { lunchEnd: value.lunchEnd } : {}),
    ...(isHHMM(value.lunchTime) ? { lunchTime: value.lunchTime } : {}),
    ...(isHHMM(value.dinnerTime) ? { dinnerTime: value.dinnerTime } : {}),
    ...(classSchedule ? { classSchedule } : {}),
    ...(typeof value.classScheduleSource === 'string' ? { classScheduleSource: value.classScheduleSource as 'image' | 'manual' } : {}),
    ...(typeof value.reminderEnabled === 'boolean' ? { reminderEnabled: value.reminderEnabled } : {}),
  };
}

function sanitizeVisibleAnniversaries(raw: unknown): UserProfileV2['anniversariesVisible'] {
  if (!Array.isArray(raw)) return undefined;
  const validItems = raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .filter((item) => typeof item.label === 'string' && item.label.trim().length > 0)
    .filter((item) => typeof item.date === 'string' && item.date.length > 0)
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: String(item.label),
      date: String(item.date),
      repeating: item.repeating === true,
      source: item.source === 'ai_auto' ? 'ai_auto' : 'user',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    }));
  return validItems.length > 0 ? validItems : undefined;
}

function sanitizeHiddenMoments(raw: unknown): UserProfileV2['hiddenMoments'] {
  if (!Array.isArray(raw)) return undefined;
  const validItems = raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .filter((item) => typeof item.title === 'string' && typeof item.date === 'string' && typeof item.summary === 'string')
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : `moment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: item.kind === 'first_time' || item.kind === 'highlight' || item.kind === 'lowlight' || item.kind === 'milestone'
        ? item.kind
        : 'highlight',
      title: String(item.title),
      date: String(item.date),
      summary: String(item.summary),
      sourceMessageIds: Array.isArray(item.sourceMessageIds)
        ? item.sourceMessageIds.filter((value): value is string => typeof value === 'string')
        : [],
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    }));
  return validItems.length > 0 ? validItems : undefined;
}

export function parseUserProfileV2(raw: unknown): UserProfileV2 | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Partial<UserProfileV2>;
  return {
    ...value,
    manual: sanitizeManual(value.manual),
    anniversariesVisible: sanitizeVisibleAnniversaries(value.anniversariesVisible),
    hiddenMoments: sanitizeHiddenMoments(value.hiddenMoments),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  } as UserProfileV2;
}

export function resolveLongTermProfileEnabled(meta: Record<string, any>): boolean {
  return meta[LONG_TERM_PROFILE_ENABLED_KEY] === true;
}

export function profileStateFromMeta(meta: Record<string, any>): {
  longTermProfileEnabled: boolean;
  userProfileV2: UserProfileV2 | null;
} {
  return {
    longTermProfileEnabled: resolveLongTermProfileEnabled(meta),
    userProfileV2: parseUserProfileV2(meta[USER_PROFILE_METADATA_KEY]),
  };
}

const PENDING_PROFILE_PREFIX = 'seeday_pending_profile_v2_';

export function savePendingProfileWrite(userId: string, profile: UserProfileV2): void {
  try {
    window.localStorage.setItem(PENDING_PROFILE_PREFIX + userId, JSON.stringify(profile));
  } catch { /* storage full or unavailable — silent */ }
}

export function getPendingProfileWrite(userId: string): UserProfileV2 | null {
  try {
    const raw = window.localStorage.getItem(PENDING_PROFILE_PREFIX + userId);
    return parseUserProfileV2(raw ? JSON.parse(raw) : null);
  } catch {
    return null;
  }
}

export function clearPendingProfileWrite(userId: string): void {
  try {
    window.localStorage.removeItem(PENDING_PROFILE_PREFIX + userId);
  } catch { /* silent */ }
}

export function mergeUserProfile(
  prev: UserProfileV2 | null,
  partial: Partial<UserProfileV2>,
): UserProfileV2 {
  const nowIso = new Date().toISOString();
  return {
    manual: {
      ...(prev?.manual || {}),
      ...(partial.manual || {}),
    },
    observed: partial.observed ?? prev?.observed,
    dynamicSignals: partial.dynamicSignals ?? prev?.dynamicSignals,
    anniversariesVisible: partial.anniversariesVisible ?? prev?.anniversariesVisible,
    hiddenMoments: partial.hiddenMoments ?? prev?.hiddenMoments,
    onboardingCompleted: partial.onboardingCompleted ?? prev?.onboardingCompleted,
    lastExtractedAt: partial.lastExtractedAt ?? prev?.lastExtractedAt,
    createdAt: prev?.createdAt || partial.createdAt || nowIso,
    updatedAt: partial.updatedAt || nowIso,
  };
}
