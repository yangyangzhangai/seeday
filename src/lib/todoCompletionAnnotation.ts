import type { Recurrence, Todo, TodoPriority } from '../store/useTodoStore';

const OLD_TODO_DAYS_THRESHOLD = 3;
const THREE_MONTH_MS = 90 * 24 * 60 * 60 * 1000;

type ImportanceLevel = 'high' | 'medium' | 'low';

export interface TodoCompletionAnnotationContext {
  isTodoCompletion: true;
  isSpecial: boolean;
  importance: ImportanceLevel;
  recurrence: Recurrence;
  createdAt: number;
  ageDays: number;
  bottleId?: string;
  bottleName?: string;
  threeMonth?: {
    completed: number;
    total: number;
    maxStreakDays: number;
  };
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function mapImportance(priority: TodoPriority): ImportanceLevel {
  if (priority === 'high' || priority === 'urgent-important') return 'high';
  if (priority === 'medium' || priority === 'urgent-not-important' || priority === 'important-not-urgent') return 'medium';
  return 'low';
}

function resolveRecurrence(recurrence: Recurrence | undefined): Recurrence {
  return recurrence ?? 'once';
}

function isRecurringTodo(recurrence: Recurrence): boolean {
  return recurrence === 'daily' || recurrence === 'weekly' || recurrence === 'monthly';
}

function toDateKeyLocal(timestamp: number): string {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function computeMaxConsecutiveDays(dayKeys: string[]): number {
  if (dayKeys.length === 0) return 0;
  const sorted = [...new Set(dayKeys)].sort();
  let maxStreak = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00`).getTime();
    const next = new Date(`${sorted[i]}T00:00:00`).getTime();
    if (next - prev === 24 * 60 * 60 * 1000) {
      current += 1;
      if (current > maxStreak) maxStreak = current;
    } else {
      current = 1;
    }
  }

  return maxStreak;
}

function buildNinetyDayStats(todo: Todo, allTodos: Todo[], now: number): { completed: number; total: number; maxStreakDays: number } {
  const windowStart = now - THREE_MONTH_MS;
  const templateKey = todo.templateId || (todo.isTemplate ? todo.id : undefined);
  const titleKey = normalizeTitle(todo.title);

  const related = allTodos.filter((item) => {
    if (templateKey) {
      return item.id === templateKey || item.templateId === templateKey;
    }
    return normalizeTitle(item.title) === titleKey;
  });

  const total = related.filter((item) => item.createdAt >= windowStart).length;
  const completedInWindow = related.filter((item) => item.completed && (item.completedAt ?? 0) >= windowStart);
  const completed = completedInWindow.length;
  const completionDays = completedInWindow
    .map((item) => item.completedAt)
    .filter((value): value is number => typeof value === 'number')
    .map((value) => toDateKeyLocal(value));

  return {
    completed,
    total,
    maxStreakDays: computeMaxConsecutiveDays(completionDays),
  };
}

export function buildTodoCompletionAnnotationPayload(params: {
  todo: Todo;
  allTodos: Todo[];
  now: number;
  bottleName?: string;
}): { summary?: string; context: TodoCompletionAnnotationContext } {
  const { todo, allTodos, now, bottleName } = params;
  const recurrence = resolveRecurrence(todo.recurrence);
  const ageDays = Math.max(0, Math.floor((now - todo.createdAt) / (24 * 60 * 60 * 1000)));
  const importance = mapImportance(todo.priority);

  const isTrivial = (recurrence === 'once' || recurrence === 'none')
    && !todo.bottleId
    && ageDays <= 1;
  const isSpecial = !isTrivial && (
    Boolean(todo.bottleId)
    || isRecurringTodo(recurrence)
    || ageDays >= OLD_TODO_DAYS_THRESHOLD
  );

  const stats = isSpecial ? buildNinetyDayStats(todo, allTodos, now) : undefined;
  const summary = isSpecial
    ? [
      'todo_completed',
      `title=${todo.title}`,
      `importance=${importance}`,
      `created_days_ago=${ageDays}`,
      `recurrence=${recurrence}`,
      `bottle=${bottleName || 'none'}`,
      stats ? `last90d=${stats.completed}/${stats.total}` : null,
      stats ? `streak_days=${stats.maxStreakDays}` : null,
    ].filter(Boolean).join('; ')
    : undefined;

  return {
    summary,
    context: {
      isTodoCompletion: true,
      isSpecial,
      importance,
      recurrence,
      createdAt: todo.createdAt,
      ageDays,
      bottleId: todo.bottleId,
      bottleName,
      threeMonth: stats,
    },
  };
}
