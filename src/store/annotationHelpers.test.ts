import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnnotationEvent } from '../types/annotation';
import { shouldGenerateAnnotation } from './annotationHelpers';

describe('annotationHelpers cooldown checks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('does not treat the current appended event as a same-type cooldown hit', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const now = Date.now();
    const previousEvent: AnnotationEvent = {
      type: 'activity_recorded',
      timestamp: now - 3 * 60 * 1000,
      data: { content: '吃饭' },
    };
    const currentEvent: AnnotationEvent = {
      type: 'activity_recorded',
      timestamp: now,
      data: { content: '看书' },
    };

    const shouldGenerate = shouldGenerateAnnotation(
      currentEvent,
      {
        date: '2026-03-22',
        speakCount: 0,
        lastSpeakTime: 0,
        events: [previousEvent, currentEvent],
      },
      {
        dailyLimit: 999,
        enabled: true,
      },
    );

    expect(shouldGenerate).toBe(true);
  });

  it('still blocks when the previous same-type event is truly inside cooldown', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const now = Date.now();
    const previousEvent: AnnotationEvent = {
      type: 'activity_recorded',
      timestamp: now - 60 * 1000,
      data: { content: '吃饭' },
    };
    const currentEvent: AnnotationEvent = {
      type: 'activity_recorded',
      timestamp: now,
      data: { content: '看书' },
    };

    const shouldGenerate = shouldGenerateAnnotation(
      currentEvent,
      {
        date: '2026-03-22',
        speakCount: 0,
        lastSpeakTime: 0,
        events: [previousEvent, currentEvent],
      },
      {
        dailyLimit: 999,
        enabled: true,
      },
    );

    expect(shouldGenerate).toBe(false);
  });
});
