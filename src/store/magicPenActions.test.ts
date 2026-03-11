import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MagicPenDraftItem } from '../services/input/magicPenTypes';
import { commitMagicPenDrafts } from './magicPenActions';
import { useChatStore } from './useChatStore';
import { useTodoStore } from './useTodoStore';

function buildActivityDraft(id: string, startAt: number, endAt: number): MagicPenDraftItem {
  return {
    id,
    kind: 'activity_backfill',
    content: `activity-${id}`,
    sourceText: `activity-${id}`,
    confidence: 'high',
    needsUserConfirmation: false,
    errors: [],
    activity: { startAt, endAt, timeResolution: 'exact' },
  };
}

function buildTodoDraft(id: string): MagicPenDraftItem {
  return {
    id,
    kind: 'todo_add',
    content: `todo-${id}`,
    sourceText: `todo-${id}`,
    confidence: 'high',
    needsUserConfirmation: false,
    errors: [],
    todo: { priority: 'important-not-urgent', category: 'life', scope: 'daily' },
  };
}

describe('commitMagicPenDrafts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits activity drafts by startAt asc', async () => {
    const calls: number[] = [];
    vi.spyOn(useChatStore, 'getState').mockReturnValue({
      messages: [],
      insertActivity: vi.fn(async (_prev, _next, _content, startAt) => {
        calls.push(startAt);
      }),
    } as never);
    vi.spyOn(useTodoStore, 'getState').mockReturnValue({ addTodo: vi.fn() } as never);

    const drafts = [
      buildActivityDraft('b', 200, 260),
      buildActivityDraft('a', 100, 160),
    ];
    await commitMagicPenDrafts(drafts);

    expect(calls).toEqual([100, 200]);
  });

  it('reuses addTodo for todo drafts', async () => {
    const addTodo = vi.fn(async () => undefined);
    vi.spyOn(useChatStore, 'getState').mockReturnValue({ messages: [], insertActivity: vi.fn() } as never);
    vi.spyOn(useTodoStore, 'getState').mockReturnValue({ addTodo } as never);

    const result = await commitMagicPenDrafts([buildTodoDraft('todo-1')]);
    expect(addTodo).toHaveBeenCalledTimes(1);
    expect(result.successTodoCount).toBe(1);
  });

  it('blocks full submission when a draft has validation error', async () => {
    const insertActivity = vi.fn(async () => undefined);
    vi.spyOn(useChatStore, 'getState').mockReturnValue({ messages: [], insertActivity } as never);
    vi.spyOn(useTodoStore, 'getState').mockReturnValue({ addTodo: vi.fn() } as never);

    const invalidDraft: MagicPenDraftItem = {
      ...buildActivityDraft('invalid', 0, 0),
      activity: { timeResolution: 'missing' },
    };
    const result = await commitMagicPenDrafts([invalidDraft]);

    expect(result.failedDraftIds).toEqual(['invalid']);
    expect(insertActivity).not.toHaveBeenCalled();
  });

  it('returns failed draft ids on partial failure', async () => {
    const insertActivity = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('failed'));
    vi.spyOn(useChatStore, 'getState').mockReturnValue({ messages: [], insertActivity } as never);
    vi.spyOn(useTodoStore, 'getState').mockReturnValue({ addTodo: vi.fn(async () => undefined) } as never);

    const result = await commitMagicPenDrafts([
      buildActivityDraft('ok', 100, 150),
      buildActivityDraft('bad', 160, 180),
    ]);

    expect(result.failedDraftIds).toEqual(['bad']);
    expect(result.successActivityCount).toBe(1);
  });

  it('blocks submission when draft overlaps ongoing activity', async () => {
    const insertActivity = vi.fn(async () => undefined);
    vi.spyOn(useChatStore, 'getState').mockReturnValue({
      messages: [
        {
          id: 'ongoing',
          content: 'ongoing',
          timestamp: 1_000,
          type: 'text',
          mode: 'record',
          duration: undefined,
        },
      ],
      insertActivity,
    } as never);
    vi.spyOn(useTodoStore, 'getState').mockReturnValue({ addTodo: vi.fn(async () => undefined) } as never);

    const result = await commitMagicPenDrafts([buildActivityDraft('overlap', 900, 1_100)]);
    expect(result.failedDraftIds).toEqual(['overlap']);
    expect(insertActivity).not.toHaveBeenCalled();
  });
});
