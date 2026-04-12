import { describe, expect, it } from 'vitest';
import { evaluateNarrativeTrigger } from './narrative-density-trigger.js';
import type { TodayNarrativeCache } from './narrative-density-types.js';

function cache(): TodayNarrativeCache {
  return {
    date: '2026-04-10',
    entryCount: 2,
    todayRichness: 0.2,
    triggerCount: { total: 0, naturalEvent: 0, characterMention: 0, derivedEvent: 0 },
    entries: [],
    recentEventKeys: [],
  };
}

describe('narrative-density-trigger', () => {
  it('blocks first entry immediately', () => {
    const result = evaluateNarrativeTrigger({
      isFirstEntry: true,
      currentScore: 0.1,
      todayRichness: 0.3,
      cache: cache(),
      random: () => 0,
    });
    expect(result.shouldTrigger).toBe(false);
    expect(result.blockedReason).toBe('first_entry');
    expect(result.triggerProbability).toBeGreaterThan(0);
  });

  it('returns event type when low density and probability hit', () => {
    const result = evaluateNarrativeTrigger({
      isFirstEntry: false,
      currentScore: 0.05,
      todayRichness: 0.1,
      cache: cache(),
      random: () => 0,
    });
    expect(result.shouldTrigger).toBe(true);
    expect(result.selectedEventType).toBeTruthy();
  });

  it('uses score-driven probability (high score rarely triggers)', () => {
    const result = evaluateNarrativeTrigger({
      isFirstEntry: false,
      currentScore: 0.9,
      todayRichness: 0.5,
      cache: cache(),
      random: () => 0.02,
    });
    expect(result.shouldTrigger).toBe(false);
    expect(result.blockedReason).toBe('probability_miss');
    expect(result.triggerProbability).toBeCloseTo(0.015, 3);
  });

  it('gives lower score a higher trigger probability', () => {
    const low = evaluateNarrativeTrigger({
      isFirstEntry: false,
      currentScore: 0.1,
      todayRichness: 0.5,
      cache: cache(),
      random: () => 0.999,
    });
    const high = evaluateNarrativeTrigger({
      isFirstEntry: false,
      currentScore: 0.8,
      todayRichness: 0.5,
      cache: cache(),
      random: () => 0.999,
    });
    expect(low.triggerProbability).toBeGreaterThan(high.triggerProbability);
  });
});
