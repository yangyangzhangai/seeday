// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import { describe, expect, it } from 'vitest';
import type { Report } from '../../store/useReportStore';
import { resolveReportObservationText } from './reportObservation';

function report(overrides: Partial<Report> = {}): Report {
  return {
    id: 'report',
    title: 'Daily report',
    date: new Date(2026, 6, 23).getTime(),
    type: 'daily',
    content: 'Generated report',
    analysisStatus: 'idle',
    ...overrides,
  };
}

function resolve(value: Report, isPlus: boolean): string {
  return resolveReportObservationText({
    report: value,
    isPlus,
    loadingText: 'Loading',
    fallbackText: 'Fallback',
  });
}

describe('report observation text', () => {
  it('returns the same stored full diary for every report surface', () => {
    const generated = report({ aiAnalysis: 'Immutable observation', analysisStatus: 'success' });

    expect(resolve(generated, true)).toBe('Immutable observation');
    expect(resolve(generated, true)).toBe('Immutable observation');
  });

  it('uses the shared loading and fallback states', () => {
    expect(resolve(report({ analysisStatus: 'generating' }), true)).toBe('Loading');
    expect(resolve(report(), false)).toBe('Loading');
    expect(resolve(report({ analysisStatus: 'error' }), false)).toBe('Fallback');
  });
});
