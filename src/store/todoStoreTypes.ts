// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/growth/GrowthPage.tsx
import type { ActivityRecordType } from '../lib/activityType';

export type Priority = 'urgent-important' | 'urgent-not-important' | 'important-not-urgent' | 'not-important-not-urgent';
export type GrowthPriority = 'high' | 'medium' | 'low';
export type TodoPriority = Priority | GrowthPriority;
export type TodoScope = 'daily' | 'weekly' | 'monthly';
export type Recurrence = 'none' | 'once' | 'daily' | 'weekly' | 'monthly';

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  priority: TodoPriority;
  dueAt?: number;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  category?: ActivityRecordType;
  scope?: TodoScope;
  recurrence?: Recurrence;
  recurrenceDays?: number[];
  isTemplate?: boolean;
  templateId?: string;
  recurrenceId?: string;
  bottleId?: string;
  sortOrder: number;
  parentId?: string;
  suggestedDuration?: number;
  isPinned?: boolean;
  syncState?: 'pending' | 'synced' | 'failed';
}

export type GrowthTodo = Todo;

export interface TodoState {
  todos: Todo[];
  categories: ActivityRecordType[];
  isLoading: boolean;
  hasHydrated: boolean;
  lastFetchedAt: number | null;
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
