// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/README.md
import type { ActiveEffect, DelayedEvent, CharacterStateTracker } from './constants';

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

function normalizeTracker(tracker: CharacterStateTracker): CharacterStateTracker {
  return {
    history: Array.isArray(tracker.history) ? tracker.history : [],
    delayedQueue: Array.isArray(tracker.delayedQueue) ? tracker.delayedQueue : [],
    activeEffects: Array.isArray((tracker as any).activeEffects)
      ? ((tracker as any).activeEffects as ActiveEffect[])
      : [],
  };
}

export function withRecordedHistory(
  tracker: CharacterStateTracker,
  behaviorIds: string[],
  now: Date,
): CharacterStateTracker {
  const normalized = normalizeTracker(tracker);
  const date = toDateKey(now);
  const existing = new Set(
    normalized.history
      .filter((item) => item.date === date)
      .map((item) => item.behaviorId),
  );

  const append = behaviorIds
    .filter((id) => !existing.has(id))
    .map((behaviorId) => ({ behaviorId, date, timestamp: now.getTime() }));

  const keepFrom = addDays(date, -14);
  const history = [...normalized.history, ...append].filter((item) => item.date >= keepFrom);

  return {
    ...normalized,
    history,
  };
}

export function scheduleDelayedBehavior(
  tracker: CharacterStateTracker,
  behaviorId: string,
  sourceDate: string,
  delayDays: 1 | 2,
): CharacterStateTracker {
  const normalized = normalizeTracker(tracker);
  const dueDate = addDays(sourceDate, 1);
  const expiresAt = addDays(sourceDate, delayDays);

  const exists = normalized.delayedQueue.some(
    (item) => item.behaviorId === behaviorId && item.sourceDate === sourceDate,
  );

  if (exists) return normalized;

  const delayedQueue: DelayedEvent[] = [...normalized.delayedQueue, {
    behaviorId,
    sourceDate,
    dueDate,
    expiresAt,
  }];

  return { ...normalized, delayedQueue };
}

export function consumeDueDelayedBehaviors(
  tracker: CharacterStateTracker,
  today: string,
): { dueBehaviorIds: string[]; tracker: CharacterStateTracker } {
  const normalized = normalizeTracker(tracker);
  const dueBehaviorIds = normalized.delayedQueue
    .filter((item) => item.dueDate <= today && item.expiresAt >= today)
    .map((item) => item.behaviorId);

  const delayedQueue = normalized.delayedQueue
    .filter((item) => item.expiresAt >= today)
    .filter((item) => item.dueDate > today);

  return {
    dueBehaviorIds,
    tracker: { ...normalized, delayedQueue },
  };
}

export function getSevenDayDensity(tracker: CharacterStateTracker, behaviorId: string, today: string): number {
  const normalized = normalizeTracker(tracker);
  const start = addDays(today, -6);
  return normalized.history
    .filter((item) => item.behaviorId === behaviorId && item.date >= start && item.date <= today)
    .length;
}

export function getStreakOnActiveDays(tracker: CharacterStateTracker, behaviorId: string): number {
  const normalized = normalizeTracker(tracker);
  const activeDays = [...new Set(normalized.history.map((item) => item.date))].sort((a, b) => b.localeCompare(a));
  if (activeDays.length === 0) return 0;

  let streak = 0;
  for (const day of activeDays) {
    const hit = normalized.history.some((item) => item.date === day && item.behaviorId === behaviorId);
    if (!hit) break;
    streak += 1;
  }
  return streak;
}

export function decayAndPruneActiveEffects(
  tracker: CharacterStateTracker,
  now: Date,
  minScore = 0.08,
): CharacterStateTracker {
  const normalized = normalizeTracker(tracker);
  const nowMs = now.getTime();
  const activeEffects = normalized.activeEffects
    .map((effect) => {
      const elapsedHours = Math.max(0, (nowMs - effect.updatedAt) / (60 * 60 * 1000));
      const halfLife = Math.max(effect.halfLifeHours, 0.5);
      const decayedScore = effect.score * Math.pow(0.5, elapsedHours / halfLife);
      return {
        ...effect,
        score: decayedScore,
        updatedAt: nowMs,
      };
    })
    .filter((effect) => effect.expiresAt > nowMs && effect.score >= minScore);

  return {
    ...normalized,
    activeEffects,
  };
}

export function addOrRefreshActiveEffect(
  tracker: CharacterStateTracker,
  behaviorId: string,
  now: Date,
  options: {
    baseScore: number;
    maxScore: number;
    ttlHours: number;
    halfLifeHours: number;
  },
): CharacterStateTracker {
  const pruned = decayAndPruneActiveEffects(tracker, now);
  const nowMs = now.getTime();
  const expiresAt = nowMs + options.ttlHours * 60 * 60 * 1000;
  const existing = pruned.activeEffects.find((effect) => effect.behaviorId === behaviorId);

  if (!existing) {
    return {
      ...pruned,
      activeEffects: [...pruned.activeEffects, {
        behaviorId,
        score: Math.max(0, options.baseScore),
        updatedAt: nowMs,
        expiresAt,
        halfLifeHours: options.halfLifeHours,
      }],
    };
  }

  const activeEffects = pruned.activeEffects.map((effect) => {
    if (effect.behaviorId !== behaviorId) return effect;
    return {
      ...effect,
      score: Math.min(options.maxScore, effect.score + options.baseScore),
      updatedAt: nowMs,
      expiresAt: Math.max(effect.expiresAt, expiresAt),
      halfLifeHours: options.halfLifeHours,
    };
  });

  return {
    ...pruned,
    activeEffects,
  };
}

export function getActiveEffectScore(tracker: CharacterStateTracker, behaviorId: string): number {
  const normalized = normalizeTracker(tracker);
  const found = normalized.activeEffects.find((effect) => effect.behaviorId === behaviorId);
  return found?.score ?? 0;
}

export function listActiveBehaviorIds(tracker: CharacterStateTracker): string[] {
  const normalized = normalizeTracker(tracker);
  return normalized.activeEffects
    .map((effect) => effect.behaviorId)
    .filter((id, index, array) => array.indexOf(id) === index);
}

export function getTodayFromNow(now: Date): string {
  return toDateKey(now);
}
