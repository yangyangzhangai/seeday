import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetOutboxExecutorsForTests, setOutboxExecutorForTests, useOutboxStore } from './useOutboxStore';

describe('useOutboxStore', () => {
  afterEach(() => {
    useOutboxStore.setState({ entries: [] });
    resetOutboxExecutorsForTests();
    vi.restoreAllMocks();
  });

  it('enqueues entries as pending', () => {
    const id = useOutboxStore.getState().enqueue({
      kind: 'mood.upsert',
      payload: { messageId: 'm1', patch: { mood_label: 'calm' } },
    });

    const [entry] = useOutboxStore.getState().entries;
    expect(entry.id).toBe(id);
    expect(entry.status).toBe('pending');
    expect(entry.attempts).toBe(0);
  });

  it('flush removes succeeded entries', async () => {
    const executor = vi.fn().mockResolvedValue(undefined);
    setOutboxExecutorForTests('report.upsert', executor);
    useOutboxStore.getState().enqueue({
      kind: 'report.upsert',
      payload: { report: { id: 'r1', title: 't', date: Date.now(), type: 'daily', content: 'c' } },
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
    });

    await useOutboxStore.getState().flush('u1');

    expect(executor).toHaveBeenCalledTimes(1);
    expect(useOutboxStore.getState().entries).toEqual([]);
  });

  it('marks entry failed after five attempts', async () => {
    const executor = vi.fn().mockRejectedValue(new Error('still offline'));
    setOutboxExecutorForTests('annotation.insert', executor);
    useOutboxStore.setState({
      entries: [{
        id: 'a1',
        kind: 'annotation.insert',
        payload: { annotation: { id: 'a1', content: 'x', tone: 'gentle', timestamp: 1, relatedEvent: { type: 'activity_recorded', timestamp: 1 }, displayDuration: 1000, syncedToCloud: false } },
        attempts: 4,
        status: 'pending',
      } as never],
    });

    await useOutboxStore.getState().flush('u1');

    const [entry] = useOutboxStore.getState().entries;
    expect(entry.attempts).toBe(5);
    expect(entry.status).toBe('failed');
  });
});
