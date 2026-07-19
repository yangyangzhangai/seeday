import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  triggerAnnotationMock,
  getSupabaseSessionMock,
  maybeSingleMock,
  selectMock,
  updateEqUserIdMock,
  updateEqIdMock,
  updateMock,
  upsertMock,
  selectBuilder,
  fromMock,
} = vi.hoisted(() => {
  const triggerAnnotationMock = vi.fn(async () => undefined);
  const getSupabaseSessionMock = vi.fn(async () => null as null | { user: { id: string } });
  const maybeSingleMock = vi.fn(async () => ({ data: null, error: null }));
  const selectMock = vi.fn(async () => ({ data: [], error: null }));
  const updateEqUserIdMock = vi.fn(() => ({
    select: () => ({ maybeSingle: maybeSingleMock }),
  }));
  const updateEqIdMock = vi.fn(() => ({ eq: updateEqUserIdMock }));
  const updateMock = vi.fn(() => ({ eq: updateEqIdMock }));
  const upsertMock = vi.fn(async () => ({ error: null }));
  const selectBuilder = {
    eq: vi.fn(() => ({
      is: selectMock,
    })),
  };
  const fromMock = vi.fn(() => ({
    update: updateMock,
    upsert: upsertMock,
    select: vi.fn(() => selectBuilder),
  }));

  return {
    triggerAnnotationMock,
    getSupabaseSessionMock,
    maybeSingleMock,
    selectMock,
    updateEqUserIdMock,
    updateEqIdMock,
    updateMock,
    upsertMock,
    selectBuilder,
    fromMock,
  };
});

vi.mock('../lib/supabase-utils', () => ({
  getSupabaseSession: getSupabaseSessionMock,
}));

vi.mock('../api/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('./useAnnotationStore', () => ({
  useAnnotationStore: {
    getState: () => ({
      triggerAnnotation: triggerAnnotationMock,
    }),
  },
}));

import { useOutboxStore } from './useOutboxStore';
import { setActiveStorageScope } from './storageScope';
import { useTodoStore } from './useTodoStore';

describe('useTodoStore delete durability', () => {
  beforeEach(() => {
    triggerAnnotationMock.mockClear();
    getSupabaseSessionMock.mockReset();
    getSupabaseSessionMock.mockResolvedValue(null);
    maybeSingleMock.mockClear();
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    selectMock.mockClear();
    selectMock.mockResolvedValue({ data: [], error: null });
    updateMock.mockClear();
    updateEqIdMock.mockClear();
    updateEqUserIdMock.mockClear();
    upsertMock.mockClear();
    fromMock.mockClear();
    selectBuilder.eq.mockClear();
    setActiveStorageScope({ type: 'user', userId: 'user-1' });
    useOutboxStore.setState({ entries: [] });
    useTodoStore.setState({
      todos: [],
      pendingDeletedTodoIds: {},
      suppressedTemplateDateMap: {},
      todoCompletionMessageMap: {},
      todoBottleStarRewardMap: {},
      messageBottleStarRewardMap: {},
      activeMessageMap: {},
      isLoading: false,
      hasHydrated: false,
      lastFetchedAt: null,
      lastSyncError: null,
      activeTodoId: null,
      lastGeneratedDate: '',
    });
  });

  it('queues a durable todo delete when cloud delete cannot start', async () => {
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
    });

    useTodoStore.getState().deleteTodo('todo-1');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useTodoStore.getState().todos).toEqual([]);
    expect(useTodoStore.getState().pendingDeletedTodoIds['todo-1']).toBeTypeOf('number');
    expect(useOutboxStore.getState().entries).toHaveLength(1);
    const [entry] = useOutboxStore.getState().entries;
    expect(entry.kind).toBe('todo.delete');
    if (entry.kind !== 'todo.delete') return;
    expect(entry.payload.todoId).toBe('todo-1');
    expect(triggerAnnotationMock).not.toHaveBeenCalled();
  });

  it('deletes subtasks together with their parent', async () => {
    useTodoStore.setState({
      todos: [
        {
          id: 'parent-1',
          title: 'Parent task',
          completed: false,
          createdAt: 1,
          priority: 'medium',
          recurrence: 'once',
          isTemplate: false,
          sortOrder: 1,
        },
        {
          id: 'sub-1',
          title: 'Sub task',
          completed: false,
          createdAt: 2,
          priority: 'medium',
          recurrence: 'once',
          isTemplate: false,
          sortOrder: 2,
          parentId: 'parent-1',
        },
      ],
    });

    useTodoStore.getState().deleteTodo('parent-1');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useTodoStore.getState().todos).toEqual([]);
    expect(useTodoStore.getState().pendingDeletedTodoIds['parent-1']).toBeTypeOf('number');
    expect(useTodoStore.getState().pendingDeletedTodoIds['sub-1']).toBeTypeOf('number');
    expect(useOutboxStore.getState().entries).toHaveLength(2);
    expect(useOutboxStore.getState().entries.map((entry) => entry.kind)).toEqual(['todo.delete', 'todo.delete']);
  });

  it('removes orphan subtasks during fetch instead of promoting them', async () => {
    getSupabaseSessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    selectMock.mockResolvedValue({
      data: [{
        id: 'orphan-sub-1',
        content: 'Orphan sub task',
        completed: false,
        priority: 'medium',
        category: 'life',
        due_date: null,
        scope: null,
        created_at: 10,
        recurrence: 'once',
        recurrence_days: null,
        recurrence_id: null,
        completed_at: null,
        is_pinned: false,
        started_at: null,
        duration: null,
        bottle_id: null,
        sort_order: 10,
        is_template: false,
        template_id: null,
        parent_id: 'missing-parent',
        suggested_duration: null,
      }],
      error: null,
    });
    useTodoStore.setState({
      todos: [],
    });

    await useTodoStore.getState().fetchTodos();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useTodoStore.getState().todos).toEqual([]);
    expect(useTodoStore.getState().pendingDeletedTodoIds['orphan-sub-1']).toBeTypeOf('number');
    expect(useOutboxStore.getState().entries).toHaveLength(1);
    const [entry] = useOutboxStore.getState().entries;
    expect(entry.kind).toBe('todo.delete');
    if (entry.kind !== 'todo.delete') return;
    expect(entry.payload.todoId).toBe('orphan-sub-1');
  });
});
