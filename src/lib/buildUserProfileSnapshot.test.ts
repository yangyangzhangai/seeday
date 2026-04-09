import { describe, expect, it } from 'vitest';
import { buildUserProfileSnapshot, isLongTermProfileEnabled } from './buildUserProfileSnapshot';

describe('buildUserProfileSnapshot', () => {
  it('prefers declared meal times for suggestion', () => {
    const snapshot = buildUserProfileSnapshot({
      now: new Date('2026-04-09T10:00:00.000Z'),
      profile: {
        manual: {
          wakeTime: '07:30',
          sleepTime: '23:30',
          mealTimes: [8, 12, 19],
          currentGoal: 'Prepare interview',
        },
        observed: {
          mealTimes: {
            value: [9, 13, 20],
            confidence: 0.6,
            evidenceCount: 8,
            lastSeenAt: '2026-04-08T10:00:00.000Z',
          },
        },
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
      },
    });

    expect(snapshot.mealTimesForSuggestion).toEqual([8, 12, 19]);
    expect(snapshot.text).toContain('Declared meal times: 08:00, 12:00, 19:00');
    expect(snapshot.text).toContain('Observed meal times: 09:00, 13:00, 20:00');
  });

  it('calculates upcoming anniversaries in 3-day window', () => {
    const snapshot = buildUserProfileSnapshot({
      now: new Date('2026-04-09T10:00:00.000Z'),
      profile: {
        manual: {},
        anniversariesVisible: [
          {
            id: 'a1',
            label: 'Graduation',
            date: '04-10',
            repeating: true,
            source: 'user',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'a2',
            label: 'Trip day',
            date: '2026-04-15',
            repeating: false,
            source: 'ai_auto',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
      },
    });

    expect(snapshot.visibleUpcomingAnniversaries?.map((item) => item.label)).toEqual(['Graduation']);
    expect(snapshot.text).toContain('Upcoming anniversaries: Graduation (in 1d)');
  });
});

describe('isLongTermProfileEnabled', () => {
  it('returns true only when switch is true', () => {
    expect(isLongTermProfileEnabled({ long_term_profile_enabled: true })).toBe(true);
    expect(isLongTermProfileEnabled({ long_term_profile_enabled: false })).toBe(false);
    expect(isLongTermProfileEnabled({})).toBe(false);
  });
});
