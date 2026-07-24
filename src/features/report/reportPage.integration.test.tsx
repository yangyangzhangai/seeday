// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

const reportStoreMock = vi.hoisted(() => ({ reports: [] as Array<Record<string, unknown>> }));

vi.mock('react-calendar', () => ({
  default: () => React.createElement('div', { 'data-mock': 'calendar' }),
}));

vi.mock('react-calendar/dist/Calendar.css', () => ({}));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'zh-CN' },
  }),
}));

vi.mock('../../store/useReportStore', () => ({
  useReportStore: () => ({
    reports: reportStoreMock.reports,
    generateReport: vi.fn(async () => 'mock-report-id'),
    generateAIDiary: vi.fn(async () => ''),
    updateReport: vi.fn(),
  }),
}));

vi.mock('../../store/useChatStore', () => ({
  useChatStore: (selector: (state: {
    messages: never[];
    dateCache: Record<string, never[]>;
    loadMessagesForDateRange: ReturnType<typeof vi.fn>;
  }) => unknown) => selector({
    messages: [],
    dateCache: {},
    loadMessagesForDateRange: vi.fn(async () => undefined),
  }),
}));

vi.mock('../../store/useTodoStore', () => ({
  useTodoStore: () => ({ todos: [] }),
}));

vi.mock('../../store/useMoodStore', () => ({
  useMoodStore: () => ({ activityMood: {} }),
}));

vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: (selector: (state: { isPlus: boolean; user: { created_at: string | null } }) => unknown) => selector({
    isPlus: true,
    user: { created_at: null },
  }),
}));

vi.mock('./plant/PlantRootSection', () => ({
  PlantRootSection: () => React.createElement('div', { 'data-testid': 'plant-root-section' }, 'plant-root-section'),
}));

vi.mock('./ReportDetailModal', () => ({
  ReportDetailModal: ({
    selectedReport,
    presentation,
    onOpenCalendar,
    onOpenDiaryBook,
  }: {
    selectedReport: { id: string } | null;
    presentation?: string;
    onOpenCalendar?: () => void;
    onOpenDiaryBook?: () => void;
  }) => selectedReport
    ? React.createElement('div', {
      'data-testid': 'report-detail',
      'data-presentation': presentation,
      'data-has-calendar': Boolean(onOpenCalendar),
      'data-has-diary-book': Boolean(onOpenDiaryBook),
    }, selectedReport.id)
    : null,
}));

import { ReportPage } from './ReportPage';

function renderReportPage() {
  return renderToStaticMarkup(
    React.createElement(MemoryRouter, null, React.createElement(ReportPage)),
  );
}

describe('ReportPage integration', () => {
  it('renders embedded plant root section in report page', () => {
    reportStoreMock.reports = [];
    const html = renderReportPage();
    expect(html).toContain('plant-root-section');
  });

  it('renders an existing today diary as the primary first frame without the plant card', () => {
    reportStoreMock.reports = [{
      id: 'today-report',
      title: 'Today',
      date: Date.now(),
      type: 'daily',
      content: '',
      aiAnalysis: 'Generated diary',
      analysisStatus: 'success',
    }];

    const html = renderReportPage();

    expect(html).toContain('data-testid="report-detail"');
    expect(html).toContain('data-presentation="page"');
    expect(html).toContain('data-has-calendar="true"');
    expect(html).toContain('data-has-diary-book="true"');
    expect(html).not.toContain('plant-root-section');
  });
});
