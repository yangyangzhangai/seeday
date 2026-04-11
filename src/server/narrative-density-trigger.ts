// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/timeshine_doc1_低叙事密度判定规范.docx

import {
  NARRATIVE_DAILY_LIMIT,
  NARRATIVE_EVENT_WEIGHTS,
  NARRATIVE_THRESHOLD_BASE,
  NARRATIVE_THRESHOLD_RICHNESS_FACTOR,
  NARRATIVE_TRIGGER_PROBABILITY_GAMMA,
  NARRATIVE_TRIGGER_PROBABILITY_MAX,
  NARRATIVE_TRIGGER_PROBABILITY_MIN,
  NARRATIVE_TRIGGER_PROBABILITY_SPAN,
  NARRATIVE_TRIGGER_RICHNESS_PENALTY,
} from './narrative-density-constants.js';
import type {
  NarrativeEventType,
  NarrativeTriggerDecision,
  TodayNarrativeCache,
} from './narrative-density-types.js';

function toWeightedAvailableTypes(cache: TodayNarrativeCache): Array<{ type: NarrativeEventType; weight: number }> {
  const reachedNatural = cache.triggerCount.naturalEvent >= NARRATIVE_DAILY_LIMIT.naturalEvent;
  const reachedMention = cache.triggerCount.characterMention >= NARRATIVE_DAILY_LIMIT.characterMention;
  const reachedDerived = cache.triggerCount.derivedEvent >= NARRATIVE_DAILY_LIMIT.derivedEvent;
  return (Object.entries(NARRATIVE_EVENT_WEIGHTS) as Array<[NarrativeEventType, number]>)
    .filter(([type, weight]) => {
      if (weight <= 0) return false;
      if (type === 'natural_event' && reachedNatural) return false;
      if (type === 'character_mention' && reachedMention) return false;
      if (type === 'derived_event' && reachedDerived) return false;
      return true;
    })
    .map(([type, weight]) => ({ type, weight }));
}

function pickTypeByWeight(
  available: Array<{ type: NarrativeEventType; weight: number }>,
  random: () => number,
): NarrativeEventType | null {
  const total = available.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return null;
  let cursor = random() * total;
  for (const item of available) {
    cursor -= item.weight;
    if (cursor <= 0) return item.type;
  }
  return available[available.length - 1]?.type ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeTriggerProbability(currentScore: number, todayRichness: number): number {
  const lowDensityStrength = clamp(1 - currentScore, 0, 1);
  const raw =
    NARRATIVE_TRIGGER_PROBABILITY_MIN
    + Math.pow(lowDensityStrength, NARRATIVE_TRIGGER_PROBABILITY_GAMMA) * NARRATIVE_TRIGGER_PROBABILITY_SPAN
    - todayRichness * NARRATIVE_TRIGGER_RICHNESS_PENALTY;
  return clamp(raw, NARRATIVE_TRIGGER_PROBABILITY_MIN, NARRATIVE_TRIGGER_PROBABILITY_MAX);
}

export function evaluateNarrativeTrigger(params: {
  isFirstEntry: boolean;
  currentScore: number;
  todayRichness: number;
  cache: TodayNarrativeCache;
  random?: () => number;
}): NarrativeTriggerDecision {
  const random = params.random || Math.random;
  const adjustedThreshold = Math.max(
    0,
    NARRATIVE_THRESHOLD_BASE - params.todayRichness * NARRATIVE_THRESHOLD_RICHNESS_FACTOR,
  );
  const triggerProbability = computeTriggerProbability(params.currentScore, params.todayRichness);

  if (params.isFirstEntry) {
    return { shouldTrigger: false, adjustedThreshold, triggerProbability, blockedReason: 'first_entry' };
  }
  if (params.cache.triggerCount.total >= NARRATIVE_DAILY_LIMIT.total) {
    return { shouldTrigger: false, adjustedThreshold, triggerProbability, blockedReason: 'daily_total_limit' };
  }
  if (random() >= triggerProbability) {
    return { shouldTrigger: false, adjustedThreshold, triggerProbability, blockedReason: 'probability_miss' };
  }

  const available = toWeightedAvailableTypes(params.cache);
  if (available.length === 0) {
    return { shouldTrigger: false, adjustedThreshold, triggerProbability, blockedReason: 'event_type_limit' };
  }

  const selectedEventType = pickTypeByWeight(available, random);
  if (!selectedEventType) {
    return { shouldTrigger: false, adjustedThreshold, triggerProbability, blockedReason: 'no_available_type' };
  }
  return { shouldTrigger: true, adjustedThreshold, triggerProbability, selectedEventType };
}
