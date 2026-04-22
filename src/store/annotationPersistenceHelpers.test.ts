import { describe, expect, it } from 'vitest';
import {
  pruneAnnotationEvents,
  pruneAnnotationsForPersistence,
  pruneCharacterStateTracker,
} from './annotationPersistenceHelpers';

describe('annotationPersistenceHelpers', () => {
  it('prunes synced annotations older than 30 days but keeps local pending ones', () => {
    const now = new Date('2026-04-22T12:00:00Z').getTime();
    const recent = {
      id: 'recent',
      timestamp: now - 5 * 24 * 60 * 60 * 1000,
      syncedToCloud: true,
    };
    const oldSynced = {
      id: 'old-synced',
      timestamp: now - 40 * 24 * 60 * 60 * 1000,
      syncedToCloud: true,
    };
    const oldPending = {
      id: 'old-pending',
      timestamp: now - 40 * 24 * 60 * 60 * 1000,
      syncedToCloud: false,
    };

    expect(
      pruneAnnotationsForPersistence([
        recent as never,
        oldSynced as never,
        oldPending as never,
      ], now).map((item) => item.id),
    ).toEqual(['recent', 'old-pending']);
  });

  it('caps persisted today events from the tail', () => {
    const events = [1, 2, 3, 4].map((index) => ({
      type: 'activity_recorded',
      timestamp: index,
      data: { index },
    }));

    expect(pruneAnnotationEvents(events as never, 2).map((item) => item.data?.index)).toEqual([3, 4]);
  });

  it('keeps only recent tracker history and unexpired delayed/effect entries', () => {
    const now = new Date('2026-04-22T12:00:00Z').getTime();
    const tracker = pruneCharacterStateTracker({
      history: [
        { behaviorId: 'recent', date: '2026-04-22', timestamp: now },
        { behaviorId: 'stale', date: '2026-04-10', timestamp: now - 12 * 24 * 60 * 60 * 1000 },
      ],
      delayedQueue: [
        { behaviorId: 'keep', dueDate: '2026-04-22', expiresAt: '2026-04-23', sourceDate: '2026-04-21' },
        { behaviorId: 'drop', dueDate: '2026-04-10', expiresAt: '2026-04-11', sourceDate: '2026-04-09' },
      ],
      activeEffects: [
        { behaviorId: 'keep', score: 1, updatedAt: now - 1_000, expiresAt: now + 10_000, halfLifeHours: 2 },
        { behaviorId: 'drop', score: 1, updatedAt: now - 1_000, expiresAt: now - 10_000, halfLifeHours: 2 },
      ],
    }, now);

    expect(tracker.history.map((item) => item.behaviorId)).toEqual(['recent']);
    expect(tracker.delayedQueue.map((item) => item.behaviorId)).toEqual(['keep']);
    expect(tracker.activeEffects.map((item) => item.behaviorId)).toEqual(['keep']);
  });
});
