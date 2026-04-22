// DOC-DEPS: LLM.md -> docs/DATA_STORAGE_AUDIT_REPORT.md -> src/store/useAnnotationStore.ts
import type { CharacterStateTracker } from '../lib/characterState';
import type { AIAnnotation, AnnotationEvent } from '../types/annotation';

const DAY_MS = 24 * 60 * 60 * 1000;

export const ANNOTATION_PERSIST_WINDOW_DAYS = 30;
export const CHARACTER_STATE_TRACKER_WINDOW_DAYS = 7;

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function pruneAnnotationEvents(events: AnnotationEvent[], maxCount: number): AnnotationEvent[] {
  if (!Array.isArray(events) || maxCount <= 0) return [];
  if (events.length <= maxCount) return events;
  return events.slice(events.length - maxCount);
}

export function pruneAnnotationsForPersistence(
  annotations: AIAnnotation[],
  now = Date.now(),
): AIAnnotation[] {
  if (!Array.isArray(annotations)) return [];
  const cutoff = now - ANNOTATION_PERSIST_WINDOW_DAYS * DAY_MS;
  return annotations.filter((annotation) => {
    if (!annotation || typeof annotation !== 'object') return false;
    if (!annotation.syncedToCloud) return true;
    return typeof annotation.timestamp === 'number' && annotation.timestamp >= cutoff;
  });
}

export function pruneCharacterStateTracker(
  tracker: CharacterStateTracker,
  now = Date.now(),
): CharacterStateTracker {
  const normalized: CharacterStateTracker = {
    history: Array.isArray(tracker?.history) ? tracker.history : [],
    delayedQueue: Array.isArray(tracker?.delayedQueue) ? tracker.delayedQueue : [],
    activeEffects: Array.isArray(tracker?.activeEffects) ? tracker.activeEffects : [],
  };
  const cutoffDateKey = toDateKey(new Date(now - (CHARACTER_STATE_TRACKER_WINDOW_DAYS - 1) * DAY_MS));

  return {
    history: normalized.history.filter((item) => item.date >= cutoffDateKey),
    delayedQueue: normalized.delayedQueue.filter((item) => item.expiresAt >= cutoffDateKey),
    activeEffects: normalized.activeEffects.filter((item) => item.expiresAt > now),
  };
}
