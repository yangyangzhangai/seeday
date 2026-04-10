// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/AI批注回复_行为角色状态映射_开发落地方案_v1.md
import {
  BEHAVIOR_BY_ID,
  BEHAVIOR_EFFECT_CONFIG,
  type BehaviorEffectConfig,
  TEA_SUBTYPE_CONFIG,
} from './behavior-map';
import { detectBehaviors, type MatchedBehavior } from './behavior-matcher';
import {
  CATEGORY_PRIORITY,
  CHARACTER_STATE_MAX_INJECT,
  type CharacterStateBuildInput,
  type CharacterStateBuildOutput,
} from './constants';
import {
  addOrRefreshActiveEffect,
  decayAndPruneActiveEffects,
  getActiveEffectScore,
  consumeDueDelayedBehaviors,
  getSevenDayDensity,
  getStreakOnActiveDays,
  getTodayFromNow,
  listActiveBehaviorIds,
  scheduleDelayedBehavior,
  withRecordedHistory,
} from './event-tracker';

interface CandidateState {
  behaviorId: string;
  text: string;
  score: number;
  level: 'instant' | 'trend' | 'lite';
  isTrend: boolean;
  isLite: boolean;
}

function pickTextForBehavior(
  behaviorId: string,
  aiMode: CharacterStateBuildInput['aiMode'],
  tracker: CharacterStateBuildInput['tracker'],
  today: string,
  effectScore: number,
  matched?: MatchedBehavior,
): CandidateState | null {
  if (behaviorId === 'B06' && matched?.teaSubtype) {
    const teaConfig = TEA_SUBTYPE_CONFIG[matched.teaSubtype];
    if (teaConfig.target !== aiMode) return null;
    return {
      behaviorId,
      text: teaConfig.text,
      score: 1000,
      level: 'instant',
      isTrend: false,
      isLite: false,
    };
  }

  const behavior = BEHAVIOR_BY_ID.get(behaviorId);
  if (!behavior || !behavior.targets.includes(aiMode)) return null;

  const density = getSevenDayDensity(tracker, behaviorId, today);
  const densityLite = (behavior.decayType === 'high' && density >= 4)
    || (behavior.decayType === 'mid' && density >= 3);
  const scoreLite = effectScore > 0 && effectScore < 0.55;
  const useLite = densityLite || scoreLite;
  const streak = getStreakOnActiveDays(tracker, behaviorId);
  const useTrend = !useLite && streak >= 3;
  const text = useLite
    ? (behavior.lite?.[aiMode] || behavior.instant[aiMode])
    : (useTrend ? behavior.trend[aiMode] : behavior.instant[aiMode]);

  if (!text) return null;

  return {
    behaviorId,
    text,
    score: (CATEGORY_PRIORITY[behavior.category] || 0) + behavior.priority + Math.round(effectScore * 100),
    level: useLite ? 'lite' : (useTrend ? 'trend' : 'instant'),
    isTrend: useTrend,
    isLite: useLite,
  };
}

function getEffectConfig(behaviorId: string): BehaviorEffectConfig {
  return BEHAVIOR_EFFECT_CONFIG[behaviorId] || { baseScore: 1.0, maxScore: 2.5, ttlHours: 24, halfLifeHours: 9 };
}

function sortByPriority(states: CandidateState[]): CandidateState[] {
  return [...states].sort((a, b) => b.score - a.score);
}

export function buildCharacterState(input: CharacterStateBuildInput): CharacterStateBuildOutput {
  const today = getTodayFromNow(input.now);
  const matched = detectBehaviors(input.text, input.durationMinutes);
  const matchedIds = matched.map((item) => item.behaviorId);

  let tracker = withRecordedHistory(input.tracker, matchedIds, input.now);
  tracker = decayAndPruneActiveEffects(tracker, input.now);

  for (const behaviorId of matchedIds) {
    const behavior = BEHAVIOR_BY_ID.get(behaviorId);
    if (behavior?.timing === 'delay-1' || behavior?.timing === 'delay-2') {
      tracker = scheduleDelayedBehavior(tracker, behavior.id, today, behavior.delayDays || 1);
      continue;
    }

    if (behavior?.timing === 'instant') {
      tracker = addOrRefreshActiveEffect(tracker, behaviorId, input.now, getEffectConfig(behaviorId));
    }
  }

  const delayed = consumeDueDelayedBehaviors(tracker, today);
  tracker = delayed.tracker;

  for (const behaviorId of delayed.dueBehaviorIds) {
    tracker = addOrRefreshActiveEffect(tracker, behaviorId, input.now, getEffectConfig(behaviorId));
  }

  const activeBehaviorIds = listActiveBehaviorIds(tracker);
  const matchedById = new Map(matched.map((item) => [item.behaviorId, item]));

  const candidates = activeBehaviorIds
    .map((behaviorId) => {
      const effectScore = getActiveEffectScore(tracker, behaviorId);
      return pickTextForBehavior(
        behaviorId,
        input.aiMode,
        tracker,
        today,
        effectScore,
        matchedById.get(behaviorId),
      );
    })
    .filter((item): item is CandidateState => Boolean(item));

  const selected = sortByPriority(candidates)
    .slice(0, CHARACTER_STATE_MAX_INJECT);

  const injectedBehaviorIds = selected.map((item) => item.behaviorId);
  const suppressedBehaviorIds = sortByPriority(candidates)
    .slice(CHARACTER_STATE_MAX_INJECT)
    .map((item) => item.behaviorId);
  const nowMs = input.now.getTime();

  return {
    text: selected.map((item) => item.text).join('\n'),
    meta: {
      matchedBehaviorIds: matchedIds,
      injectedBehaviorIds,
      usedTrendIds: selected.filter((item) => item.isTrend).map((item) => item.behaviorId),
      usedLiteIds: selected.filter((item) => item.isLite).map((item) => item.behaviorId),
      selectedStates: selected.map((item) => ({
        behaviorId: item.behaviorId,
        level: item.level,
        score: Number(item.score.toFixed(2)),
      })),
      suppressedBehaviorIds,
      activeEffects: tracker.activeEffects
        .map((effect) => ({
          behaviorId: effect.behaviorId,
          score: Number(effect.score.toFixed(3)),
          remainingHours: Number(Math.max(0, (effect.expiresAt - nowMs) / (60 * 60 * 1000)).toFixed(2)),
        }))
        .sort((a, b) => b.score - a.score),
    },
    tracker,
  };
}
