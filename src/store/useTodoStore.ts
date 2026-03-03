import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { persist } from 'zustand/middleware';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import { useAnnotationStore } from './useAnnotationStore';
import type { AnnotationEvent } from '../types/annotation';

export type Priority = 'urgent-important' | 'urgent-not-important' | 'important-not-urgent' | 'not-important-not-urgent';
export type TodoScope = 'daily' | 'weekly' | 'monthly';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Todo {
  id: string;
  content: string;
  completed: boolean;
  priority: Priority;
  category: string;
  dueDate: number; // Timestamp
  scope: TodoScope;
  createdAt: number;
  recurrence?: Recurrence;
  recurrenceId?: string;
  completedAt?: number;
  isPinned?: boolean;
  startedAt?: number; // 开始计时的时间戳
  duration?: number; // 耗时（分钟）
}

interface TodoState {
  todos: Todo[];
  categories: string[];
  isLoading: boolean;
  activeTodoId: string | null; // 当前正在计时的待办ID
  fetchTodos: () => Promise<void>;
  addTodo: (content: string, priority: Priority, category: string, scope: TodoScope, dueDate?: number, recurrence?: Recurrence) => Promise<void>;
  updateTodo: (id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>) => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  addCategory: (category: string) => void;
  startTodo: (id: string) => Promise<void>; // 开始计时
  completeActiveTodo: () => Promise<void>; // 完成当前活动的待办
  completeTodoWithDuration: (id: string, duration: number) => Promise<void>; // 手动完成并记录耗时
  setActiveTodoId: (id: string | null) => void; // 设置当前活动待办
}

type TodoUpdates = Partial<Omit<Todo, 'id' | 'createdAt'>>;

const TODO_DB_FIELD_MAP: Partial<Record<keyof TodoUpdates, string>> = {
  dueDate: 'due_date',
  completedAt: 'completed_at',
  isPinned: 'is_pinned',
  startedAt: 'started_at',
};

function toDbTodoUpdates(updates: TodoUpdates): Record<string, unknown> {
  const dbUpdates: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates) as [keyof TodoUpdates, TodoUpdates[keyof TodoUpdates]][]) {
    const mappedKey = TODO_DB_FIELD_MAP[key] || key;
    dbUpdates[mappedKey] = value === undefined ? null : value;
  }

  return dbUpdates;
}

