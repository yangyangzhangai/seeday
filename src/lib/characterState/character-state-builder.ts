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
  consumeDueDelayedBehaviors,
  getSevenDayDensity,
  getStreakOnActiveDays,
  getTodayFromNow,
  isInjectedToday,
  markInjectedToday,
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
  if (behavior.decayType === 'high' && density >= 4) return null;

  const useLite = behavior.decayType === 'mid' && density >= 3;
  const streak = getStreakOnActiveDays(tracker, behaviorId);
  const useTrend = streak >= 3;
  const text = useLite
    ? behavior.lite?.[aiMode]
    : (useTrend ? behavior.trend[aiMode] : behavior.instant[aiMode]);

  if (!text) return null;

  return {
    behaviorId,
    text,
    score: (CATEGORY_PRIORITY[behavior.category] || 0) + behavior.priority,
    isTrend: useTrend,
    isLite: useLite,
  };
}

function sortByPriority(states: CandidateState[]): CandidateState[] {
  return [...states].sort((a, b) => b.score - a.score);
}

export function buildCharacterState(input: CharacterStateBuildInput): CharacterStateBuildOutput {
  const today = getTodayFromNow(input.now);
  const matched = detectBehaviors(input.text, input.durationMinutes);
  const matchedIds = matched.map((item) => item.behaviorId);

  let tracker = withRecordedHistory(input.tracker, matchedIds, input.now);

  for (const behaviorId of matchedIds) {
    const behavior = BEHAVIOR_BY_ID.get(behaviorId);
    if (behavior?.timing === 'delay-1' || behavior?.timing === 'delay-2') {
      tracker = scheduleDelayedBehavior(tracker, behavior.id, today, behavior.delayDays || 1);
    }
  }

  const immediateCandidates = matched
    .filter((item) => (BEHAVIOR_BY_ID.get(item.behaviorId)?.timing || 'instant') === 'instant')
    .filter((item) => !isInjectedToday(tracker, today, item.behaviorId))
    .map((item) => pickTextForBehavior(item.behaviorId, input.aiMode, tracker, today, item))
    .filter((item): item is CandidateState => Boolean(item));

  const delayed = consumeDueDelayedBehaviors(tracker, today);
  tracker = delayed.tracker;

  const delayedCandidates = delayed.dueBehaviorIds
    .filter((id) => !isInjectedToday(tracker, today, id))
    .map((id) => pickTextForBehavior(id, input.aiMode, tracker, today))
    .filter((item): item is CandidateState => Boolean(item));

  const selected = sortByPriority([...immediateCandidates, ...delayedCandidates])
    .slice(0, CHARACTER_STATE_MAX_INJECT);

  const injectedBehaviorIds = selected.map((item) => item.behaviorId);
  tracker = markInjectedToday(tracker, today, injectedBehaviorIds);

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
