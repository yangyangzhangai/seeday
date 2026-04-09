import { describe, expect, it } from 'vitest';
import { detectSuggestionContextHints, isMealTime } from './suggestionDetector';

describe('suggestionDetector', () => {
  it('returns top-2 hints by priority', () => {
    const now = new Date('2026-03-29T12:30:00.000Z');

    const hints = detectSuggestionContextHints({
      now,
      todayActivities: [
        {
          content: 'deep work',
          duration: 210,
          activityType: 'work',
          timestamp: now.getTime() - 40 * 60 * 1000,
          completed: true,
        },
      ],
      pendingTodos: [
        {
          id: 'todo-1',
          title: 'submit report',
          dueAt: now.getTime() + 45 * 60 * 1000,
        },
      ],
      recentMoodMessages: ['I am very anxious'],
    });

    expect(hints.length).toBe(2);
    expect(hints[0]).toContain('negative mood');
    expect(hints[1]).toContain('due soon');
  });

  it('matches declared meal time with ±1 hour window', () => {
    expect(isMealTime(10, [11], [13])).toBe(true);
    expect(isMealTime(13, [11], [13])).toBe(false);
  });

  it('falls back to observed and then legacy meal windows', () => {
    expect(isMealTime(19, undefined, [20])).toBe(true);
    expect(isMealTime(12, undefined, undefined)).toBe(true);
    expect(isMealTime(15, undefined, undefined)).toBe(false);
  });
});
