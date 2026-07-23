import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('../api/supabase', () => ({
  supabase: {
    from: supabaseMocks.from,
  },
}));

vi.mock('./storageScope', async () => {
  const actual = await vi.importActual<typeof import('./storageScope')>('./storageScope');
  return {
    ...actual,
    isMultiAccountIsolationV2Enabled: () => true,
    readActiveStorageScope: () => ({ type: 'user' as const, userId: 'u1' }),
  };
});

import { resetOutboxExecutorsForTests, setOutboxExecutorForTests, useOutboxStore } from './useOutboxStore';

describe('useOutboxStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T10:00:00Z'));
  });

  afterEach(() => {
    useOutboxStore.setState({ entries: [] });
    resetOutboxExecutorsForTests();
    supabaseMocks.from.mockReset();
    supabaseMocks.upsert.mockReset();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('enqueues entries as pending', () => {
    const id = useOutboxStore.getState().enqueue({
      kind: 'mood.upsert',
      payload: { messageId: 'm1', patch: { mood_label: 'calm' } },
      consecutiveFailures: 0,
    });

    const [entry] = useOutboxStore.getState().entries;
    expect(entry.id).toBe(id);
    expect(entry.status).toBe('pending');
    expect(entry.attempts).toBe(0);
    expect(entry.consecutiveFailures).toBe(0);
  });

  it('discards only mood retries for deleted messages', () => {
    useOutboxStore.getState().enqueue({
      kind: 'mood.upsert',
      payload: { messageId: 'deleted-message', patch: { mood_label: 'down' } },
      consecutiveFailures: 0,
    });
    useOutboxStore.getState().enqueue({
      kind: 'mood.upsert',
      payload: { messageId: 'retained-message', patch: { mood_label: 'happy' } },
      consecutiveFailures: 0,
    });

    useOutboxStore.getState().discardMoodEntries(['deleted-message']);

    const entries = useOutboxStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('mood.upsert');
    if (entries[0].kind !== 'mood.upsert') return;
    expect(entries[0].payload.messageId).toBe('retained-message');
  });

  it('removes a verified orphan mood before retrying its cloud write', async () => {
    const moodExecutor = vi.fn().mockResolvedValue(undefined);
    const { useChatStore } = await import('./useChatStore');
    const { useMoodStore } = await import('./useMoodStore');
    useChatStore.setState({ messages: [], dateCache: {} });
    useMoodStore.setState({ activityMood: { 'orphan-message': 'down' } });
    supabaseMocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          in: async () => ({ data: [], error: null }),
        }),
      }),
    });
    setOutboxExecutorForTests('mood.upsert', moodExecutor);
    useOutboxStore.getState().enqueue({
      kind: 'mood.upsert',
      payload: { messageId: 'orphan-message', patch: { mood_label: 'down' } },
      consecutiveFailures: 0,
    });

    await useOutboxStore.getState().flush('u1');

    expect(moodExecutor).not.toHaveBeenCalled();
    expect(useOutboxStore.getState().entries).toEqual([]);
    expect(useMoodStore.getState().activityMood['orphan-message']).toBeUndefined();
  });

  it('keeps only latest preference upsert entry', () => {
    useOutboxStore.getState().enqueue({
      kind: 'preference.upsert',
      payload: {
        ai_mode: 'van',
        ai_mode_enabled: true,
        daily_goal_enabled: true,
        annotation_drop_rate: 'low',
      },
      consecutiveFailures: 0,
    });

    useOutboxStore.getState().enqueue({
      kind: 'preference.upsert',
      payload: {
        ai_mode: 'agnes',
        ai_mode_enabled: false,
        daily_goal_enabled: false,
        annotation_drop_rate: 'high',
      },
      consecutiveFailures: 0,
    });

    const entries = useOutboxStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('preference.upsert');
    if (entries[0].kind !== 'preference.upsert') return;
    expect(entries[0].payload.ai_mode).toBe('agnes');
    expect(entries[0].payload.annotation_drop_rate).toBe('high');
  });

  it('keeps only the latest response for one reminder occurrence', () => {
    const response = {
      reminderType: 'work_start' as const,
      occurrenceKey: '2026-04-22:work_start:0900',
      occurrenceDate: '2026-04-22',
      scheduledFor: '2026-04-22T09:00:00.000Z',
      respondedAt: '2026-04-22T09:00:01.000Z',
    };
    useOutboxStore.getState().enqueue({
      kind: 'reminder.response',
      payload: { response: { ...response, responseKind: 'confirm' } },
      consecutiveFailures: 0,
    });
    useOutboxStore.getState().enqueue({
      kind: 'reminder.response',
      payload: { response: { ...response, responseKind: 'manual' } },
      consecutiveFailures: 0,
    });

    const entries = useOutboxStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('reminder.response');
    if (entries[0].kind !== 'reminder.response') return;
    expect(entries[0].payload.response.responseKind).toBe('manual');
  });

  it('flushes reminder response retries through the registered executor', async () => {
    const executor = vi.fn().mockResolvedValue(undefined);
    setOutboxExecutorForTests('reminder.response', executor);
    useOutboxStore.getState().enqueue({
      kind: 'reminder.response',
      payload: {
        response: {
          reminderType: 'work_start',
          occurrenceKey: '2026-04-22:work_start:0900',
          occurrenceDate: '2026-04-22',
          scheduledFor: '2026-04-22T09:00:00.000Z',
          responseKind: 'confirm',
          respondedAt: '2026-04-22T09:00:01.000Z',
        },
      },
      consecutiveFailures: 0,
    });

    await useOutboxStore.getState().flush('u1');

    expect(executor).toHaveBeenCalledTimes(1);
    expect(useOutboxStore.getState().entries).toEqual([]);
  });

  it('flush removes succeeded entries', async () => {
    const executor = vi.fn().mockResolvedValue(undefined);
    setOutboxExecutorForTests('report.upsert', executor);
    useOutboxStore.getState().enqueue({
      kind: 'report.upsert',
      payload: { report: { id: 'r1', title: 't', date: Date.now(), type: 'daily', content: 'c' } },
      consecutiveFailures: 0,
    });

    await useOutboxStore.getState().flush('u1');

    expect(executor).toHaveBeenCalledTimes(1);
    expect(useOutboxStore.getState().entries).toEqual([]);
  });

  it('flush retries and keeps entry pending before max attempts', async () => {
    const executor = vi.fn().mockRejectedValue(new Error('offline'));
    setOutboxExecutorForTests('focus.insert', executor);
    useOutboxStore.getState().enqueue({
      kind: 'focus.insert',
      payload: { id: 'f1', todoId: 't1', startedAt: 1, endedAt: 2, setDuration: 3, actualDuration: 4 },
      consecutiveFailures: 0,
    });

    await useOutboxStore.getState().flush('u1');

    const [entry] = useOutboxStore.getState().entries;
    expect(entry.attempts).toBe(1);
    expect(entry.status).toBe('pending');
    expect(entry.lastError).toContain('offline');
  });

  it('flush executes plant direction retries', async () => {
    const executor = vi.fn().mockResolvedValue(undefined);
    setOutboxExecutorForTests('plant.directionOrder', executor);
    useOutboxStore.getState().enqueue({
      kind: 'plant.directionOrder',
      payload: { order: ['life', 'social', 'work_study', 'exercise', 'entertainment'] },
      consecutiveFailures: 0,
    });

    await useOutboxStore.getState().flush('u1');

    expect(executor).toHaveBeenCalledTimes(1);
    expect(useOutboxStore.getState().entries).toEqual([]);
  });

  it('flush executes annotation outcome retries', async () => {
    const executor = vi.fn().mockResolvedValue(undefined);
    setOutboxExecutorForTests('annotation.outcome', executor);
    useOutboxStore.getState().enqueue({
      kind: 'annotation.outcome',
      payload: { annotationId: 'a1', accepted: true },
      consecutiveFailures: 0,
    });

    await useOutboxStore.getState().flush('u1');

    expect(executor).toHaveBeenCalledTimes(1);
    expect(useOutboxStore.getState().entries).toEqual([]);
  });

  it('retries annotation inserts idempotently with upsert', async () => {
    supabaseMocks.upsert.mockResolvedValue({ error: null });
    supabaseMocks.from.mockReturnValue({ upsert: supabaseMocks.upsert });
    useOutboxStore.getState().enqueue({
      kind: 'annotation.insert',
      payload: {
        annotation: {
          id: 'a1',
          content: 'x',
          tone: 'gentle',
          timestamp: 1,
          relatedEvent: { type: 'activity_recorded', timestamp: 1 },
          displayDuration: 1000,
          syncedToCloud: false,
        },
      },
      consecutiveFailures: 0,
    });

    await useOutboxStore.getState().flush('u1');

    expect(supabaseMocks.from).toHaveBeenCalledWith('annotations');
    expect(supabaseMocks.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'a1', user_id: 'u1' })],
      { onConflict: 'id' },
    );
    expect(useOutboxStore.getState().entries).toEqual([]);
  });

  it('flush executes todo delete retries', async () => {
    const executor = vi.fn().mockResolvedValue(undefined);
    setOutboxExecutorForTests('todo.delete', executor);
    useOutboxStore.getState().enqueue({
      kind: 'todo.delete',
      payload: { todoId: 'todo-1' },
      consecutiveFailures: 0,
    });

    await useOutboxStore.getState().flush('u1');

    expect(executor).toHaveBeenCalledTimes(1);
    expect(useOutboxStore.getState().entries).toEqual([]);
  });

  it('puts entry into cooldown after three consecutive failures', async () => {
    const executor = vi.fn().mockRejectedValue(new Error('still offline'));
    setOutboxExecutorForTests('annotation.insert', executor);
    useOutboxStore.setState({
      entries: [{
        id: 'a1',
        kind: 'annotation.insert',
        payload: { annotation: { id: 'a1', content: 'x', tone: 'gentle', timestamp: 1, relatedEvent: { type: 'activity_recorded', timestamp: 1 }, displayDuration: 1000, syncedToCloud: false } },
        attempts: 2,
        consecutiveFailures: 2,
        status: 'pending',
      } as never],
    });

    await useOutboxStore.getState().flush('u1');

    const [entry] = useOutboxStore.getState().entries;
    expect(entry.attempts).toBe(3);
    expect(entry.status).toBe('cooldown');
    expect(entry.consecutiveFailures).toBe(0);
    expect(entry.nextRetryAt).toBe(Date.now() + 60 * 60 * 1000);
  });

  it('retries cooldown entries after retry window elapses', async () => {
    const executor = vi.fn().mockResolvedValue(undefined);
    setOutboxExecutorForTests('annotation.outcome', executor);
    useOutboxStore.setState({
      entries: [{
        id: 'a1',
        kind: 'annotation.outcome',
        payload: { annotationId: 'a1', accepted: true },
        attempts: 3,
        consecutiveFailures: 0,
        status: 'cooldown',
        nextRetryAt: Date.now() + 60 * 60 * 1000,
      } as never],
    });

    await useOutboxStore.getState().flush('u1');
    expect(executor).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    await useOutboxStore.getState().flush('u1');

    expect(executor).toHaveBeenCalledTimes(1);
    expect(useOutboxStore.getState().entries).toEqual([]);
  });
});
