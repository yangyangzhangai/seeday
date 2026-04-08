import { describe, expect, it } from 'vitest';
import { buildUserPrompt } from './annotation-prompts.user';

describe('annotation-prompts holiday formatting', () => {
  it('adds legal suffix for legal holidays in all languages', () => {
    const zh = buildUserPrompt('zh', 'activity_recorded', '写代码', 'timeline', 'stable', 'none', undefined, {
      year: 2026,
      month: 10,
      day: 1,
      weekday: 4,
      isoDate: '2026-10-01',
    }, {
      isHoliday: true,
      name: '国庆节',
      type: 'legal',
      source: 'calendar',
    });
    const en = buildUserPrompt('en', 'activity_recorded', 'coding', 'timeline', 'stable', 'none', undefined, {
      year: 2026,
      month: 7,
      day: 4,
      weekday: 6,
      isoDate: '2026-07-04',
    }, {
      isHoliday: true,
      name: 'Independence Day',
      type: 'legal',
      source: 'calendar',
    });
    const it = buildUserPrompt('it', 'activity_recorded', 'studio', 'timeline', 'stabile', 'nessuno', undefined, {
      year: 2026,
      month: 12,
      day: 25,
      weekday: 5,
      isoDate: '2026-12-25',
    }, {
      isHoliday: true,
      name: 'Natale',
      type: 'legal',
      source: 'calendar',
    });

    expect(zh).toContain('今日节日：国庆节（法定节假日）');
    expect(en).toContain('Current holiday: Independence Day (Legal Holiday)');
    expect(it).toContain('Festivita di oggi: Natale (Festivita legale)');
  });

  it('does not append social suffix for social holidays', () => {
    const zh = buildUserPrompt('zh', 'activity_recorded', '散步', 'timeline', 'stable', 'none', undefined, undefined, {
      isHoliday: true,
      name: '情人节',
      type: 'social',
      source: 'calendar',
    });
    const en = buildUserPrompt('en', 'activity_recorded', 'walk', 'timeline', 'stable', 'none', undefined, undefined, {
      isHoliday: true,
      name: "Valentine's Day",
      type: 'social',
      source: 'calendar',
    });

    expect(zh).toContain('今日节日：情人节');
    expect(zh).not.toContain('社会');
    expect(en).toContain("Current holiday: Valentine's Day");
    expect(en).not.toContain('(social)');
  });

  it('injects minimal weather and season context lines', () => {
    const prompt = buildUserPrompt(
      'en',
      'activity_recorded',
      'coding',
      'timeline',
      'stable',
      'none',
      undefined,
      {
        year: 2026,
        month: 4,
        day: 8,
        weekday: 3,
        isoDate: '2026-04-08',
      },
      undefined,
      9,
      30,
      {
        temperatureC: 18,
        conditions: ['rain_medium', 'windy'],
        source: 'api',
      },
      {
        season: 'spring',
        source: 'local',
      },
      ['strong_wind_watch'],
    );

    expect(prompt).toContain('Season: spring');
    expect(prompt).toContain('Weather: 18C, rain_medium, windy');
    expect(prompt).toContain('Alerts: strong_wind_watch');
  });

  it('injects character state block with fallback', () => {
    const withState = buildUserPrompt(
      'en',
      'activity_recorded',
      'coding',
      'timeline',
      'stable',
      'none',
      'greenhouse smells like alcohol',
    );
    const withoutState = buildUserPrompt(
      'en',
      'activity_recorded',
      'coding',
      'timeline',
      'stable',
      'none',
    );

    expect(withState).toContain('Character current state:');
    expect(withState).toContain('greenhouse smells like alcohol');
    expect(withoutState).toContain('Character current state:\nnone');
  });
});
