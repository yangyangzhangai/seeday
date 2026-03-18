// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/growth/GrowthPage.tsx
// Unified Todo Store — merges old useTodoStore + useGrowthTodoStore
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import { fromDbTodo, toDbTodo, toDbTodoUpdates } from '../lib/dbMappers';
import { useAnnotationStore } from './useAnnotationStore';
import type { AnnotationEvent } from '../types/annotation';

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
  category?: string;
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

// ── Store interface ─────────────────────────────────────────
interface TodoState {
  todos: Todo[];
  categories: string[];
  isLoading: boolean;
  activeTodoId: string | null;
  lastGeneratedDate: string;
  activeMessageMap: Record<string, string>;

  fetchTodos: () => Promise<void>;
  addTodo: (input: {
    title: string;
    priority: TodoPriority;
    bottleId?: string;
    dueAt?: number;
    recurrence?: Recurrence;
    recurrenceDays?: number[];
    category?: string;
    scope?: TodoScope;
  }) => void;
  updateTodo: (id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>) => Promise<void>;
  toggleTodo: (id: string) => void;
  togglePin: (id: string) => void;
  deleteTodo: (id: string) => void;
  addCategory: (category: string) => void;
  startTodo: (id: string) => void;
  completeActiveTodo: () => Promise<void>;
  completeTodoWithDuration: (id: string, duration: number) => Promise<void>;
  setActiveTodoId: (id: string | null) => void;
  reorderTodos: (id: string, direction: 'up' | 'down') => void;
  generateRecurringTodos: () => void;
  linkMessageToTodo: (messageId: string, todoId: string) => void;
  completeTodoByMessage: (messageId: string) => void;
}

// ── Unified Store ───────────────────────────────────────────
export const useTodoStore = create<TodoState>()(
  persist(
    (set, get) => ({
      todos: [],
      categories: ['study', 'work', 'social', 'life', 'entertainment'],
      isLoading: false,
      activeTodoId: null,
      lastGeneratedDate: '',
      activeMessageMap: {},

      // ── Fetch from Supabase (merge with local) ──
      fetchTodos: async () => {
        const session = await getSupabaseSession();
        if (!session) return;
        set({ isLoading: true });
        const { data, error } = await supabase
          .from('todos')
          .select('*')
          .eq('user_id', session.user.id);
        if (error) {
          console.error('Error fetching todos:', error);
          set({ isLoading: false });
          return;
        }
        const cloudTodos = data.map(fromDbTodo);
        const localTodos = get().todos;
        // Merge: cloud wins for matching IDs, keep local-only todos
        const cloudIds = new Set(cloudTodos.map((t) => t.id));
        const merged = [
          ...cloudTodos,
          ...localTodos.filter((t) => !cloudIds.has(t.id)),
        ];
        set({ todos: merged, isLoading: false });
      },

      // ── Add todo (unified: supports growth + legacy fields) ──
      addTodo: (input) => {
        const { todos } = get();
        const maxOrder = todos.reduce((max, t) => Math.max(max, t.sortOrder), 0);
        const defaultSortOrder = input.dueAt ?? (maxOrder + Date.now());
        const recurrence = input.recurrence ?? 'once';
        const isRecurring = !isNonRecurring(recurrence);

        if (isRecurring) {
          // Create template + today's instance
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
            category: input.category,
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
              category: input.category,
              scope: input.scope,
            };
            newTodos.push(instance);
            bgSyncInsert(instance).catch(console.error);
          }
          set((s) => ({ todos: [...s.todos, ...newTodos] }));
          bgSyncInsert(template).catch(console.error);
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
            category: input.category,
            scope: input.scope,
          };
          set((s) => ({ todos: [...s.todos, todo] }));
          bgSyncInsert(todo).catch(console.error);
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
          // Delete template and all its pending instances
          const instanceIds = get()
            .todos.filter((t) => t.templateId === id && !t.completed)
            .map((t) => t.id);
          set((s) => ({
            todos: s.todos.filter(
              (t) => t.id !== id && !(t.templateId === id && !t.completed)
            ),
          }));
          bgSyncDelete(id).catch(console.error);
          instanceIds.forEach((iid) => bgSyncDelete(iid).catch(console.error));
        } else {
          set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }));
          bgSyncDelete(id).catch(console.error);
        }

        // Trigger annotation for deleted todo
        const annotationStore = useAnnotationStore.getState();
        const event: AnnotationEvent = {
          type: 'task_deleted',
          timestamp: Date.now(),
          data: { content: todo.title },
        };
        annotationStore.triggerAnnotation(event).catch(console.error);
      },

      addCategory: (category) =>
        set((state) => ({ categories: [...state.categories, category] })),

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

        set((s) => ({
          todos: s.todos.map((t) => {
            if (t.id === visible[idx].id) return { ...t, sortOrder: thatOrder };
            if (t.id === visible[swapIdx].id) return { ...t, sortOrder: thisOrder };
            return t;
          }),
        }));
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
            // generate on day 1 — simple rule
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
    }),
    {
      name: 'growth-todo-store', // keep this key to preserve existing growth data
    }
  )
);
