import { describe, expect, it } from 'vitest';
import { createEmptyCharacterStateTracker } from './constants';
import {
  addOrRefreshActiveEffect,
  consumeDueDelayedBehaviors,
  decayAndPruneActiveEffects,
  getActiveEffectScore,
  getSevenDayDensity,
  getStreakOnActiveDays,
  scheduleDelayedBehavior,
  toDateKey,
  withRecordedHistory,
} from './event-tracker';

describe('event-tracker', () => {
  it('counts streak by active days', () => {
    let tracker = createEmptyCharacterStateTracker();
    tracker = withRecordedHistory(tracker, ['B08'], new Date('2026-04-04T09:00:00'));
    tracker = withRecordedHistory(tracker, ['B04'], new Date('2026-04-05T09:00:00'));
    tracker = withRecordedHistory(tracker, ['B04'], new Date('2026-04-06T09:00:00'));
    tracker = withRecordedHistory(tracker, ['B04'], new Date('2026-04-08T09:00:00'));

    expect(getStreakOnActiveDays(tracker, 'B04')).toBe(3);
  });

  it('returns seven day density', () => {
    let tracker = createEmptyCharacterStateTracker();
    for (let d = 1; d <= 5; d += 1) {
      tracker = withRecordedHistory(tracker, ['B10'], new Date(`2026-04-0${d}T09:00:00`));
    }
    expect(getSevenDayDensity(tracker, 'B10', '2026-04-07')).toBe(5);
  });

  it('schedules and consumes delayed events', () => {
    let tracker = createEmptyCharacterStateTracker();
    tracker = scheduleDelayedBehavior(tracker, 'B01', '2026-04-08', 1);
    const consumed = consumeDueDelayedBehaviors(tracker, '2026-04-09');
    expect(consumed.dueBehaviorIds).toEqual(['B01']);
  });

  it('consumes delay events once after due date', () => {
    let tracker = createEmptyCharacterStateTracker();
    tracker = scheduleDelayedBehavior(tracker, 'B03', '2026-04-08', 2);

    const day1 = consumeDueDelayedBehaviors(tracker, '2026-04-09');
    expect(day1.dueBehaviorIds).toContain('B03');

    const day2 = consumeDueDelayedBehaviors(day1.tracker, '2026-04-10');
    expect(day2.dueBehaviorIds).not.toContain('B03');
  });

  it('decays and prunes active effects by time', () => {
    let tracker = createEmptyCharacterStateTracker();
    const start = new Date('2026-04-08T10:00:00');
    tracker = addOrRefreshActiveEffect(tracker, 'B21', start, {
      baseScore: 1,
      maxScore: 2,
      ttlHours: 12,
      halfLifeHours: 4,
    });

    const afterTwoHours = decayAndPruneActiveEffects(tracker, new Date('2026-04-08T12:00:00'));
    expect(getActiveEffectScore(afterTwoHours, 'B21')).toBeLessThan(1);

    const afterExpiry = decayAndPruneActiveEffects(afterTwoHours, new Date('2026-04-09T00:30:00'));
    expect(getActiveEffectScore(afterExpiry, 'B21')).toBe(0);
  });

  it('keeps date key helper unchanged', () => {
    expect(toDateKey(new Date('2026-04-08T10:00:00'))).toBe('2026-04-08');
  });
});
