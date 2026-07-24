// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/README.md
import { describe, expect, it } from 'vitest';
import type { Report } from './useReportStore';
import {
  choosePreferredReport,
  dedupeReportsByWindow,
  mergeReportByWindow,
  mergeSameReportRecord,
  shouldRepairSparseReport,
} from './reportRecordResolver';

function report(id: string, overrides: Partial<Report> = {}): Report {
  return {
    id,
    title: 'Daily report',
    date: new Date(2026, 6, 23, 12).getTime(),
    type: 'daily',
    content: 'Generated report',
    stats: { completedTodos: 0, totalTodos: 0, completionRate: 0 },
    analysisStatus: 'idle',
    ...overrides,
  };
}

describe('report record resolver', () => {
  it('does not let a sparse refresh clear generated diary text or its snapshot', () => {
    const generated = report('same-id', {
      aiAnalysis: 'Original diary',
      analysisStatus: 'success',
      stats: {
        completedTodos: 1,
        totalTodos: 2,
        completionRate: 0.5,
        diaryPageSnapshot: {
          version: 2,
          generatedAt: 10,
          lang: 'en',
          actionAnalysis: [],
          moodDistribution: [],
          activitySummary: 'Activity',
          moodSummary: 'Mood',
          todoCompleted: 1,
          todoTotal: 2,
          todoCompletionRate: 0.5,
          todoSummary: 'Todo',
          habitDone: 0,
          habitTotal: 0,
          goalDone: 0,
          goalTotal: 0,
          starsToday: 0,
          habitSummary: 'Habit',
        },
      },
    });
    const refreshed = report('same-id', { aiAnalysis: null });

    const merged = mergeSameReportRecord(generated, refreshed);

    expect(merged.aiAnalysis).toBe('Original diary');
    expect(merged.stats?.diaryPageSnapshot?.generatedAt).toBe(10);
    expect(merged.analysisStatus).toBe('success');
    expect(mergeReportByWindow([generated], refreshed)[0].aiAnalysis).toBe('Original diary');
  });

  it('prefers a generated report over a same-day placeholder regardless of order', () => {
    const placeholder = report('a-placeholder');
    const generated = report('z-generated', { aiAnalysis: 'Stored diary' });

    expect(choosePreferredReport(placeholder, generated).id).toBe('z-generated');
    expect(choosePreferredReport(generated, placeholder).id).toBe('z-generated');
  });

  it('uses the earliest frozen generation when duplicate reports both have diaries', () => {
    const earlier = report('later-id', {
      aiAnalysis: 'Original diary',
      stats: {
        completedTodos: 0,
        totalTodos: 0,
        completionRate: 0,
        diaryPageSnapshot: {
          version: 2,
          generatedAt: 10,
          lang: 'en',
          actionAnalysis: [],
          moodDistribution: [],
          activitySummary: '',
          moodSummary: '',
          todoCompleted: 0,
          todoTotal: 0,
          todoCompletionRate: 0,
          todoSummary: '',
          habitDone: 0,
          habitTotal: 0,
          goalDone: 0,
          goalTotal: 0,
          starsToday: 0,
          habitSummary: '',
        },
      },
    });
    const later = {
      ...earlier,
      id: 'earlier-id',
      aiAnalysis: 'Replacement diary',
      stats: {
        ...earlier.stats!,
        diaryPageSnapshot: { ...earlier.stats!.diaryPageSnapshot!, generatedAt: 20 },
      },
    };

    expect(dedupeReportsByWindow([later, earlier])[0].aiAnalysis).toBe('Original diary');
    expect(dedupeReportsByWindow([earlier, later])[0].aiAnalysis).toBe('Original diary');
  });

  it('never marks a generated sparse report for startup repair', () => {
    expect(shouldRepairSparseReport(report('generated', { aiAnalysis: 'Keep me' }))).toBe(false);
    expect(shouldRepairSparseReport(report('placeholder'))).toBe(true);
  });
});
