import { describe, expect, it } from 'vitest';
import { resolveSeasonContext } from './seasonContext';

describe('resolveSeasonContext', () => {
  it('maps month to expected season', () => {
    expect(resolveSeasonContext({ year: 2026, month: 4, day: 1, weekday: 3, isoDate: '2026-04-01' }).season).toBe('spring');
    expect(resolveSeasonContext({ year: 2026, month: 7, day: 1, weekday: 3, isoDate: '2026-07-01' }).season).toBe('summer');
    expect(resolveSeasonContext({ year: 2026, month: 10, day: 1, weekday: 3, isoDate: '2026-10-01' }).season).toBe('autumn');
    expect(resolveSeasonContext({ year: 2026, month: 1, day: 1, weekday: 3, isoDate: '2026-01-01' }).season).toBe('winter');
  });

  it('returns fallback when month is missing', () => {
    expect(resolveSeasonContext(undefined)).toEqual({ season: 'unknown', source: 'fallback' });
  });
});
