// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/growth/GrowthPage.tsx
// Unified Todo Store — merges old useTodoStore + useGrowthTodoStore
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../api/supabase';
import { callClassifierAPI } from '../api/client';
import {
  classifyRecordActivityType,
  normalizeTodoCategory,
  type ActivityRecordType,
} from '../lib/activityType';
import { buildClassifierRawInput } from '../lib/classifierRawInput';
import { mapDiaryClassifierCategoryToActivityType } from '../lib/categoryAdapters';
import { getSupabaseSession } from '../lib/supabase-utils';
import { fromDbTodo, toDbTodo, toDbTodoUpdates } from '../lib/dbMappers';
import { useAnnotationStore } from './useAnnotationStore';
import { useGrowthStore } from './useGrowthStore';
import type { AnnotationEvent } from '../types/annotation';
import { resolveCurrentLang, resolveLangForText } from './storeLangHelpers';
import {
  getLocalDayRange,
  getTodoFreshness,
  isTodoParentForeignKeyError,
  migrateOldTodoStorage,
  sanitizeSortOrder,
  todayDateStr,
  todayDayOfMonth,
  todayDayOfWeek,
} from './todoStoreHelpers';

// ── Priority types ──────────────────────────────────────────
export type Priority = 'urgent-important' | 'urgent-not-important' | 'important-not-urgent' | 'not-important-not-urgent';
export type GrowthPriority = 'high' | 'medium' | 'low';
export type TodoPriority = Priority | GrowthPriority;
export type TodoScope = 'daily' | 'weekly' | 'monthly';
export type Recurrence = 'none' | 'once' | 'daily' | 'weekly' | 'monthly';

// ── Unified Todo interface ──────────────────────────────────
export interface Todo {
  id: string;
  title: string;                     // was 'content' in old store
  completed: boolean;
  createdAt: number;
  priority: TodoPriority;
  dueAt?: number;                    // was 'dueDate' in old store
  startedAt?: number;
  completedAt?: number;
  duration?: number;                 // elapsed minutes
  // Categorization (legacy, used by Report / MagicPen)
  category?: ActivityRecordType;
  scope?: TodoScope;
  // Recurrence
  recurrence?: Recurrence;
  recurrenceDays?: number[];         // 0-6 (Sun-Sat), for weekly
  isTemplate?: boolean;
  templateId?: string;
  recurrenceId?: string;             // legacy grouping key
  // Growth-specific
  bottleId?: string;
  sortOrder: number;
  // Sub-todo (AI decompose)
  parentId?: string;
  suggestedDuration?: number; // AI-suggested duration in minutes
  // UI
  isPinned?: boolean;
  // Sync state tracking（离线优先）
  syncState?: 'pending' | 'synced' | 'failed';
}

/** Backward-compat alias for growth components */
export type GrowthTodo = Todo;
/** Check if a recurrence value means "non-recurring" */
export function isNonRecurring(r?: Recurrence): boolean {
  return !r || r === 'none' || r === 'once';
}

// ── Background Supabase sync (fire-and-forget) ──────────────
async function bgSyncUpdate(id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>): Promise<void> {
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
    if (error) console.error('Error syncing todo update:', error);
  } catch (e) {
    console.error('bgSyncUpdate failed:', e);
  }
}

// bgSyncInsert：插入成功后回写 syncState:'synced'，失败后回写 'failed'
async function bgSyncInsert(todo: Todo): Promise<void> {
  try {
    const session = await getSupabaseSession();
    if (!session) return;
    const { error } = await supabase
      .from('todos')
      .upsert([toDbTodo(todo, session.user.id)], { onConflict: 'id' });
    if (error) {
      console.error('Error syncing todo insert:', error);
      useTodoStore.setState((s) => ({
        todos: s.todos.map((t) =>
          t.id === todo.id ? { ...t, syncState: 'failed' as const } : t
        ),
      }));
      return;
    }
    useTodoStore.setState((s) => ({
      todos: s.todos.map((t) =>
        t.id === todo.id ? { ...t, syncState: 'synced' as const } : t
      ),
    }));
  } catch (e) {
    console.error('bgSyncInsert failed:', e);
    useTodoStore.setState((s) => ({
      todos: s.todos.map((t) =>
        t.id === todo.id ? { ...t, syncState: 'failed' as const } : t
      ),
    }));
  }
}

