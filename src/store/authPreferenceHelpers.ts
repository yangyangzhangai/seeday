import type { AiCompanionMode } from '../lib/aiCompanion';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';

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

let queuedPreferenceSnapshot: UserPreferencesSnapshot | null = null;
let isFlushingPreferenceSnapshot = false;

async function flushQueuedPreferences(): Promise<void> {
  if (isFlushingPreferenceSnapshot) return;
  isFlushingPreferenceSnapshot = true;
  try {
    while (queuedPreferenceSnapshot) {
      const snapshot = queuedPreferenceSnapshot;
      queuedPreferenceSnapshot = null;
      const latestSession = await getSupabaseSession();
      const baseMeta = (latestSession?.user?.user_metadata || {}) as Record<string, any>;
      const { error } = await supabase.auth.updateUser({
        data: {
          ...baseMeta,
          ai_mode: snapshot.aiMode,
          ai_mode_enabled: snapshot.aiModeEnabled,
          daily_goal_enabled: snapshot.dailyGoalEnabled,
          annotation_drop_rate: snapshot.annotationDropRate,
        },
      });
      if (error) {
        console.error('[updatePreferences] supabase error:', error);
      }
    }
  } finally {
    isFlushingPreferenceSnapshot = false;
    if (queuedPreferenceSnapshot) {
      void flushQueuedPreferences();
    }
  }
}

export function queuePreferenceSnapshot(snapshot: UserPreferencesSnapshot): void {
  queuedPreferenceSnapshot = snapshot;
  void flushQueuedPreferences();
}

export function preferencesFromMeta(meta: Record<string, any>): UserPreferencesSnapshot {
  const rawAiMode = meta.ai_mode;
  const normalizedAiMode: AiCompanionMode = (
    typeof rawAiMode === 'string' && (SUPPORTED_AI_MODES as string[]).includes(rawAiMode)
      ? rawAiMode
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
