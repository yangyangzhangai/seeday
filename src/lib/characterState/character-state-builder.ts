// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/AI批注回复_行为角色状态映射_开发落地方案_v1.md
import { BEHAVIOR_BY_ID, TEA_SUBTYPE_CONFIG } from './behavior-map';
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
    isTrend: useTrend,
    isLite: useLite,
  };
}

function getEffectConfig(behaviorId: string): {
  baseScore: number;
  maxScore: number;
  ttlHours: number;
  halfLifeHours: number;
} {
  switch (behaviorId) {
    case 'B03':
      return { baseScore: 1.35, maxScore: 2.8, ttlHours: 48, halfLifeHours: 14 };
    case 'B01':
    case 'B13':
      return { baseScore: 1.15, maxScore: 2.6, ttlHours: 36, halfLifeHours: 12 };
    case 'B02':
    case 'B21':
      return { baseScore: 1.2, maxScore: 2.8, ttlHours: 36, halfLifeHours: 10 };
    case 'B11':
    case 'B12':
      return { baseScore: 0.9, maxScore: 2.2, ttlHours: 12, halfLifeHours: 5 };
    case 'B17':
    case 'B18':
    case 'B19':
      return { baseScore: 1.0, maxScore: 2.4, ttlHours: 16, halfLifeHours: 7 };
    default:
      return { baseScore: 1.0, maxScore: 2.5, ttlHours: 24, halfLifeHours: 9 };
  }
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

  return {
    text: selected.map((item) => item.text).join('\n'),
    meta: {
      matchedBehaviorIds: matchedIds,
      injectedBehaviorIds,
      usedTrendIds: selected.filter((item) => item.isTrend).map((item) => item.behaviorId),
      usedLiteIds: selected.filter((item) => item.isLite).map((item) => item.behaviorId),
    },
    tracker,
  };
}
