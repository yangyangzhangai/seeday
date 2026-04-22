import { beforeEach, describe, expect, it, vi } from 'vitest';

const { deleteMock, insertMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock('../lib/supabase-utils', () => ({
  getSupabaseSession: vi.fn(async () => ({ user: { id: 'user-1' } })),
}));

vi.mock('../api/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      delete: deleteMock,
      insert: insertMock,
    })),
  },
}));

vi.mock('./useChatStore', () => ({
  useChatStore: {
    getState: () => ({ messages: [] }),
    subscribe: vi.fn(() => () => undefined),
  },
}));

import { useOutboxStore } from './useOutboxStore';
import { usePlantStore } from './usePlantStore';

describe('usePlantStore direction sync', () => {
  beforeEach(() => {
    useOutboxStore.setState({ entries: [] });
    usePlantStore.setState({
      todaySegments: [],
      todayPlant: null,
      directionOrder: ['work_study', 'exercise', 'social', 'entertainment', 'life'],
      isGenerating: false,
      selectedRootId: null,
      lastAutoBackfillAttemptDate: null,
    });

    deleteMock.mockReset();
    insertMock.mockReset();
  });

  it('keeps local direction order and enqueues retry when cloud sync fails', async () => {
    deleteMock.mockReturnValue({ eq: vi.fn(async () => ({ error: new Error('offline') })) });

    const nextOrder = ['life', 'social', 'work_study', 'exercise', 'entertainment'] as const;
    await usePlantStore.getState().setDirectionOrder([...nextOrder]);

    expect(usePlantStore.getState().directionOrder).toEqual(nextOrder);
    expect(useOutboxStore.getState().entries).toHaveLength(1);
    expect(useOutboxStore.getState().entries[0].kind).toBe('plant.directionOrder');
  });

  it('does not enqueue retry when cloud sync succeeds', async () => {
    deleteMock.mockReturnValue({ eq: vi.fn(async () => ({ error: null })) });
    insertMock.mockResolvedValue({ error: null });

    await usePlantStore.getState().setDirectionOrder(['life', 'social', 'work_study', 'exercise', 'entertainment']);

    expect(useOutboxStore.getState().entries).toEqual([]);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});
