// DOC-DEPS: LLM.md -> docs/SUPABASE_PERSISTENCE_INVENTORY.md -> src/store/README.md
import { describe, expect, it } from 'vitest';
import type { Message } from './useChatStore.types';
import {
  collectUniqueMessages,
  partitionMoodParentIds,
} from './moodRelationshipHelpers';

const standaloneMood: Message = {
  id: 'standalone-mood',
  content: '今天有点焦虑',
  timestamp: 1,
  type: 'text',
  mode: 'record',
  activityType: 'mood',
  isMood: true,
};

describe('mood relationship helpers', () => {
  it('keeps standalone moods as valid message parents', () => {
    const messages = collectUniqueMessages([], { '2026-07-23': [standaloneMood] });
    const localIds = new Set(messages.map((message) => message.id));
    const result = partitionMoodParentIds(
      [standaloneMood.id],
      localIds,
      { ids: new Set([standaloneMood.id]), complete: true },
    );

    expect(result.validIds.has(standaloneMood.id)).toBe(true);
    expect(result.orphanIds.size).toBe(0);
  });

  it('keeps an offline local message unresolved instead of deleting its mood', () => {
    const result = partitionMoodParentIds(
      ['offline-message'],
      new Set(['offline-message']),
      { ids: new Set(), complete: true },
    );

    expect(result.orphanIds.size).toBe(0);
    expect(result.unresolvedIds.has('offline-message')).toBe(true);
  });

  it('keeps a historical mood when its message only exists in cloud', () => {
    const result = partitionMoodParentIds(
      ['cloud-message'],
      new Set(),
      { ids: new Set(['cloud-message']), complete: true },
    );

    expect(result.validIds.has('cloud-message')).toBe(true);
    expect(result.orphanIds.size).toBe(0);
  });

  it('marks a mood orphaned only after a complete cloud check', () => {
    const complete = partitionMoodParentIds(
      ['missing-message'],
      new Set(),
      { ids: new Set(), complete: true },
    );
    const incomplete = partitionMoodParentIds(
      ['missing-message'],
      new Set(),
      { ids: new Set(), complete: false },
    );

    expect(complete.orphanIds.has('missing-message')).toBe(true);
    expect(incomplete.orphanIds.size).toBe(0);
    expect(incomplete.unresolvedIds.has('missing-message')).toBe(true);
  });
});
