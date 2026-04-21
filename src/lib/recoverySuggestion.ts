// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/types/annotation.ts
import type { RecoveryNudgeContext } from '../types/annotation';

interface RecoveryTodo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  recurrence?: 'none' | 'once' | 'daily' | 'weekly' | 'monthly';
  recurrenceDays?: number[];
  isTemplate?: boolean;
  templateId?: string;
  bottleId?: string;
  dueAt?: number;
}

interface RecoveryBottle {
  id: string;
  name: string;
  status: 'active' | 'achieved' | 'irrigated';
  createdAt: number;
}

interface RecoverySuggestionInput {
  now: Date;
  todos: RecoveryTodo[];
  bottles: RecoveryBottle[];
  attemptsToday?: Array<{ key: string; timestamp: number }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PREFERRED_HOUR = 12;
const FIRST_REMINDER_WINDOW_BEFORE_HOURS = 2;
const FIRST_REMINDER_WINDOW_AFTER_HOURS = 2;
const MAX_REMINDERS_PER_DAY = 2;
const SECOND_REMINDER_MIN_GAP_MS = 4 * 60 * 60 * 1000;

function startOfLocalDayMs(input: Date): number {
  const day = new Date(input);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

function hasCompletedTodoInWindow(todos: RecoveryTodo[], startMs: number, endMs: number): boolean {
  return todos.some((todo) => {
    if (!todo.completed) return false;
    const completedAt = typeof todo.completedAt === 'number' ? todo.completedAt : 0;
    return completedAt >= startMs && completedAt < endMs;
  });
}

function pickBestTodoTarget(todos: RecoveryTodo[]): RecoveryTodo | undefined {
  return [...todos]
    .filter((todo) => !todo.completed && !todo.isTemplate)
    .sort((left, right) => {
      const leftDue = left.dueAt ?? Number.POSITIVE_INFINITY;
      const rightDue = right.dueAt ?? Number.POSITIVE_INFINITY;
      if (leftDue !== rightDue) return leftDue - rightDue;
      return left.createdAt - right.createdAt;
    })[0];
}

function getLocalHourDecimal(now: Date): number {
  return now.getHours() + now.getMinutes() / 60;
}

function normalizeHour(hour: number): number {
  const mod = hour % 24;
  return mod < 0 ? mod + 24 : mod;
}

function isInHourWindow(hour: number, start: number, end: number): boolean {
  const normalizedHour = normalizeHour(hour);
  const normalizedStart = normalizeHour(start);
  const normalizedEnd = normalizeHour(end);

  if (normalizedStart <= normalizedEnd) {
    return normalizedHour >= normalizedStart && normalizedHour <= normalizedEnd;
  }

  return normalizedHour >= normalizedStart || normalizedHour <= normalizedEnd;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function resolvePreferredHourFromTodos(todos: RecoveryTodo[]): number {
  const completionHours = todos
    .filter((todo) => todo.completed && typeof todo.completedAt === 'number')
    .map((todo) => {
      const completedAt = new Date(todo.completedAt as number);
      return completedAt.getHours() + completedAt.getMinutes() / 60;
    });

  if (completionHours.length === 0) {
    return DEFAULT_PREFERRED_HOUR;
  }

  return median(completionHours);
}

function canNotifyNow(params: {
  key: string;
  now: Date;
  preferredHour: number;
  attemptsToday: Array<{ key: string; timestamp: number }>;
}): boolean {
  const { key, now, preferredHour, attemptsToday } = params;
  const attemptsForKey = attemptsToday
    .filter((item) => item.key === key)
    .sort((left, right) => left.timestamp - right.timestamp);

  if (attemptsForKey.length >= MAX_REMINDERS_PER_DAY) {
    return false;
  }

  if (attemptsForKey.length === 0) {
    const currentHour = getLocalHourDecimal(now);
    const start = preferredHour - FIRST_REMINDER_WINDOW_BEFORE_HOURS;
    const end = preferredHour + FIRST_REMINDER_WINDOW_AFTER_HOURS;
    return isInHourWindow(currentHour, start, end);
  }

  const lastAttempt = attemptsForKey[attemptsForKey.length - 1];
  return now.getTime() - lastAttempt.timestamp >= SECOND_REMINDER_MIN_GAP_MS;
}

function buildBottleNudge(
  bottle: RecoveryBottle,
  todos: RecoveryTodo[],
): RecoveryNudgeContext | null {
  const relatedTodos = todos.filter((todo) => todo.bottleId === bottle.id);
  const bestTodo = pickBestTodoTarget(relatedTodos);

  if (!bestTodo) {
    return {
      key: `bottle:${bottle.id}:miss3d`,
      reason: 'bottle_missed_3_days',
      rewardStars: 2,
      bottleId: bottle.id,
      bottleName: bottle.name,
      activityName: bottle.name,
    };
  }

  return {
    key: `bottle:${bottle.id}:miss3d`,
    reason: 'bottle_missed_3_days',
    rewardStars: 2,
    bottleId: bottle.id,
    bottleName: bottle.name,
    todoId: bestTodo.id,
    todoTitle: bestTodo.title,
  };
}

export function detectRecoveryNudge(input: RecoverySuggestionInput): RecoveryNudgeContext | null {
  const { now, todos, bottles, attemptsToday = [] } = input;
  const todayStart = startOfLocalDayMs(now);

  const activeBottles = bottles.filter((bottle) => bottle.status === 'active');
  const bottleCandidates = activeBottles
    .filter((bottle) => bottle.createdAt < todayStart - 2 * DAY_MS)
    .filter((bottle) => {
      const related = todos.filter((todo) => todo.bottleId === bottle.id);
      if (related.length === 0) return false;
      return [1, 2, 3].every((back) => {
        const start = todayStart - back * DAY_MS;
        const end = start + DAY_MS;
        return !hasCompletedTodoInWindow(related, start, end);
      });
    })
    .sort((left, right) => left.createdAt - right.createdAt);

  for (const bottle of bottleCandidates) {
    const nudge = buildBottleNudge(bottle, todos);
    const relatedTodos = todos.filter((todo) => todo.bottleId === bottle.id);
    const preferredHour = resolvePreferredHourFromTodos(relatedTodos);
    if (nudge && canNotifyNow({ key: nudge.key, now, preferredHour, attemptsToday })) {
      return nudge;
    }
  }

  return null;
}