// bgSyncDelete：软删除（UPDATE deleted_at），不再硬删除
async function bgSyncDelete(id: string): Promise<boolean> {
  try {
    const session = await getSupabaseSession();
    if (!session) return false;
    const { error } = await supabase
      .from('todos')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', session.user.id);
    if (error) {
      console.error('Error syncing todo soft-delete:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('bgSyncDelete failed:', e);
    return false;
  }
}

async function refineTodoCategoryWithAI(id: string, title: string): Promise<void> {
  try {
    const lang = resolveLangForText(title);
    const result = await callClassifierAPI({
      rawInput: buildClassifierRawInput(title, lang),
      lang,
    });
    const firstItem = result.data?.items?.[0];
    if (!firstItem?.category) return;
    const nextCategory = mapDiaryClassifierCategoryToActivityType(firstItem.category, title, lang);
    useTodoStore.setState((state) => ({
      todos: state.todos.map((todo) => (todo.id === id ? { ...todo, category: nextCategory } : todo)),
    }));
    await bgSyncUpdate(id, { category: nextCategory });
  } catch {
    return;
  }
}

// ── Store interface ─────────────────────────────────────────
interface TodoState {
  todos: Todo[];
  categories: ActivityRecordType[];
  isLoading: boolean;
  hasHydrated: boolean;
  lastSyncError: string | null;
  activeTodoId: string | null;
  lastGeneratedDate: string;
  suppressedTemplateDateMap: Record<string, string>;
  pendingDeletedTodoIds: Record<string, number>;
  activeMessageMap: Record<string, string>;
  todoCompletionMessageMap: Record<string, string>;
  todoBottleStarRewardMap: Record<string, { bottleId: string; stars: number }>;
  messageBottleStarRewardMap: Record<string, { bottleId: string; stars: number; todoId?: string }>;

  fetchTodos: () => Promise<void>;
  addTodo: (input: {
    title: string;
    priority: TodoPriority;
    bottleId?: string;
    dueAt?: number;
    recurrence?: Recurrence;
    recurrenceDays?: number[];
    category?: ActivityRecordType;
    scope?: TodoScope;
  }) => void;
  addSubTodos: (
    parentId: string,
    steps: Array<{ title: string; suggestedDuration: number }>,
    options?: { replaceExisting?: boolean }
  ) => void;
  updateTodo: (id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>) => Promise<void>;
  toggleTodo: (id: string) => void;
  togglePin: (id: string) => void;
  deleteTodo: (id: string) => void;
  addCategory: (category: ActivityRecordType) => void;
  startTodo: (id: string) => void;
  completeActiveTodo: () => Promise<void>;
  completeTodoWithDuration: (id: string, duration: number) => Promise<void>;
  setActiveTodoId: (id: string | null) => void;
  reorderTodos: (id: string, direction: 'up' | 'down') => void;
  reorderTodosByIds: (orderedIds: string[]) => void;
  generateRecurringTodos: () => void;
  linkMessageToTodo: (messageId: string, todoId: string) => void;
  completeTodoByMessage: (messageId: string) => Todo | null;
  setTodoCompletionMessage: (todoId: string, messageId: string) => void;
  getTodoCompletionMessage: (todoId: string) => string | undefined;
  clearTodoCompletionMessage: (todoId: string) => void;
  registerBottleStarReward: (params: { todoId?: string; messageId?: string; bottleId: string; stars: number }) => void;
  consumeBottleStarRewardByTodo: (todoId: string) => { bottleId: string; stars: number } | null;
  consumeBottleStarRewardByMessage: (messageId: string) => { bottleId: string; stars: number } | null;
}

// ── Unified Store ───────────────────────────────────────────
export const useTodoStore = create<TodoState>()(
  persist(
    (set, get) => ({
      todos: [],
      categories: ['study', 'work', 'social', 'life', 'entertainment', 'health'],
      isLoading: false,
      hasHydrated: false,
      lastSyncError: null,
      activeTodoId: null,
      lastGeneratedDate: '',
      suppressedTemplateDateMap: {},
      pendingDeletedTodoIds: {},
      activeMessageMap: {},
      todoCompletionMessageMap: {},
      todoBottleStarRewardMap: {},
      messageBottleStarRewardMap: {},

      // ── Fetch from Supabase ──────────────────────────────────────────────
      // 策略：推 pending/failed → 收集仍然失败的 → 拉云端（软删除过滤）→ 合并失败的进去
      // syncState='synced' 但云端没有的条目 = 已在其他设备删除，本地也移除（防复活）
      fetchTodos: async () => {
        set({ isLoading: true, lastSyncError: null });
        try {
          const session = await getSupabaseSession();
          if (!session) {
            set({ isLoading: false, hasHydrated: true });
            return;
          }
          const now = Date.now();
          const pendingDeleteEntries = Object.entries(get().pendingDeletedTodoIds)
            .filter(([, at]) => Number.isFinite(at) && now - at < 3 * 24 * 60 * 60 * 1000);
          const pendingDeletedIds = new Set(pendingDeleteEntries.map(([id]) => id));
          if (pendingDeleteEntries.length !== Object.keys(get().pendingDeletedTodoIds).length) {
            set({ pendingDeletedTodoIds: Object.fromEntries(pendingDeleteEntries) });
          }
          if (pendingDeletedIds.size > 0) {
            await Promise.all(Array.from(pendingDeletedIds).map((todoId) => bgSyncDelete(todoId)));
          }

          // ① 找出本地所有未同步的条目（pending / failed / 无 syncState 的旧数据）
          //    并先修复本地明显孤儿 parentId（本地父任务不存在）
          const localTodos = get().todos.filter((todo) => !pendingDeletedIds.has(todo.id));
          const localTodoIdSet = new Set(localTodos.map((t) => t.id));
          let hasLocalOrphanParent = false;
          const normalizedLocalTodos = localTodos.map((todo) => {
            if (todo.parentId && !localTodoIdSet.has(todo.parentId)) {
              hasLocalOrphanParent = true;
              return { ...todo, parentId: undefined, syncState: 'pending' as const };
            }
            return todo;
          });
          if (hasLocalOrphanParent) {
            set({ todos: normalizedLocalTodos });
          }

          const needsPush = normalizedLocalTodos.filter(
            (t) => !t.syncState || t.syncState === 'pending' || t.syncState === 'failed'
          );
          const pushTodoById = new Map(needsPush.map((todo) => [todo.id, todo]));

          async function upsertTodo(todo: Todo): Promise<void> {
            const { error } = await supabase
              .from('todos')
              .upsert([toDbTodo(todo, session.user.id)], { onConflict: 'id' });
            if (error) throw error;
          }

          async function upsertTodoWithParentRecovery(todo: Todo): Promise<void> {
            try {
              await upsertTodo(todo);
              return;
            } catch (error) {
              if (!isTodoParentForeignKeyError(error)) throw error;
            }

            const parentId = todo.parentId;
            if (parentId) {
              const parentTodo = pushTodoById.get(parentId);
              if (parentTodo) {
                await upsertTodo(parentTodo);
                await upsertTodo(todo);
                return;
              }
            }

            const detachedTodo: Todo = { ...todo, parentId: undefined };
            await upsertTodo(detachedTodo);
          }

          // ② 尝试推送，收集仍然失败的
          const failedById = new Map<string, Todo>();
          const markFailed = (todo: Todo) => {
            failedById.set(todo.id, { ...todo, syncState: 'failed' as const });
          };

          const parentTodos = needsPush.filter((todo) => !todo.parentId);
          const childTodos = needsPush.filter((todo) => !!todo.parentId);

          await Promise.all(
            parentTodos.map(async (todo) => {
              try {
                await upsertTodo(todo);
              } catch {
                markFailed(todo);
              }
            })
          );

          await Promise.all(
            childTodos.map(async (todo) => {
              try {
                await upsertTodoWithParentRecovery(todo);
              } catch {
                markFailed(todo);
              }
            })
          );

          const stillFailed = Array.from(failedById.values());

          // ③ 拉云端（只拉未软删除的）
          const { data, error } = await supabase
            .from('todos')
            .select('*')
            .eq('user_id', session.user.id)
            .is('deleted_at', null);

          if (error) {
            console.error('Error fetching todos:', error);
            set({ isLoading: false, hasHydrated: true, lastSyncError: error.message });
            return;
          }

          const cloudTodosRaw = data.map(fromDbTodo); // syncState: 'synced'
          const cloudIdsRaw = new Set(cloudTodosRaw.map((t) => t.id));
          const cloudTodos = cloudTodosRaw.filter((todo) => !pendingDeletedIds.has(todo.id));

          // 顺手修正 category（历史数据标准化）
          data.forEach((row) => {
            const normalizedCategory = normalizeTodoCategory(row.category, row.content, resolveLangForText(row.content ?? ''));
            if (row.category !== normalizedCategory) {
              void bgSyncUpdate(row.id, { category: normalizedCategory });
            }
          });

          // ④ 合并：云端数据 + 仍然失败的本地条目（云端没有的才保留）
          const cloudIds = new Set(cloudTodos.map((t) => t.id));
          const survivingFailed = stillFailed
            .filter((t) => !cloudIds.has(t.id) && !pendingDeletedIds.has(t.id))
            .map((t) => ({ ...t, syncState: 'failed' as const }));

          // ⑤ 一次性迁移旧 todo-storage（历史兼容）
          const migrated = migrateOldTodoStorage(cloudIdsRaw, {
            normalizeTodoCategory,
            resolveLangForText,
          }) as Todo[];
          migrated.forEach((t) => bgSyncInsert(t).catch(console.error));

          const nextPendingDeleted = Object.fromEntries(
            pendingDeleteEntries.filter(([id]) => cloudIdsRaw.has(id))
          );

          set({
            todos: [...cloudTodos, ...survivingFailed, ...migrated],
            pendingDeletedTodoIds: nextPendingDeleted,
            isLoading: false,
            hasHydrated: true,
            lastSyncError: stillFailed.length > 0
              ? `${stillFailed.length} 条待办同步失败，将在下次重试`
              : null,
          });
        } catch (err) {
          set({
            isLoading: false,
            hasHydrated: true,
            lastSyncError: err instanceof Error ? err.message : 'todo_sync_failed',
          });
        }
      },

      // ── Add todo (unified: supports growth + legacy fields) ──
      addTodo: (input) => {
        const { todos } = get();
        const minOrder = todos
          .filter((t) => !t.isTemplate)
          .reduce((min, t) => Math.min(min, sanitizeSortOrder(t.sortOrder, Date.now())), Infinity);
        const defaultSortOrder = minOrder === Infinity
          ? 0
          : sanitizeSortOrder(minOrder - 1, Date.now());
        const recurrence = input.recurrence ?? 'once';
        const isRecurring = !isNonRecurring(recurrence);
        const lang = resolveLangForText(input.title);
        const ruleClassified = classifyRecordActivityType(input.title, lang);
        const normalizedCategory = normalizeTodoCategory(input.category, input.title, lang);
        const shouldRefineByAI = ruleClassified.confidence === 'low';

        if (isRecurring) {
          const templateId = uuidv4();
          const template: Todo = {
            id: templateId,
            title: input.title,
            priority: input.priority,
            bottleId: input.bottleId,
            completed: false,
            createdAt: Date.now(),
            dueAt: input.dueAt,
            recurrence,
            recurrenceDays: input.recurrenceDays,
            isTemplate: true,
            sortOrder: defaultSortOrder,
            category: normalizedCategory,
            scope: input.scope,
            syncState: 'pending',
          };

          const shouldGenerate =
            recurrence === 'daily' ||
            (recurrence === 'monthly' && todayDayOfMonth() === 1) ||
            (recurrence === 'weekly' && (input.recurrenceDays ?? []).includes(todayDayOfWeek()));

          const newTodos: Todo[] = [template];
          if (shouldGenerate) {
            const instance: Todo = {
              id: uuidv4(),
              title: input.title,
              priority: input.priority,
              bottleId: input.bottleId,
              completed: false,
              createdAt: Date.now(),
              recurrence: 'once',
              isTemplate: false,
              templateId,
              sortOrder: defaultSortOrder,
              category: normalizedCategory,
              scope: input.scope,
              syncState: 'pending',
            };
            newTodos.push(instance);
            bgSyncInsert(instance).catch(console.error);
            if (shouldRefineByAI) {
              void refineTodoCategoryWithAI(instance.id, instance.title);
            }
          }
          set((s) => ({ todos: [...s.todos, ...newTodos] }));
          bgSyncInsert(template).catch(console.error);
          if (shouldRefineByAI) {
            void refineTodoCategoryWithAI(template.id, template.title);
          }
        } else {
          const todo: Todo = {
            id: uuidv4(),
            title: input.title,
            priority: input.priority,
            bottleId: input.bottleId,
            completed: false,
            createdAt: Date.now(),
            dueAt: input.dueAt,
            recurrence: 'once',
            isTemplate: false,
            sortOrder: defaultSortOrder,
            category: normalizedCategory,
            scope: input.scope,
            syncState: 'pending',
          };
          set((s) => ({ todos: [...s.todos, todo] }));
          bgSyncInsert(todo).catch(console.error);
          if (shouldRefineByAI) {
            void refineTodoCategoryWithAI(todo.id, todo.title);
          }
        }
      },

      // ── Update todo (optimistic + Supabase sync) ──
      updateTodo: async (id, updates) => {
        set((state) => ({
          todos: state.todos.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
        await bgSyncUpdate(id, updates);
      },

      // ── Toggle completion ──
      toggleTodo: (id) => {
        const todo = get().todos.find((t) => t.id === id);
        if (!todo) return;
        const completed = !todo.completed;
        const completedAt = completed ? Date.now() : undefined;
        set((state) => {
          const nextTodos = state.todos.map((t) =>
            t.id === id ? { ...t, completed, completedAt } : t
          );
          // Auto-complete parent when all its sub-todos are completed
          if (completed && todo.parentId) {
            const siblings = nextTodos.filter((t) => t.parentId === todo.parentId);
            const allDone = siblings.every((t) => t.completed);
            if (allDone) {
              const now = Date.now();
              bgSyncUpdate(todo.parentId, { completed: true, completedAt: now }).catch(console.error);
              return {
                todos: nextTodos.map((t) =>
                  t.id === todo.parentId ? { ...t, completed: true, completedAt: now } : t
                ),
              };
            }
          }
          return { todos: nextTodos };
        });
        bgSyncUpdate(id, { completed, completedAt }).catch(console.error);
      },

      // ── Toggle pin ──
      togglePin: (id) => {
        const todo = get().todos.find((t) => t.id === id);
        if (!todo) return;
        const isPinned = !todo.isPinned;
        set((state) => ({
          todos: state.todos.map((t) => (t.id === id ? { ...t, isPinned } : t)),
        }));
        bgSyncUpdate(id, { isPinned }).catch(console.error);
      },

      // ── Delete todo (template cascade + annotation + Supabase) ──
      deleteTodo: (id) => {
        const todo = get().todos.find((t) => t.id === id);
        if (!todo) return;
        const markPendingDeletion = (ids: string[]) => {
          const deletedAt = Date.now();
          set((state) => ({
            pendingDeletedTodoIds: {
              ...state.pendingDeletedTodoIds,
              ...Object.fromEntries(ids.map((todoId) => [todoId, deletedAt])),
            },
          }));
        };
        const clearPendingDeletion = (todoId: string) => {
          set((state) => {
            if (!(todoId in state.pendingDeletedTodoIds)) return state;
            const nextPending = { ...state.pendingDeletedTodoIds };
            delete nextPending[todoId];
            return { pendingDeletedTodoIds: nextPending };
          });
        };
        if (todo.isTemplate) {
          const instanceIds = get()
            .todos.filter((t) => t.templateId === id && !t.completed)
            .map((t) => t.id);
          [id, ...instanceIds].forEach((todoId) => {
            const reward = get().consumeBottleStarRewardByTodo(todoId);
            if (reward) {
              useGrowthStore.getState().decrementBottleStars(reward.bottleId, reward.stars);
            }
          });
          set((s) => ({
            todos: s.todos.filter(
              (t) => t.id !== id && !(t.templateId === id && !t.completed)
            ),
            suppressedTemplateDateMap: Object.fromEntries(
              Object.entries(s.suppressedTemplateDateMap).filter(([templateId]) => templateId !== id)
            ),
            todoCompletionMessageMap: Object.fromEntries(
              Object.entries(s.todoCompletionMessageMap).filter(([todoId]) => todoId !== id && !instanceIds.includes(todoId))
            ),
            todoBottleStarRewardMap: Object.fromEntries(
              Object.entries(s.todoBottleStarRewardMap).filter(([todoId]) => todoId !== id && !instanceIds.includes(todoId))
            ),
            messageBottleStarRewardMap: Object.fromEntries(
              Object.entries(s.messageBottleStarRewardMap).filter(([, reward]) => reward.todoId !== id && !instanceIds.includes(reward.todoId || ''))
            ),
          }));
          idsToDelete.forEach((todoId) => {
            void bgSyncDelete(todoId).then((ok) => {
              if (ok) clearPendingDeletion(todoId);
            });
          });
        } else {
          const reward = get().consumeBottleStarRewardByTodo(id);
          if (reward) {
            useGrowthStore.getState().decrementBottleStars(reward.bottleId, reward.stars);
          }
          set((s) => ({
            todos: s.todos.filter((t) => t.id !== id),
            suppressedTemplateDateMap: todo.templateId
              ? { ...s.suppressedTemplateDateMap, [todo.templateId]: todayDateStr() }
              : s.suppressedTemplateDateMap,
            todoCompletionMessageMap: Object.fromEntries(
              Object.entries(s.todoCompletionMessageMap).filter(([todoId]) => todoId !== id)
            ),
            todoCompletionRewardStarsMap: Object.fromEntries(
              Object.entries(s.todoCompletionRewardStarsMap).filter(([todoId]) => todoId !== id)
            ),
          }));
          void bgSyncDelete(id).then((ok) => {
            if (ok) clearPendingDeletion(id);
          });
        }

        const annotationStore = useAnnotationStore.getState();
        const event: AnnotationEvent = {
          type: 'task_deleted',
          timestamp: Date.now(),
          data: { content: todo.title },
        };
        annotationStore.triggerAnnotation(event).catch(console.error);
      },

      addCategory: (category) =>
        set((state) => (
          state.categories.includes(category)
            ? { categories: state.categories }
            : { categories: [...state.categories, category] }
        )),

      // ── Start working on a todo ──
      startTodo: (id) => {
        const now = Date.now();
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === id ? { ...t, startedAt: now } : t
          ),
          activeTodoId: id,
        }));
        bgSyncUpdate(id, { startedAt: now, completed: false, completedAt: undefined }).catch(console.error);
      },

      // ── Complete the currently active todo (for ChatPage) ──
      completeActiveTodo: async () => {
        const { activeTodoId, todos } = get();
        if (!activeTodoId) return;

        const todo = todos.find((t) => t.id === activeTodoId);
        if (!todo || !todo.startedAt) return;

        const now = Date.now();
        const duration = Math.round((now - todo.startedAt) / (1000 * 60));

        set((state) => ({
          todos: state.todos.map((t) =>
            t.id === activeTodoId
              ? { ...t, completed: true, completedAt: now, duration }
              : t
          ),
          activeTodoId: null,
        }));

        await bgSyncUpdate(activeTodoId, {
          completed: true,
          completedAt: now,
          duration,
        });
      },

      // ── Complete with explicit duration ──
      completeTodoWithDuration: async (id, duration) => {
        const now = Date.now();
        set((state) => ({
          todos: state.todos.map((t) =>
            t.id === id ? { ...t, completed: true, completedAt: now, duration } : t
          ),
        }));
        await bgSyncUpdate(id, { completed: true, completedAt: now, duration });
      },

      setActiveTodoId: (id) => set({ activeTodoId: id }),

      // ── Add AI-decomposed sub-todos under a parent ──
      addSubTodos: (parentId, steps, options) => {
        const parent = get().todos.find((t) => t.id === parentId);
        if (!parent) return;
        const now = Date.now();
        const shouldReplace = options?.replaceExisting === true;
        const existingSubTodos = shouldReplace
          ? get().todos.filter((t) => t.parentId === parentId)
          : [];
        const subTodos: Todo[] = steps.map((step, i) => ({
          id: uuidv4(),
          title: step.title,
          completed: false,
          createdAt: now + i,
          priority: parent.priority,
          bottleId: parent.bottleId,
          recurrence: 'once' as Recurrence,
          isTemplate: false,
          sortOrder: now + i,
          parentId,
          suggestedDuration: step.suggestedDuration,
          category: parent.category,
          syncState: 'pending' as const,
        }));
        set((s) => ({
          todos: [
            ...s.todos.filter((t) => !(shouldReplace && t.parentId === parentId)),
            ...subTodos,
          ],
        }));
        existingSubTodos.forEach((t) => bgSyncDelete(t.id).catch(console.error));
        subTodos.forEach((t) => bgSyncInsert(t).catch(console.error));
      },

      // ── Reorder todos ──
      reorderTodos: (id, direction) => {
        const { todos } = get();
        const visible = todos
          .filter((t) => !t.isTemplate)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        const idx = visible.findIndex((t) => t.id === id);
        if (idx < 0) return;

        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= visible.length) return;

        const thisOrder = visible[idx].sortOrder;
        const thatOrder = visible[swapIdx].sortOrder;
        const currentTodoId = visible[idx].id;
        const swapTodoId = visible[swapIdx].id;

        set((s) => ({
          todos: s.todos.map((t) => {
            if (t.id === currentTodoId) return { ...t, sortOrder: thatOrder };
            if (t.id === swapTodoId) return { ...t, sortOrder: thisOrder };
            return t;
          }),
        }));

        void Promise.all([
          bgSyncUpdate(currentTodoId, { sortOrder: thatOrder }),
          bgSyncUpdate(swapTodoId, { sortOrder: thisOrder }),
        ]).catch(console.error);
      },

      reorderTodosByIds: (orderedIds) => {
        if (orderedIds.length <= 1) return;
        const orderMap = new Map(orderedIds.map((todoId, index) => [todoId, index]));
        const changed: Array<{ id: string; sortOrder: number }> = [];

        set((state) => ({
          todos: state.todos.map((todo) => {
            const nextOrder = orderMap.get(todo.id);
            if (nextOrder === undefined || todo.sortOrder === nextOrder) return todo;
            changed.push({ id: todo.id, sortOrder: nextOrder });
            return { ...todo, sortOrder: nextOrder };
          }),
        }));

        if (changed.length === 0) return;
        void Promise.all(changed.map((item) => bgSyncUpdate(item.id, { sortOrder: item.sortOrder }))).catch(console.error);
      },

      // ── Generate recurring todos for today ──
      generateRecurringTodos: () => {
        const { todos, lastGeneratedDate, suppressedTemplateDateMap } = get();
        const today = todayDateStr();
        const templates = todos.filter((t) => t.isTemplate);
        const templateIdSet = new Set(templates.map((tpl) => tpl.id));
        const nextSuppressedTemplateDateMap = Object.fromEntries(
          Object.entries(suppressedTemplateDateMap).filter(
            ([templateId, dateKey]) => dateKey === today && templateIdSet.has(templateId)
          )
        );
        if (lastGeneratedDate === today) {
          if (Object.keys(nextSuppressedTemplateDateMap).length !== Object.keys(suppressedTemplateDateMap).length) {
            set({ suppressedTemplateDateMap: nextSuppressedTemplateDateMap });
          }
          return;
        }

        const dayOfWeek = todayDayOfWeek();
        const dayOfMonth = todayDayOfMonth();
        const { start: todayStart, end: todayEnd } = getLocalDayRange(today);
        const newInstances: Todo[] = [];

        for (const tpl of templates) {
          if (tpl.recurrence === 'daily') {
            // always generate
          } else if (tpl.recurrence === 'weekly') {
            if (!(tpl.recurrenceDays ?? []).includes(dayOfWeek)) continue;
          } else if (tpl.recurrence === 'monthly') {
            if (dayOfMonth !== 1) continue;
          } else {
            continue;
          }

          if (nextSuppressedTemplateDateMap[tpl.id] === today) continue;

          const hasUnfinishedInstance = todos.some(
            (t) => t.templateId === tpl.id && !t.completed
          );
          if (hasUnfinishedInstance) continue;

          const exists = todos.some(
            (t) =>
              t.templateId === tpl.id &&
              t.createdAt >= todayStart &&
              t.createdAt < todayEnd
          );
          if (exists) continue;

          const instance: Todo = {
            id: uuidv4(),
            title: tpl.title,
            priority: tpl.priority,
            bottleId: tpl.bottleId,
            completed: false,
            createdAt: Date.now(),
            recurrence: 'once',
            isTemplate: false,
            templateId: tpl.id,
            sortOrder: tpl.sortOrder,
            category: tpl.category,
            scope: tpl.scope,
          };
          newInstances.push(instance);
          bgSyncInsert(instance).catch(console.error);
        }

        set((s) => ({
          todos: [...s.todos, ...newInstances],
          lastGeneratedDate: today,
          suppressedTemplateDateMap: nextSuppressedTemplateDateMap,
        }));
      },

      // ── Link a chat message to a todo ──
      linkMessageToTodo: (messageId, todoId) => {
        set((s) => ({
          activeMessageMap: { ...s.activeMessageMap, [messageId]: todoId },
        }));
      },

      // ── Complete a todo when its linked message ends ──
      completeTodoByMessage: (messageId) => {
        const { activeMessageMap, todos } = get();
        const todoId = activeMessageMap[messageId];
        if (!todoId) return null;
        const todo = todos.find((t) => t.id === todoId);
        if (todo && !todo.completed) {
          const now = Date.now();
          const completedAt = now;
          const duration = todo.startedAt
            ? Math.round((now - todo.startedAt) / 60000)
            : undefined;
          const completedTodo: Todo = {
            ...todo,
            completed: true,
            completedAt,
            duration,
          };
          set((s) => ({
            todos: s.todos.map((t) =>
              t.id === todoId ? completedTodo : t
            ),
            activeMessageMap: Object.fromEntries(
              Object.entries(s.activeMessageMap).filter(([k]) => k !== messageId)
            ),
          }));
          bgSyncUpdate(todoId, { completed: true, completedAt, duration }).catch(console.error);
          return completedTodo;
        }
        return null;
      },

      setTodoCompletionMessage: (todoId, messageId) => {
        set((s) => ({
          todoCompletionMessageMap: {
            ...s.todoCompletionMessageMap,
            [todoId]: messageId,
          },
          messageBottleStarRewardMap: s.todoBottleStarRewardMap[todoId]
            ? {
              ...s.messageBottleStarRewardMap,
              [messageId]: {
                bottleId: s.todoBottleStarRewardMap[todoId].bottleId,
                stars: s.todoBottleStarRewardMap[todoId].stars,
                todoId,
              },
            }
            : s.messageBottleStarRewardMap,
        }));
      },

      getTodoCompletionMessage: (todoId) => get().todoCompletionMessageMap[todoId],
      clearTodoCompletionMessage: (todoId) => {
        set((s) => ({
          todoCompletionMessageMap: Object.fromEntries(
            Object.entries(s.todoCompletionMessageMap).filter(([key]) => key !== todoId)
          ),
        }));
      },

      registerBottleStarReward: ({ todoId, messageId, bottleId, stars }) => {
        const safeStars = Math.max(1, Math.floor(stars || 1));
        set((s) => {
          const nextTodoRewards = todoId
            ? {
              ...s.todoBottleStarRewardMap,
              [todoId]: { bottleId, stars: safeStars },
            }
            : s.todoBottleStarRewardMap;
          const linkedMessageId = messageId || (todoId ? s.todoCompletionMessageMap[todoId] : undefined);
          const nextMessageRewards = linkedMessageId
            ? {
              ...s.messageBottleStarRewardMap,
              [linkedMessageId]: { bottleId, stars: safeStars, ...(todoId ? { todoId } : {}) },
            }
            : s.messageBottleStarRewardMap;
          return {
            todoBottleStarRewardMap: nextTodoRewards,
            messageBottleStarRewardMap: nextMessageRewards,
          };
        });
      },

      consumeBottleStarRewardByTodo: (todoId) => {
        const state = get();
        const reward = state.todoBottleStarRewardMap[todoId];
        if (!reward) return null;
        const linkedMessageId = state.todoCompletionMessageMap[todoId];
        set((s) => ({
          todoBottleStarRewardMap: Object.fromEntries(
            Object.entries(s.todoBottleStarRewardMap).filter(([key]) => key !== todoId)
          ),
          messageBottleStarRewardMap: linkedMessageId
            ? Object.fromEntries(
              Object.entries(s.messageBottleStarRewardMap).filter(([key]) => key !== linkedMessageId)
            )
            : s.messageBottleStarRewardMap,
        }));
        return reward;
      },

      consumeBottleStarRewardByMessage: (messageId) => {
        const state = get();
        const reward = state.messageBottleStarRewardMap[messageId];
        if (!reward) return null;
        set((s) => ({
          messageBottleStarRewardMap: Object.fromEntries(
            Object.entries(s.messageBottleStarRewardMap).filter(([key]) => key !== messageId)
          ),
          todoBottleStarRewardMap: reward.todoId
            ? Object.fromEntries(
              Object.entries(s.todoBottleStarRewardMap).filter(([key]) => key !== reward.todoId)
            )
            : s.todoBottleStarRewardMap,
        }));
        return { bottleId: reward.bottleId, stars: reward.stars };
      },
    }),
    {
      name: 'growth-todo-store', // keep this key to preserve existing growth data
      partialize: (state) => ({
        todos: state.todos,
        categories: state.categories,
        activeTodoId: state.activeTodoId,
        lastGeneratedDate: state.lastGeneratedDate,
        suppressedTemplateDateMap: state.suppressedTemplateDateMap,
        pendingDeletedTodoIds: state.pendingDeletedTodoIds,
        activeMessageMap: state.activeMessageMap,
        todoCompletionMessageMap: state.todoCompletionMessageMap,
        todoBottleStarRewardMap: state.todoBottleStarRewardMap,
        messageBottleStarRewardMap: state.messageBottleStarRewardMap,
      }),
    }
  )
);
