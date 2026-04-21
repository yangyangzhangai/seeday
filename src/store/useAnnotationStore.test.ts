import { describe, expect, it } from 'vitest';
import { getLocalDateString } from './chatHelpers';
import { getSuggestionPeriod, shouldResetStats } from './useAnnotationStore';

describe('useAnnotationStore suggestion window boundaries', () => {
  it('maps boundary hours to morning/afternoon/night periods', () => {
    expect(getSuggestionPeriod(5)).toBe('night');
    expect(getSuggestionPeriod(6)).toBe('morning');
    expect(getSuggestionPeriod(12)).toBe('morning');
    expect(getSuggestionPeriod(13)).toBe('afternoon');
    expect(getSuggestionPeriod(18)).toBe('afternoon');
    expect(getSuggestionPeriod(19)).toBe('night');
  });
});

describe('useAnnotationStore daily reset checks', () => {
  it('does not reset when date is today', () => {
    const today = getLocalDateString(new Date());
    expect(shouldResetStats(today)).toBe(false);
  });

  it('resets when date is not today', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = getLocalDateString(yesterday);
    expect(shouldResetStats(yesterdayStr)).toBe(true);
  });
});
