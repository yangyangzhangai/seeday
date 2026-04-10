// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/timeshine_doc1_低叙事密度判定规范.docx

import {
  NARRATIVE_DAILY_LIMIT,
  NARRATIVE_EVENT_WEIGHTS,
  NARRATIVE_THRESHOLD_BASE,
  NARRATIVE_THRESHOLD_RICHNESS_FACTOR,
  NARRATIVE_TRIGGER_PROBABILITY,
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

  if (params.isFirstEntry) return { shouldTrigger: false, adjustedThreshold, blockedReason: 'first_entry' };
  if (params.currentScore >= adjustedThreshold) return { shouldTrigger: false, adjustedThreshold, blockedReason: 'not_low_density' };
  if (params.cache.triggerCount.total >= NARRATIVE_DAILY_LIMIT.total) {
    return { shouldTrigger: false, adjustedThreshold, blockedReason: 'daily_total_limit' };
  }
  if (random() >= NARRATIVE_TRIGGER_PROBABILITY) {
    return { shouldTrigger: false, adjustedThreshold, blockedReason: 'probability_miss' };
  }

  const available = toWeightedAvailableTypes(params.cache);
  if (available.length === 0) return { shouldTrigger: false, adjustedThreshold, blockedReason: 'event_type_limit' };

  const selectedEventType = pickTypeByWeight(available, random);
  if (!selectedEventType) return { shouldTrigger: false, adjustedThreshold, blockedReason: 'no_available_type' };
  return { shouldTrigger: true, adjustedThreshold, selectedEventType };
}
