// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('react-calendar', () => ({
  default: () => React.createElement('div', { 'data-mock': 'calendar' }),
}));

vi.mock('react-calendar/dist/Calendar.css', () => ({}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'zh-CN' },
  }),
}));

vi.mock('../../store/useReportStore', () => ({
  useReportStore: () => ({
    reports: [],
    generateReport: vi.fn(async () => 'mock-report-id'),
    generateTimeshineDiary: vi.fn(async () => ''),
  }),
}));

vi.mock('../../store/useChatStore', () => ({
  useChatStore: (selector: (state: { messages: never[] }) => unknown) => selector({ messages: [] }),
}));

vi.mock('../../store/useTodoStore', () => ({
  useTodoStore: () => ({ todos: [] }),
}));

vi.mock('../../store/useMoodStore', () => ({
  useMoodStore: () => ({ activityMood: {} }),
}));

vi.mock('./plant/PlantRootSection', () => ({
  PlantRootSection: () => React.createElement('div', { 'data-testid': 'plant-root-section' }, 'plant-root-section'),
}));

import { ReportPage } from './ReportPage';

describe('ReportPage integration', () => {
  it('renders embedded plant root section in report page', () => {
    const html = renderToStaticMarkup(React.createElement(ReportPage));
    expect(html).toContain('plant-root-section');
  });
});
