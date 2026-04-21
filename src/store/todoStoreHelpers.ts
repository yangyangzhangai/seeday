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
