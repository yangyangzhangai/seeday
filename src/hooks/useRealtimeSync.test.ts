import { describe, expect, it } from 'vitest';

import { mergeRealtimeTodoInsert, mergeRealtimeTodoUpdate } from './useRealtimeSync';
import type { TodoState } from '../store/todoStoreTypes';

function createTodoState(overrides: Partial<Pick<TodoState, 'todos' | 'pendingDeletedTodoIds'>> = {}): Pick<TodoState, 'todos' | 'pendingDeletedTodoIds'> {
  return {
    todos: [],
    pendingDeletedTodoIds: {},
    ...overrides,
  };
}

describe('useRealtimeSync todo tombstones', () => {
  it('ignores late inserts for todos already marked pending delete', () => {
    const result = mergeRealtimeTodoInsert(
      createTodoState({
        pendingDeletedTodoIds: { 'todo-1': Date.now() },
      }),
      {
        id: 'todo-1',
        title: 'Late insert',
        completed: false,
        createdAt: 1,
        priority: 'medium',
        recurrence: 'once',
        isTemplate: false,
        sortOrder: 1,
      },
    );

    expect(result.todos).toEqual([]);
  });

  it('keeps pending-delete todos removed when a non-delete update arrives late', () => {
    const result = mergeRealtimeTodoUpdate(
      createTodoState({
        todos: [{
          id: 'todo-1',
          title: 'Existing row',
          completed: false,
          createdAt: 1,
          priority: 'medium',
          recurrence: 'once',
          isTemplate: false,
          sortOrder: 1,
        }],
        pendingDeletedTodoIds: { 'todo-1': Date.now() },
      }),
      {
        id: 'todo-1',
        title: 'Late update',
        completed: false,
        createdAt: 1,
        priority: 'medium',
        recurrence: 'once',
        isTemplate: false,
        sortOrder: 1,
      },
    );

    expect(result.todos).toEqual([]);
  });
});
