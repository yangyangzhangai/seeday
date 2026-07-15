// DOC-DEPS: src/features/report/README.md, docs/CURRENT_TASK.md, docs/PROJECT_MAP.md
import { describe, expect, it } from 'vitest';
import type { Report } from '../../store/useReportStore';
import { isFutureDiaryDate, resolveDiaryBookInitialTarget } from './reportPageHelpers';

function createDailyReport(day: number, overrides: Partial<Report> = {}): Report {
  return {
    id: `report-${day}`,
    title: `Report ${day}`,
    date: new Date(2026, 6, day, 12, 0, 0, 0).getTime(),
    startDate: new Date(2026, 6, day, 0, 0, 0, 0).getTime(),
    endDate: new Date(2026, 6, day, 23, 59, 59, 999).getTime(),
    type: 'daily',
    content: 'Generated report',
    stats: { completedTodos: 0, totalTodos: 0, completionRate: 0 },
    analysisStatus: 'idle',
    ...overrides,
  };
}

describe('reportPageHelpers', () => {
  it('ignores future and empty placeholder reports when opening Diary Book', () => {
    const reports = [
      createDailyReport(14, { stats: { completedTodos: 1, totalTodos: 1, completionRate: 1, actionAnalysis: [{ category: 'work', minutes: 45, percent: 100 }] } }),
      createDailyReport(15),
      createDailyReport(17),
    ];

    expect(resolveDiaryBookInitialTarget(reports, new Date(2026, 6, 15, 10, 0, 0, 0)))
      .toEqual(new Date(2026, 6, 14, 0, 0, 0, 0));
  });

  it('falls back to the latest non-future daily report when all candidates are placeholders', () => {
    const reports = [createDailyReport(13), createDailyReport(14), createDailyReport(15)];

    expect(resolveDiaryBookInitialTarget(reports, new Date(2026, 6, 15, 8, 0, 0, 0)))
      .toEqual(new Date(2026, 6, 15, 0, 0, 0, 0));
  });

  it('treats future dates as blocked but allows past days', () => {
    const now = new Date(2026, 6, 15, 9, 0, 0, 0);

    expect(isFutureDiaryDate(new Date(2026, 6, 17, 12, 0, 0, 0), now)).toBe(true);
    expect(isFutureDiaryDate(new Date(2026, 6, 14, 12, 0, 0, 0), now)).toBe(false);
    expect(isFutureDiaryDate(new Date(2026, 6, 15, 23, 59, 59, 999), now)).toBe(false);
  });
});
