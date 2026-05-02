import type { AiCompanionMode } from '../lib/aiCompanion';
import { useOutboxStore } from './useOutboxStore';

export type AnnotationDropRateSnapshot = 'low' | 'medium' | 'high';

export interface UserPreferencesSnapshot {
  aiMode: AiCompanionMode;
  aiModeEnabled: boolean;
  dailyGoalEnabled: boolean;
  annotationDropRate: AnnotationDropRateSnapshot;
}

const SUPPORTED_AI_MODES: AiCompanionMode[] = ['van', 'agnes', 'zep', 'momo'];
const DEFAULT_FREE_AI_MODE: AiCompanionMode = 'van';

export const DEFAULT_PREFERENCES: UserPreferencesSnapshot = {
  aiMode: DEFAULT_FREE_AI_MODE,
  aiModeEnabled: true,
  dailyGoalEnabled: true,
  annotationDropRate: 'low',
};

export function queuePreferenceSnapshot(snapshot: UserPreferencesSnapshot): void {
  useOutboxStore.getState().enqueue({
    kind: 'preference.upsert',
    payload: {
      ai_mode: snapshot.aiMode,
      ai_mode_enabled: snapshot.aiModeEnabled,
      daily_goal_enabled: snapshot.dailyGoalEnabled,
      annotation_drop_rate: snapshot.annotationDropRate,
    },
    consecutiveFailures: 0,
  });
}

export function preferencesFromMeta(meta: Record<string, any>): UserPreferencesSnapshot {
  const rawAiMode = meta.ai_mode;
  const normalizedAiMode: AiCompanionMode = (
    typeof rawAiMode === 'string' && SUPPORTED_AI_MODES.includes(rawAiMode as AiCompanionMode)
      ? rawAiMode as AiCompanionMode
      : DEFAULT_FREE_AI_MODE
  );

  const rawDropRate = meta.annotation_drop_rate;
  const normalizedDropRate: AnnotationDropRateSnapshot = (
    rawDropRate === 'low' || rawDropRate === 'medium' || rawDropRate === 'high'
      ? rawDropRate
      : 'low'
  );

  return {
    aiMode: normalizedAiMode,
    aiModeEnabled: meta.ai_mode_enabled ?? true,
    dailyGoalEnabled: meta.daily_goal_enabled ?? true,
    annotationDropRate: normalizedDropRate,
  };
}

export function normalizePreferencesForMembership(
  preferences: UserPreferencesSnapshot,
  isPlus: boolean,
): UserPreferencesSnapshot {
  if (isPlus) return preferences;

  const nextAiMode = preferences.aiMode === DEFAULT_FREE_AI_MODE
    ? preferences.aiMode
    : DEFAULT_FREE_AI_MODE;
  const nextAnnotationDropRate = preferences.annotationDropRate === 'low'
    ? preferences.annotationDropRate
    : 'low';

  if (
    nextAiMode === preferences.aiMode
    && nextAnnotationDropRate === preferences.annotationDropRate
  ) {
    return preferences;
  }

  return {
    ...preferences,
    aiMode: nextAiMode,
    annotationDropRate: nextAnnotationDropRate,
  };
}
