import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase-utils', () => ({
  getSupabaseSession: vi.fn(async () => null),
}));

vi.mock('./useAnnotationStore', () => ({
  useAnnotationStore: {
    getState: () => ({
      triggerAnnotation: vi.fn(async () => undefined),
    }),
  },
}));

import { useChatStore } from './useChatStore';
import { useMoodStore } from './useMoodStore';
import { useOutboxStore } from './useOutboxStore';
import { useReportStore } from './useReportStore';
import { useTodoStore } from './useTodoStore';

describe('useReportStore regeneration persistence', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [] });
    useTodoStore.setState({ todos: [] });
    useMoodStore.setState({
      activityMood: {},
      activityMoodMeta: {},
      customMoodLabel: {},
      customMoodApplied: {},
      customMoodOptions: [],
      moodNote: {},
      moodNoteMeta: {},
    });
    useReportStore.setState({ reports: [], computedHistory: [] });
    useOutboxStore.setState({ entries: [] });
  });

  it('reuses the same report id when regenerating the same daily report', async () => {
    const date = new Date('2026-03-20T12:00:00Z').getTime();

    const firstId = await useReportStore.getState().generateReport('daily', date);
    const secondId = await useReportStore.getState().generateReport('daily', date);

    expect(secondId).toBe(firstId);
    expect(useReportStore.getState().reports).toHaveLength(1);
    expect(useReportStore.getState().reports[0].id).toBe(firstId);
  });

  it('does not regenerate or clear an already generated daily diary', async () => {
    const date = new Date('2026-03-20T12:00:00Z').getTime();
    useReportStore.setState({
      reports: [{
        id: 'generated-report',
        title: 'Today',
        date,
        type: 'daily',
        content: 'Generated report',
        aiAnalysis: 'Original immutable diary',
        analysisStatus: 'success',
        stats: { completedTodos: 0, totalTodos: 0, completionRate: 0 },
      }],
    });

    const reportId = await useReportStore.getState().generateReport('daily', date);

    expect(reportId).toBe('generated-report');
    expect(useReportStore.getState().reports[0].aiAnalysis).toBe('Original immutable diary');
    expect(useOutboxStore.getState().entries).toEqual([]);
  });

  it('rejects an update that tries to replace generated diary text', async () => {
    useReportStore.setState({
      reports: [{
        id: 'generated-report',
        title: 'Today',
        date: new Date('2026-03-20T12:00:00Z').getTime(),
        type: 'daily',
        content: 'Generated report',
        aiAnalysis: 'Original immutable diary',
        analysisStatus: 'success',
      }],
    });

    await useReportStore.getState().updateReport('generated-report', {
      aiAnalysis: 'Replacement diary',
    });

    expect(useReportStore.getState().reports[0].aiAnalysis).toBe('Original immutable diary');
  });

  it('queues full report upsert when updateReport runs without session', async () => {
    useReportStore.setState({
      reports: [{
        id: 'report-1',
        title: 'Today',
        date: new Date('2026-03-20T12:00:00Z').getTime(),
        type: 'daily',
        content: 'Generated report',
        userNote: 'old',
      }],
    });

    await useReportStore.getState().updateReport('report-1', { userNote: 'new note' });

    expect(useReportStore.getState().reports[0].userNote).toBe('new note');
    expect(useOutboxStore.getState().entries).toHaveLength(1);
    expect(useOutboxStore.getState().entries[0].kind).toBe('report.upsert');
  });
});
