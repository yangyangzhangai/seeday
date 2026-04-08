import { describe, expect, it } from 'vitest';
import { buildCharacterState } from './character-state-builder';
import { createEmptyCharacterStateTracker } from './constants';

describe('character-state-builder', () => {
  it('uses trend text when streak >= 3', () => {
    let tracker = createEmptyCharacterStateTracker();

    const day1 = buildCharacterState({
      text: '今天跑步了', aiMode: 'van', now: new Date('2026-04-06T09:00:00'), tracker,
    });
    tracker = day1.tracker;

    const day2 = buildCharacterState({
      text: '继续散步', aiMode: 'van', now: new Date('2026-04-07T09:00:00'), tracker,
    });
    tracker = day2.tracker;

    const day3 = buildCharacterState({
      text: '今天也运动了', aiMode: 'van', now: new Date('2026-04-08T09:00:00'), tracker,
    });

    expect(day3.meta.usedTrendIds).toContain('B04');
  });

  it('downgrades to lite text when mid density reached', () => {
    let tracker = createEmptyCharacterStateTracker();
    const dates = ['2026-04-05', '2026-04-06', '2026-04-07'];

    for (const date of dates) {
      const result = buildCharacterState({
        text: '今天喝了奶茶',
        aiMode: 'momo',
        now: new Date(`${date}T09:00:00`),
        tracker,
      });
      tracker = result.tracker;
    }

    const last = buildCharacterState({
      text: '又来一杯甜饮',
      aiMode: 'momo',
      now: new Date('2026-04-08T09:00:00'),
      tracker,
    });

    expect(last.meta.usedLiteIds).toContain('B10');
  });

  it('caps concurrent states at two', () => {
    const result = buildCharacterState({
      text: '我今天跑步后做饭又冥想还开窗',
      aiMode: 'van',
      now: new Date('2026-04-08T10:00:00'),
      tracker: createEmptyCharacterStateTracker(),
    });

    expect(result.meta.injectedBehaviorIds.length).toBeLessThanOrEqual(2);
  });

  it('dedupes same behavior on the same day', () => {
    const first = buildCharacterState({
      text: '今天喝了咖啡',
      aiMode: 'van',
      now: new Date('2026-04-08T09:00:00'),
      tracker: createEmptyCharacterStateTracker(),
    });

    const second = buildCharacterState({
      text: '下午又喝了咖啡',
      aiMode: 'van',
      now: new Date('2026-04-08T17:00:00'),
      tracker: first.tracker,
    });

    expect(first.meta.injectedBehaviorIds).toContain('B09');
    expect(second.meta.injectedBehaviorIds).not.toContain('B09');
  });
});
