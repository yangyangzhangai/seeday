// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/README.md
const SORT_ORDER_SAFE_MIN = -9_000_000_000_000_000;
const SORT_ORDER_SAFE_MAX = 9_000_000_000_000_000;

type TodoFreshnessLike = {
  completedAt?: number;
  startedAt?: number;
  dueAt?: number;
  sortOrder: number;
  createdAt: number;
};

export function sanitizeSortOrder(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return Math.trunc(fallback);
  const truncated = Math.trunc(numeric);
  if (truncated < SORT_ORDER_SAFE_MIN) return SORT_ORDER_SAFE_MIN;
  if (truncated > SORT_ORDER_SAFE_MAX) return SORT_ORDER_SAFE_MAX;
  return truncated;
}

export function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayDayOfWeek(): number {
  return new Date().getDay();
}

export function todayDayOfMonth(): number {
  return new Date().getDate();
}

export function getLocalDayRange(dateStr: string): { start: number; end: number } {
  const [yearRaw, monthRaw, dayRaw] = dateStr.split('-').map(Number);
  const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();
  const month = Number.isFinite(monthRaw) ? monthRaw : (new Date().getMonth() + 1);
  const day = Number.isFinite(dayRaw) ? dayRaw : new Date().getDate();
  const start = new Date(year, month - 1, day).getTime();
  return { start, end: start + 86400000 };
}

export function getTodoFreshness(todo: TodoFreshnessLike): number {
  return Math.max(
    Number(todo.completedAt ?? 0),
    Number(todo.startedAt ?? 0),
    Number(todo.dueAt ?? 0),
    Number(todo.sortOrder ?? 0),
    Number(todo.createdAt ?? 0),
  );
}

export function isTodoParentForeignKeyError(err: unknown): boolean {
  const message = (typeof err === 'object' && err !== null)
    ? String((err as Record<string, unknown>).message ?? '')
    : String(err ?? '');
  const lower = message.toLowerCase();
  return (
    lower.includes('todos_parent_id_fkey') ||
    (lower.includes('violates foreign key constraint') && lower.includes('parent_id')) ||
    (lower.includes('key is not present in table') && lower.includes('todos'))
  );
}

interface LegacyTodoMigrationInput {
  normalizeTodoCategory: (category: string | undefined, text: string, lang: string) => string;
  resolveLangForText: (text: string) => string;
}

type MigratedTodoShape = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  priority: 'high' | 'medium' | 'low';
  dueAt?: number;
  completedAt?: number;
  duration?: number;
  startedAt?: number;
  category?: string;
  scope?: 'daily' | 'weekly' | 'monthly';
  recurrence: 'once';
  isTemplate: false;
  sortOrder: number;
  isPinned: boolean;
};

export function migrateOldTodoStorage(
  currentIds: Set<string>,
  { normalizeTodoCategory, resolveLangForText }: LegacyTodoMigrationInput,
): MigratedTodoShape[] {
  try {
    const raw = localStorage.getItem('todo-storage');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const oldTodos: Array<Record<string, unknown>> = parsed?.state?.todos ?? [];
    if (!oldTodos.length) return [];

    const priorityMap: Record<string, 'high' | 'medium' | 'low'> = {
      'urgent-important': 'high',
      'urgent-not-important': 'medium',
      'important-not-urgent': 'medium',
      'not-important-not-urgent': 'low',
    };

    const migrated = oldTodos
      .filter((t) => t.id && typeof t.id === 'string' && !currentIds.has(t.id as string))
      .map((t, i) => {
        const title = (t.content ?? t.title ?? '') as string;
        return {
          id: t.id as string,
          title,
          completed: Boolean(t.completed),
          createdAt: (t.createdAt as number) ?? Date.now(),
          priority: priorityMap[t.priority as string] ?? 'medium',
          dueAt: (t.dueDate ?? t.dueAt) as number | undefined,
          completedAt: t.completedAt as number | undefined,
          duration: t.duration as number | undefined,
          startedAt: t.startedAt as number | undefined,
          category: normalizeTodoCategory(
            t.category as string | undefined,
            title,
            resolveLangForText(title),
          ),
          scope: t.scope as 'daily' | 'weekly' | 'monthly' | undefined,
          recurrence: 'once' as const,
          isTemplate: false as const,
          sortOrder: (t.dueDate ?? t.dueAt ?? (Date.now() + i)) as number,
          isPinned: Boolean(t.isPinned),
        };
      });

    if (migrated.length > 0) {
      localStorage.removeItem('todo-storage');
    }
    return migrated;
  } catch {
    return [];
  }
}
