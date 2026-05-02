import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetOutboxExecutorsForTests, setOutboxExecutorForTests, useOutboxStore } from './useOutboxStore';

describe('useOutboxStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T10:00:00Z'));
  });

  afterEach(() => {
    useOutboxStore.setState({ entries: [] });
    resetOutboxExecutorsForTests();
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
    expect(entry.lastError).toBe('offline');
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
