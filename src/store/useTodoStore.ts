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
import type { AnnotationEvent } from '../types/annotation';
import i18n from '../i18n';
import type { SupportedLang } from '../services/input/lexicon/getLexicon';

function resolveCurrentLang(): SupportedLang {
  const lang = i18n.language?.toLowerCase() ?? 'zh';
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('it')) return 'it';
  return 'zh';
}

function resolveLangForText(content: string): SupportedLang {
  if (/[\u3400-\u9fff]/.test(content)) return 'zh';
  const lowered = content.toLowerCase();
  if (/\b(sono|sto|stanco|stanca|felice|ansioso|ansiosa|sollevato|sollevata|sollievo|riunione|lezione|lavorando|studiando)\b/.test(lowered)) {
    return 'it';
  }
  if (/[A-Za-z\u00C0-\u017F]/.test(content)) return 'en';
  return resolveCurrentLang();
}

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
  // UI
  isPinned?: boolean;
}

/** Backward-compat alias for growth components */
export type GrowthTodo = Todo;

// ── Helpers ─────────────────────────────────────────────────
function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function todayDayOfWeek(): number {
  return new Date().getDay();
}

/** Check if a recurrence value means "non-recurring" */
export function isNonRecurring(r?: Recurrence): boolean {
  return !r || r === 'none' || r === 'once';
}

// ── One-time migration from old 'todo-storage' ──────────────
function migrateOldTodoStorage(currentIds: Set<string>): Todo[] {
  try {
    const raw = localStorage.getItem('todo-storage');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const oldTodos: Array<Record<string, unknown>> = parsed?.state?.todos ?? [];
    if (!oldTodos.length) return [];

    const priorityMap: Record<string, GrowthPriority> = {
      'urgent-important': 'high',
      'urgent-not-important': 'medium',
      'important-not-urgent': 'medium',
      'not-important-not-urgent': 'low',
    };

    const migrated: Todo[] = oldTodos
      .filter((t) => t.id && typeof t.id === 'string' && !currentIds.has(t.id as string))
      .map((t, i) => ({
        id: t.id as string,
        title: (t.content ?? t.title ?? '') as string,
        completed: Boolean(t.completed),
        createdAt: (t.createdAt as number) ?? Date.now(),
        priority: priorityMap[t.priority as string] ?? 'medium',
        dueAt: (t.dueDate ?? t.dueAt) as number | undefined,
        completedAt: t.completedAt as number | undefined,
        duration: t.duration as number | undefined,
        startedAt: t.startedAt as number | undefined,
        category: normalizeTodoCategory(
          t.category as string | undefined,
          (t.content ?? t.title ?? '') as string,
          resolveLangForText((t.content ?? t.title ?? '') as string),
        ),
        scope: t.scope as TodoScope | undefined,
        recurrence: 'once' as Recurrence,
        isTemplate: false,
        sortOrder: (t.dueDate ?? t.dueAt ?? (Date.now() + i)) as number,
        isPinned: Boolean(t.isPinned),
      }));

    if (migrated.length > 0) {
      // Clear old store after migration
      localStorage.removeItem('todo-storage');
    }
    return migrated;
  } catch {
    return [];
  }
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
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', session.user.id);
    if (error) console.error('Error syncing todo update:', error);
  } catch (e) {
    console.error('bgSyncUpdate failed:', e);
  }
}

async function bgSyncInsert(todo: Todo): Promise<void> {
  try {
    const session = await getSupabaseSession();
    if (!session) return;
    const { error } = await supabase.from('todos').insert([toDbTodo(todo, session.user.id)]);
    if (error) console.error('Error syncing todo insert:', error);
  } catch (e) {
    console.error('bgSyncInsert failed:', e);
  }
}

