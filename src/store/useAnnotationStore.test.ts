import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase-utils', () => ({
  getSupabaseSession: vi.fn(async () => null),
}));

import { useAnnotationStore } from './useAnnotationStore';
import { useOutboxStore } from './useOutboxStore';

describe('useAnnotationStore suggestion outcome sync', () => {
  beforeEach(() => {
    useOutboxStore.setState({ entries: [] });
    useAnnotationStore.setState((state) => ({
      ...state,
      currentAnnotation: null,
      annotations: [
        {
          id: 'annotation-1',
          content: 'test',
          tone: 'curious',
          timestamp: 1,
          relatedEvent: { type: 'activity_recorded', timestamp: 1 },
          displayDuration: 1000,
          syncedToCloud: true,
          suggestion: {
            type: 'todo',
            actionLabel: 'Do it',
            todoId: 'todo-1',
            rewardStars: 2,
          },
          suggestionAccepted: undefined,
        },
      ],
      suggestionOutcomes: [],
      activeRecoveryBonus: null,
    }));
  });

  it('keeps local accepted state and queues retry when no session', async () => {
    await useAnnotationStore.getState().recordSuggestionOutcome('annotation-1', true);

    expect(useAnnotationStore.getState().annotations[0].suggestionAccepted).toBe(true);
    expect(useOutboxStore.getState().entries).toHaveLength(1);
    expect(useOutboxStore.getState().entries[0].kind).toBe('annotation.outcome');
  });
});
