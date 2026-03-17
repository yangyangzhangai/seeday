import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type GrowthPriority = 'high' | 'medium' | 'low';
export type Recurrence = 'once' | 'daily' | 'weekly';

export interface GrowthTodo {
  id: string;
  title: string;
  priority: GrowthPriority;
  bottleId?: string;
  completed: boolean;
  createdAt: number;
  dueAt?: number;                    // deadline timestamp
  recurrence: Recurrence;
  recurrenceDays?: number[];         // 0-6 (Sun-Sat), for weekly
  isTemplate: boolean;               // recurring template (not shown directly)
  templateId?: string;               // instance points to template
  sortOrder: number;                 // for manual reordering
  startedAt?: number;                // when user started working
  duration?: number;                 // elapsed minutes
}

interface GrowthTodoState {
  todos: GrowthTodo[];
  lastGeneratedDate: string;         // ISO date of last recurrence generation
  activeMessageMap: Record<string, string>; // messageId → todoId

  linkMessageToTodo: (messageId: string, todoId: string) => void;
  completeTodoByMessage: (messageId: string) => void;

  addTodo: (input: {
    title: string;
    priority: GrowthPriority;
    bottleId?: string;
    dueAt?: number;
    recurrence?: Recurrence;
    recurrenceDays?: number[];
  }) => void;

  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  startTodo: (id: string) => void;
  completeActiveTodo: (id: string) => void;
  reorderTodos: (id: string, direction: 'up' | 'down') => void;
  generateRecurringTodos: () => void;
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayDayOfWeek(): number {
  return new Date().getDay(); // 0=Sun, 6=Sat
}

export const useGrowthTodoStore = create<GrowthTodoState>()(
  persist(
    (set, get) => ({
      todos: [],
      lastGeneratedDate: '',
      activeMessageMap: {},

      linkMessageToTodo: (messageId, todoId) => {
        set((s) => ({
          activeMessageMap: { ...s.activeMessageMap, [messageId]: todoId },
        }));
      },

      completeTodoByMessage: (messageId) => {
        const { activeMessageMap, todos } = get();
        const todoId = activeMessageMap[messageId];
        if (!todoId) return;
        const todo = todos.find((t) => t.id === todoId);
        if (todo && !todo.completed) {
          set((s) => ({
            todos: s.todos.map((t) =>
              t.id === todoId ? { ...t, completed: true } : t
            ),
            activeMessageMap: Object.fromEntries(
              Object.entries(s.activeMessageMap).filter(([k]) => k !== messageId)
            ),
          }));
        }
      },

      addTodo: (input) => {
        const { todos } = get();
        const maxOrder = todos.reduce((max, t) => Math.max(max, t.sortOrder), 0);
        // Default sortOrder is dueAt so list auto-sorts by due time; fallback to large value (no due = end)
        const defaultSortOrder = input.dueAt ?? (maxOrder + Date.now());
        const recurrence = input.recurrence ?? 'once';
        const isRecurring = recurrence !== 'once';

        if (isRecurring) {
          // Create template + today's instance
          const templateId = uuidv4();
          const template: GrowthTodo = {
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
          };

          // Check if today should generate an instance
          const shouldGenerate = recurrence === 'daily' ||
            (recurrence === 'weekly' && (input.recurrenceDays ?? []).includes(todayDayOfWeek()));

          const newTodos: GrowthTodo[] = [template];
          if (shouldGenerate) {
            newTodos.push({
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
            });
          }
          set((s) => ({ todos: [...s.todos, ...newTodos] }));
        } else {
          const todo: GrowthTodo = {
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
          };
          set((s) => ({ todos: [...s.todos, todo] }));
        }
      },

      toggleTodo: (id) => {
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === id ? { ...t, completed: !t.completed } : t
          ),
        }));
      },

      deleteTodo: (id) => {
        set((s) => {
          const todo = s.todos.find((t) => t.id === id);
          if (todo?.isTemplate) {
            // Delete template and all its pending instances
            return {
              todos: s.todos.filter(
                (t) => t.id !== id && !(t.templateId === id && !t.completed)
              ),
            };
          }
          return { todos: s.todos.filter((t) => t.id !== id) };
        });
      },

      startTodo: (id) => {
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === id ? { ...t, startedAt: Date.now() } : t
          ),
        }));
      },

      completeActiveTodo: (id) => {
        set((s) => ({
          todos: s.todos.map((t) => {
            if (t.id !== id || !t.startedAt) return t;
            const duration = Math.floor((Date.now() - t.startedAt) / 60000);
            return { ...t, completed: true, duration };
          }),
        }));
      },

      reorderTodos: (id, direction) => {
        const { todos } = get();
        // Only reorder visible (non-template) todos
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

      generateRecurringTodos: () => {
        const { todos, lastGeneratedDate } = get();
        const today = todayDateStr();
        if (lastGeneratedDate === today) return;

        const dayOfWeek = todayDayOfWeek();
        const templates = todos.filter((t) => t.isTemplate);
        const newInstances: GrowthTodo[] = [];

        for (const tpl of templates) {
          // Check if today matches the recurrence pattern
          if (tpl.recurrence === 'daily') {
            // Always generate
          } else if (tpl.recurrence === 'weekly') {
            if (!(tpl.recurrenceDays ?? []).includes(dayOfWeek)) continue;
          } else {
            continue; // 'once' templates shouldn't exist, but skip
          }

          // Check if an instance already exists for today
          const todayStart = new Date(today).getTime();
          const todayEnd = todayStart + 86400000;
          const exists = todos.some(
            (t) =>
              t.templateId === tpl.id &&
              t.createdAt >= todayStart &&
              t.createdAt < todayEnd
          );
          if (exists) continue;

          newInstances.push({
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
          });
        }

        set((s) => ({
          todos: [...s.todos, ...newInstances],
          lastGeneratedDate: today,
        }));
      },
    }),
    { name: 'growth-todo-store' }
  )
);
