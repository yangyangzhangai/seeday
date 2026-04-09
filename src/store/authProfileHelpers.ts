// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/types/userProfile.ts
import type { UserProfileV2 } from '../types/userProfile';

export const USER_PROFILE_METADATA_KEY = 'user_profile_v2';
export const LONG_TERM_PROFILE_ENABLED_KEY = 'long_term_profile_enabled';
const PRIMARY_USE_VALUES = new Set(['life_record', 'organize_thoughts', 'emotion_management', 'habit_building']);
const LIFE_STAGE_VALUES = new Set(['student', 'employed', 'freelance', 'other']);

function normalizeMealTimes(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const normalized = raw
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item >= 0 && item <= 23)
    .map((item) => Math.floor(item));
  if (normalized.length === 0) return undefined;
  return Array.from(new Set(normalized));
}

function sanitizeManual(raw: unknown): UserProfileV2['manual'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const value = raw as Record<string, unknown>;
  const mealTimes = normalizeMealTimes(value.mealTimes);
  const primaryUse = typeof value.primaryUse === 'string' && PRIMARY_USE_VALUES.has(value.primaryUse)
    ? (value.primaryUse as UserProfileV2['manual']['primaryUse'])
    : undefined;
  const lifeStage = typeof value.lifeStage === 'string' && LIFE_STAGE_VALUES.has(value.lifeStage)
    ? (value.lifeStage as UserProfileV2['manual']['lifeStage'])
    : undefined;
  return {
    ...(primaryUse ? { primaryUse } : {}),
    ...(lifeStage ? { lifeStage } : {}),
    ...(typeof value.wakeTime === 'string' ? { wakeTime: value.wakeTime } : {}),
    ...(typeof value.sleepTime === 'string' ? { sleepTime: value.sleepTime } : {}),
    ...(mealTimes ? { mealTimes } : {}),
    ...(typeof value.currentGoal === 'string' ? { currentGoal: value.currentGoal } : {}),
    ...(typeof value.lifeGoal === 'string' ? { lifeGoal: value.lifeGoal } : {}),
    ...(Array.isArray(value.tags) ? { tags: value.tags.filter((tag): tag is string => typeof tag === 'string') } : {}),
    ...(typeof value.freeText === 'string' ? { freeText: value.freeText } : {}),
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
