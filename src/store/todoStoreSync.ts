// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/README.md
import { callClassifierAPI } from '../api/client';
import { supabase } from '../api/supabase';
import { normalizeTodoCategory } from '../lib/activityType';
import { getSupabaseSession } from '../lib/supabase-utils';
import { fromDbTodo, toDbTodo, toDbTodoUpdates } from '../lib/dbMappers';
import { useAuthStore } from './useAuthStore';
import { useOutboxStore } from './useOutboxStore';
import { resolveLangForText } from './storeLangHelpers';
import type { Todo, TodoState } from './todoStoreTypes';

type UpdateTodosFn = (updater: (todos: Todo[]) => Todo[]) => void;

export function isNonRecurring(r?: Todo['recurrence']): boolean {
  return !r || r === 'none' || r === 'once';
}

export async function bgSyncUpdate(
  id: string,
  updates: Partial<Omit<Todo, 'id' | 'createdAt'>>,
): Promise<void> {
  try {
    const session = await getSupabaseSession();
    if (!session) return;
    const dbUpdates = toDbTodoUpdates(updates);
    if (Object.keys(dbUpdates).length === 0) return;
    const { error } = await supabase
      .from('todos')
      .update({ ...dbUpdates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', session.user.id);
    if (error && import.meta.env.DEV) console.error('Error syncing todo update:', error);
  } catch (e) {
    if (import.meta.env.DEV) console.error('bgSyncUpdate failed:', e);
  }
}

export async function bgSyncInsert(todo: Todo, updateTodos: UpdateTodosFn): Promise<void> {
  try {
    const session = await getSupabaseSession();
    if (!session) return;
    const { error } = await supabase
      .from('todos')
      .upsert([toDbTodo(todo, session.user.id)], { onConflict: 'id' });
    if (error) {
      if (import.meta.env.DEV) console.error('Error syncing todo insert:', error);
      updateTodos((todos) => todos.map((t) => (
        t.id === todo.id ? { ...t, syncState: 'failed' as const } : t
      )));
      return;
    }
    updateTodos((todos) => todos.map((t) => (
      t.id === todo.id ? { ...t, syncState: 'synced' as const } : t
    )));
  } catch (e) {
    if (import.meta.env.DEV) console.error('bgSyncInsert failed:', e);
    updateTodos((todos) => todos.map((t) => (
      t.id === todo.id ? { ...t, syncState: 'failed' as const } : t
    )));
  }
}

export async function bgSyncDelete(id: string): Promise<boolean> {
  try {
    const session = await getSupabaseSession();
    if (!session) return false;
    const deletedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('todos')
      .update({ deleted_at: deletedAt, updated_at: deletedAt })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('id')
      .maybeSingle();
    if (error) {
      if (import.meta.env.DEV) console.error('Error syncing todo soft-delete:', error);
      return false;
    }
    if (!data?.id) {
      if (import.meta.env.DEV) console.error('Todo soft-delete matched 0 rows:', id);
      return false;
    }
    return true;
  } catch (e) {
    if (import.meta.env.DEV) console.error('bgSyncDelete failed:', e);
    return false;
  }
}

export function shouldRetainPendingDelete(
  todoId: string,
  deletedAt: number,
  now: number,
  queuedDeleteIds: Set<string>,
): boolean {
  return queuedDeleteIds.has(todoId) || (Number.isFinite(deletedAt) && now - deletedAt < 3 * 24 * 60 * 60 * 1000);
}

export function ensureTodoDeleteQueued(todoId: string): void {
  const outbox = useOutboxStore.getState();
  const alreadyQueued = outbox.entries.some((entry) => (
    entry.kind === 'todo.delete' && entry.payload.todoId === todoId
  ));
  if (alreadyQueued) return;
  outbox.enqueue({
    kind: 'todo.delete',
    payload: { todoId },
    consecutiveFailures: 0,
  });
}

export async function refineTodoCategoryWithAI(
  id: string,
  title: string,
  updateTodos: UpdateTodosFn,
): Promise<void> {
  if (!useAuthStore.getState().isPlus) return;
  try {
    const lang = resolveLangForText(title);
    const result = await callClassifierAPI({ rawInput: title, lang });
    const nextCategory = result.data?.activity_type;
    if (!nextCategory) return;
    updateTodos((todos) => todos.map((todo) => (
      todo.id === id ? { ...todo, category: nextCategory } : todo
    )));
    await bgSyncUpdate(id, { category: nextCategory });
  } catch {
    return;
  }
}

export function collectTodoCascadeIds(todos: Todo[], rootIds: string[]): string[] {
  const pending = [...rootIds];
  const collected = new Set<string>();

  while (pending.length > 0) {
    const currentId = pending.pop();
    if (!currentId || collected.has(currentId)) continue;
    collected.add(currentId);

    todos.forEach((todo) => {
      if (todo.parentId === currentId && !collected.has(todo.id)) {
        pending.push(todo.id);
      }
    });
  }

  return Array.from(collected);
}

export function stripDeletedTodoArtifacts(
  state: TodoState,
  deletedIds: Set<string>,
): Partial<TodoState> {
  return {
    todos: state.todos.filter((todo) => !deletedIds.has(todo.id)),
    todoCompletionMessageMap: Object.fromEntries(
      Object.entries(state.todoCompletionMessageMap).filter(([todoId]) => !deletedIds.has(todoId)),
    ),
    todoBottleStarRewardMap: Object.fromEntries(
      Object.entries(state.todoBottleStarRewardMap).filter(([todoId]) => !deletedIds.has(todoId)),
    ),
    messageBottleStarRewardMap: Object.fromEntries(
      Object.entries(state.messageBottleStarRewardMap).filter(([, reward]) => !deletedIds.has(reward.todoId || '')),
    ),
    activeMessageMap: Object.fromEntries(
      Object.entries(state.activeMessageMap).filter(([, todoId]) => !deletedIds.has(todoId)),
    ),
  };
}

export function normalizeCloudTodoCategory(row: { id: string; category: string | null; content: string | null }): void {
  const normalizedCategory = normalizeTodoCategory(
    row.category,
    row.content,
    resolveLangForText(row.content ?? ''),
  );
  if (row.category !== normalizedCategory) {
    void bgSyncUpdate(row.id, { category: normalizedCategory });
  }
}

export function mapCloudTodos(data: Array<Record<string, unknown>>): Todo[] {
  return data.map((row) => fromDbTodo(row));
}
