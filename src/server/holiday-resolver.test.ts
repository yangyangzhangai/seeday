import { describe, expect, it } from 'vitest';
import { resolveHoliday } from './holiday-resolver';

describe('holiday-resolver', () => {
  it('detects legal holiday from built-in calendar', () => {
    const holiday = resolveHoliday({
      countryCode: 'IT',
      lang: 'zh',
      currentDate: {
        year: 2026,
        month: 12,
        day: 25,
        weekday: 5,
        isoDate: '2026-12-25',
      },
    });

    expect(holiday.isHoliday).toBe(true);
    expect(holiday.type).toBe('legal');
    expect(holiday.source).toBe('calendar');
  });

  it('detects social holiday fallback when legal holiday is absent', () => {
    const holiday = resolveHoliday({
      countryCode: 'CN',
      lang: 'en',
      currentDate: {
        year: 2026,
        month: 2,
        day: 14,
        weekday: 6,
        isoDate: '2026-02-14',
      },
    });

    expect(holiday.isHoliday).toBe(true);
    expect(holiday.type).toBe('social');
    expect(holiday.name).toContain('Valentine');
  });

  it('returns none when not a holiday', () => {
    const holiday = resolveHoliday({
      countryCode: 'CN',
      lang: 'zh',
      currentDate: {
        year: 2026,
        month: 4,
        day: 8,
        weekday: 3,
        isoDate: '2026-04-08',
      },
    });

    expect(holiday.isHoliday).toBe(false);
    expect(holiday.source).toBe('none');
  });
});
