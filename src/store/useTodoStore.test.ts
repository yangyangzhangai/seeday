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

import { useOutboxStore } from './useOutboxStore';
import { setActiveStorageScope } from './storageScope';
import { useTodoStore } from './useTodoStore';

describe('useTodoStore delete durability', () => {
  beforeEach(() => {
    setActiveStorageScope({ type: 'user', userId: 'user-1' });
    useOutboxStore.setState({ entries: [] });
    useTodoStore.setState({
      todos: [{
        id: 'todo-1',
        title: 'One-time task',
        completed: false,
        createdAt: 1,
        priority: 'medium',
        recurrence: 'once',
        isTemplate: false,
        sortOrder: 1,
      }],
      pendingDeletedTodoIds: {},
      suppressedTemplateDateMap: {},
      todoCompletionMessageMap: {},
      todoBottleStarRewardMap: {},
      messageBottleStarRewardMap: {},
    });
  });

  it('queues a durable todo delete when cloud delete cannot start', async () => {
    useTodoStore.getState().deleteTodo('todo-1');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useTodoStore.getState().todos).toEqual([]);
    expect(useTodoStore.getState().pendingDeletedTodoIds['todo-1']).toBeTypeOf('number');
    expect(useOutboxStore.getState().entries).toHaveLength(1);
    const [entry] = useOutboxStore.getState().entries;
    expect(entry.kind).toBe('todo.delete');
    if (entry.kind !== 'todo.delete') return;
    expect(entry.payload.todoId).toBe('todo-1');
  });
});
