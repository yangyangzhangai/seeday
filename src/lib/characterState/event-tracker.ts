// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/README.md
import type { DelayedEvent, CharacterStateTracker } from './constants';

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}

function addDays(dateKey: string, days: number): string {
  const date = fromDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function trimInjectedByDate(injectedByDate: Record<string, string[]>, today: string) {
  const keepFrom = addDays(today, -8);
  return Object.fromEntries(
    Object.entries(injectedByDate).filter(([date]) => date >= keepFrom),
  );
}

export function withRecordedHistory(
  tracker: CharacterStateTracker,
  behaviorIds: string[],
  now: Date,
): CharacterStateTracker {
  const date = toDateKey(now);
  const existing = new Set(
    tracker.history
      .filter((item) => item.date === date)
      .map((item) => item.behaviorId),
  );

  const append = behaviorIds
    .filter((id) => !existing.has(id))
    .map((behaviorId) => ({ behaviorId, date, timestamp: now.getTime() }));

  const keepFrom = addDays(date, -14);
  const history = [...tracker.history, ...append].filter((item) => item.date >= keepFrom);

  return {
    ...tracker,
    history,
    injectedByDate: trimInjectedByDate(tracker.injectedByDate, date),
  };
}

export function scheduleDelayedBehavior(
  tracker: CharacterStateTracker,
  behaviorId: string,
  sourceDate: string,
  delayDays: 1 | 2,
): CharacterStateTracker {
  const dueDate = addDays(sourceDate, 1);
  const expiresAt = addDays(sourceDate, delayDays);

  const exists = tracker.delayedQueue.some(
    (item) => item.behaviorId === behaviorId && item.sourceDate === sourceDate,
  );

  if (exists) return tracker;

  const delayedQueue: DelayedEvent[] = [...tracker.delayedQueue, {
    behaviorId,
    sourceDate,
    dueDate,
    expiresAt,
  }];

  return { ...tracker, delayedQueue };
}

export function consumeDueDelayedBehaviors(
  tracker: CharacterStateTracker,
  today: string,
): { dueBehaviorIds: string[]; tracker: CharacterStateTracker } {
  const dueBehaviorIds = tracker.delayedQueue
    .filter((item) => item.dueDate <= today && item.expiresAt >= today)
    .map((item) => item.behaviorId);

  const delayedQueue = tracker.delayedQueue.filter((item) => item.expiresAt >= today);
  return {
    dueBehaviorIds,
    tracker: { ...tracker, delayedQueue },
  };
}

export function getSevenDayDensity(tracker: CharacterStateTracker, behaviorId: string, today: string): number {
  const start = addDays(today, -6);
  return tracker.history.filter((item) => item.behaviorId === behaviorId && item.date >= start && item.date <= today).length;
}

export function getStreakOnActiveDays(tracker: CharacterStateTracker, behaviorId: string): number {
  const activeDays = [...new Set(tracker.history.map((item) => item.date))].sort((a, b) => b.localeCompare(a));
  if (activeDays.length === 0) return 0;

  let streak = 0;
  for (const day of activeDays) {
    const hit = tracker.history.some((item) => item.date === day && item.behaviorId === behaviorId);
    if (!hit) break;
    streak += 1;
  }
  return streak;
}

export function isInjectedToday(tracker: CharacterStateTracker, today: string, behaviorId: string): boolean {
  return (tracker.injectedByDate[today] || []).includes(behaviorId);
}

export function markInjectedToday(
  tracker: CharacterStateTracker,
  today: string,
  behaviorIds: string[],
): CharacterStateTracker {
  const merged = new Set([...(tracker.injectedByDate[today] || []), ...behaviorIds]);
  return {
    ...tracker,
    injectedByDate: {
      ...trimInjectedByDate(tracker.injectedByDate, today),
      [today]: [...merged],
    },
  };
}

export function getTodayFromNow(now: Date): string {
  return toDateKey(now);
}