async function bgSyncDelete(id: string): Promise<void> {
  try {
    const session = await getSupabaseSession();
    if (!session) return;
    const { error } = await supabase.from('todos').delete().eq('id', id).eq('user_id', session.user.id);
    if (error) console.error('Error syncing todo delete:', error);
  } catch (e) {
    console.error('bgSyncDelete failed:', e);
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
  activeMessageMap: Record<string, string>;
  todoCompletionMessageMap: Record<string, string>;

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
  completeTodoByMessage: (messageId: string) => void;
  setTodoCompletionMessage: (todoId: string, messageId: string) => void;
  getTodoCompletionMessage: (todoId: string) => string | undefined;
  clearTodoCompletionMessage: (todoId: string) => void;
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
      activeMessageMap: {},
      todoCompletionMessageMap: {},

      // ── Fetch from Supabase (cloud is source of truth when signed in) ──
      fetchTodos: async () => {
        set({ isLoading: true, lastSyncError: null });
        try {
          const session = await getSupabaseSession();
          if (!session) {
            set({ isLoading: false, hasHydrated: true });
            return;
          }

          const { data, error } = await supabase
            .from('todos')
            .select('*')
            .eq('user_id', session.user.id);
          if (error) {
            console.error('Error fetching todos:', error);
            set({
              isLoading: false,
              hasHydrated: true,
              lastSyncError: error.message,
            });
            return;
          }
          const cloudTodos = data.map(fromDbTodo);
          data.forEach((row) => {
            const normalizedCategory = normalizeTodoCategory(row.category, row.content, resolveLangForText(row.content ?? ''));
            if (row.category !== normalizedCategory) {
              void bgSyncUpdate(row.id, { category: normalizedCategory });
            }
          });
          const cloudIds = new Set(cloudTodos.map((t) => t.id));
          const allIds = new Set(cloudIds);
          // Migrate old todo-storage data (one-time, clears old key after)
          const migrated = migrateOldTodoStorage(allIds);
          const merged = [
            ...cloudTodos,
            ...migrated,
          ];
          set({
            todos: merged,
            isLoading: false,
            hasHydrated: true,
            lastSyncError: null,
          });
          // Sync migrated todos to Supabase
          migrated.forEach((t) => bgSyncInsert(t).catch(console.error));
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
        const minOrder = todos.filter((t) => !t.isTemplate).reduce((min, t) => Math.min(min, t.sortOrder), Infinity);
        const defaultSortOrder = input.dueAt ?? (minOrder === Infinity ? 0 : minOrder - 1);
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
          };

          const shouldGenerate =
            recurrence === 'daily' ||
            recurrence === 'monthly' ||
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
        set((state) => ({
          todos: state.todos.map((t) =>
            t.id === id ? { ...t, completed, completedAt } : t
          ),
        }));
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

        if (todo.isTemplate) {
          const instanceIds = get()
            .todos.filter((t) => t.templateId === id && !t.completed)
            .map((t) => t.id);
          set((s) => ({
            todos: s.todos.filter(
              (t) => t.id !== id && !(t.templateId === id && !t.completed)
            ),
            todoCompletionMessageMap: Object.fromEntries(
              Object.entries(s.todoCompletionMessageMap).filter(([todoId]) => todoId !== id && !instanceIds.includes(todoId))
            ),
          }));
          bgSyncDelete(id).catch(console.error);
          instanceIds.forEach((iid) => bgSyncDelete(iid).catch(console.error));
        } else {
          set((s) => ({
            todos: s.todos.filter((t) => t.id !== id),
            todoCompletionMessageMap: Object.fromEntries(
              Object.entries(s.todoCompletionMessageMap).filter(([todoId]) => todoId !== id)
            ),
          }));
          bgSyncDelete(id).catch(console.error);
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
        const { todos, lastGeneratedDate } = get();
        const today = todayDateStr();
        if (lastGeneratedDate === today) return;

        const dayOfWeek = todayDayOfWeek();
        const templates = todos.filter((t) => t.isTemplate);
        const newInstances: Todo[] = [];

        for (const tpl of templates) {
          if (tpl.recurrence === 'daily') {
            // always generate
          } else if (tpl.recurrence === 'weekly') {
            if (!(tpl.recurrenceDays ?? []).includes(dayOfWeek)) continue;
          } else if (tpl.recurrence === 'monthly') {
            // generate on day 1
          } else {
            continue;
          }

          const todayStart = new Date(today).getTime();
          const todayEnd = todayStart + 86400000;
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
        if (!todoId) return;
        const todo = todos.find((t) => t.id === todoId);
        if (todo && !todo.completed) {
          const now = Date.now();
          const completedAt = now;
          const duration = todo.startedAt
            ? Math.round((now - todo.startedAt) / 60000)
            : undefined;
          set((s) => ({
            todos: s.todos.map((t) =>
              t.id === todoId ? { ...t, completed: true, completedAt, duration } : t
            ),
            activeMessageMap: Object.fromEntries(
              Object.entries(s.activeMessageMap).filter(([k]) => k !== messageId)
            ),
          }));
          bgSyncUpdate(todoId, { completed: true, completedAt, duration }).catch(console.error);
        }
      },

      setTodoCompletionMessage: (todoId, messageId) => {
        set((s) => ({
          todoCompletionMessageMap: {
            ...s.todoCompletionMessageMap,
            [todoId]: messageId,
          },
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
    }),
    {
      name: 'growth-todo-store', // keep this key to preserve existing growth data
      partialize: (state) => ({
        todos: state.todos,
        categories: state.categories,
        activeTodoId: state.activeTodoId,
        lastGeneratedDate: state.lastGeneratedDate,
        activeMessageMap: state.activeMessageMap,
        todoCompletionMessageMap: state.todoCompletionMessageMap,
      }),
    }
  )
);