export const useTodoStore = create<TodoState>()(
  persist(
    (set, get) => ({
      todos: [],
      categories: ['study', 'work', 'social', 'life', 'entertainment'],
      isLoading: false,
      activeTodoId: null,

      fetchTodos: async () => {
        const session = await getSupabaseSession();
        if (!session) return;

        set({ isLoading: true });
        const { data, error } = await supabase.from('todos')
          .select('*')
          .eq('user_id', session.user.id);

        if (error) {
          console.error('Error fetching todos:', error);
          set({ isLoading: false });
          return;
        }

        const todos = data.map((t: any) => ({
          id: t.id,
          content: t.content,
          completed: t.completed,
          priority: t.priority,
          category: t.category,
          dueDate: t.due_date,
          scope: t.scope,
          createdAt: t.created_at,
          recurrence: t.recurrence,
          recurrenceId: t.recurrence_id,
          completedAt: t.completed_at,
          isPinned: t.is_pinned || false,
          startedAt: t.started_at,
          duration: t.duration
        }));
        set({ todos, isLoading: false });
      },

      addTodo: async (content, priority, category, scope, dueDate, recurrence = 'none') => {
        const newTodo: Todo = {
          id: uuidv4(),
          content,
          priority,
          category,
          dueDate: dueDate || Date.now(),
          scope,
          createdAt: Date.now(),
          completed: false,
          recurrence,
          isPinned: false
        };

        set(state => ({ todos: [newTodo, ...state.todos] }));

        const session = await getSupabaseSession();
        if (session) {
          const { error } = await supabase.from('todos').insert([{
            id: newTodo.id,
            content: newTodo.content,
            completed: newTodo.completed,
            priority: newTodo.priority,
            category: newTodo.category,
            due_date: newTodo.dueDate,
            scope: newTodo.scope,
            created_at: newTodo.createdAt,
            recurrence: newTodo.recurrence,
            user_id: session.user.id
          }]);
          if (error) console.error('Error adding todo:', error);
        }
      },

      updateTodo: async (id, updates) => {
        // 1. 更新本地 UI
        set(state => ({
          todos: state.todos.map(t => t.id === id ? { ...t, ...updates } : t)
        }));

        const session = await getSupabaseSession();
        if (session) {
          const dbUpdates = toDbTodoUpdates(updates);

          if (Object.keys(dbUpdates).length > 0) {
            const { error } = await supabase.from('todos').update(dbUpdates).eq('id', id).eq('user_id', session.user.id);
            if (error) console.error('Error updating todo:', error);
          }
        }
      },

      toggleTodo: async (id) => {
        const todo = get().todos.find(t => t.id === id);
        if (!todo) return;

        const completed = !todo.completed;
        const completedAt = completed ? Date.now() : undefined;

        await get().updateTodo(id, { completed, completedAt });
      },

      togglePin: async (id) => {
        const todo = get().todos.find(t => t.id === id);
        if (!todo) return;

        // 修改：直接调用 updateTodo
        // 它会同时处理：1.本地状态更新 2.同步到 Supabase (is_pinned)
        await get().updateTodo(id, { isPinned: !todo.isPinned });
      },

      deleteTodo: async (id) => {
        const todo = get().todos.find(t => t.id === id);

        set(state => ({
          todos: state.todos.filter(t => t.id !== id)
        }));

        // 触发删除待办批注
        if (todo) {
          const annotationStore = useAnnotationStore.getState();
          const event: AnnotationEvent = {
            type: 'task_deleted',
            timestamp: Date.now(),
            data: {
              content: todo.content,
            },
          };
          annotationStore.triggerAnnotation(event).catch(console.error);
        }

        const session = await getSupabaseSession();
        if (session) {
          const { error } = await supabase.from('todos').delete().eq('id', id).eq('user_id', session.user.id);
          if (error) console.error('Error deleting todo:', error);
        }
      },

      addCategory: (category) => set(state => ({ categories: [...state.categories, category] })),

      // 开始计时某个待办
      startTodo: async (id: string) => {
        const now = Date.now();
        await get().updateTodo(id, {
          startedAt: now,
          completed: false,
          completedAt: undefined
        });
        set({ activeTodoId: id });
      },

      // 完成当前活动的待办（从记录模式调用）
      completeActiveTodo: async () => {
        console.log('[DEBUG] completeActiveTodo 开始');
        const { activeTodoId, todos } = get();
        console.log('[DEBUG] activeTodoId:', activeTodoId, 'todos数量:', todos.length);
        if (!activeTodoId) {
          console.log('[DEBUG] activeTodoId 为空，直接返回');
          return;
        }

        const todo = todos.find(t => t.id === activeTodoId);
        console.log('[DEBUG] 找到待办:', todo?.content, 'startedAt:', todo?.startedAt);
        if (!todo || !todo.startedAt) {
          console.log('[DEBUG] 待办不存在或无 startedAt，直接返回');
          return;
        }

        const now = Date.now();
        const duration = Math.round((now - todo.startedAt) / (1000 * 60)); // 分钟
        console.log('[DEBUG] 计算耗时 - duration:', duration, '分钟');

        console.log('[DEBUG] 调用 updateTodo 更新待办状态');
        await get().updateTodo(activeTodoId, {
          completed: true,
          completedAt: now,
          duration
        });
        console.log('[DEBUG] updateTodo 完成');

        set({ activeTodoId: null });
        console.log('[DEBUG] completeActiveTodo 结束，activeTodoId 已重置');
      },

      // 手动完成并设置耗时
      completeTodoWithDuration: async (id: string, duration: number) => {
        const now = Date.now();
        await get().updateTodo(id, {
          completed: true,
          completedAt: now,
          duration
        });
      },

      // 设置当前活动待办ID
      setActiveTodoId: (id: string | null) => {
        set({ activeTodoId: id });
      }
    }),
    {
      name: 'todo-storage',
    }
  )
);
