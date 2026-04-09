import { describe, expect, it } from 'vitest';
import { fromDbTodo, toDbTodo, toDbTodoUpdates } from './dbMappers';
import type { Todo } from '../store/useTodoStore';

describe('dbMappers todo recurrence days', () => {
  it('hydrates recurrenceDays from Postgres array formats', () => {
    const todo = fromDbTodo({
      id: 'todo-1',
      content: 'Weekly task',
      completed: false,
      priority: 'medium',
      category: 'work',
      due_date: null,
      scope: 'weekly',
      created_at: 1710000000000,
      recurrence: 'weekly',
      recurrence_days: '{3,1,3,2}',
      recurrence_id: 'rec-1',
      completed_at: null,
      is_pinned: false,
      started_at: null,
      duration: null,
      bottle_id: null,
      sort_order: 42,
      is_template: true,
      template_id: null,
    });

    expect(todo.recurrenceDays).toEqual([1, 2, 3]);
  });

  it('persists recurrenceDays for inserts and updates', () => {
    const todo: Todo = {
      id: 'todo-2',
      title: 'Repeat on Monday and Friday',
      completed: false,
      createdAt: 1710000000000,
      priority: 'medium',
      recurrence: 'weekly',
      recurrenceDays: [5, 1, 5],
      sortOrder: 99,
    };

    expect(toDbTodo(todo, 'user-1')).toMatchObject({
      recurrence_days: [1, 5],
      user_id: 'user-1',
    });

    expect(toDbTodoUpdates({ recurrenceDays: [6, 0, 6] })).toEqual({
      recurrence_days: [0, 6],
    });
  });

  it('normalizes todo timestamps from string fields', () => {
    const todo = fromDbTodo({
      id: 'todo-time',
      content: 'Timestamp parsing',
      completed: false,
      priority: 'medium',
      category: 'work',
      due_date: '2026-04-09T10:30:00.000Z',
      scope: 'daily',
      created_at: '1710000000000',
      recurrence: 'once',
      recurrence_days: null,
      recurrence_id: null,
      completed_at: '1710003600000',
      is_pinned: false,
      started_at: '1710001800000',
      duration: 25,
      bottle_id: null,
      sort_order: '1710007200',
      is_template: false,
      template_id: null,
    });

    expect(todo.createdAt).toBe(1710000000000);
    expect(todo.completedAt).toBe(1710003600000);
    expect(todo.startedAt).toBe(1710001800000);
    expect(todo.sortOrder).toBe(1710007200000);
    expect(typeof todo.dueAt).toBe('number');
  });
});
