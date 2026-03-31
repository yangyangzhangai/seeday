import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  persistMessageToSupabaseMock,
  triggerMoodDetectionMock,
  closePreviousActivityMock,
} = vi.hoisted(() => ({
  persistMessageToSupabaseMock: vi.fn(async () => undefined),
  triggerMoodDetectionMock: vi.fn(async () => undefined),
  closePreviousActivityMock: vi.fn(async (messages: unknown[]) => messages),
}));

vi.mock('../lib/supabase-utils', () => ({
  getSupabaseSession: vi.fn(async () => ({ user: { id: 'user-1' } })),
}));

vi.mock('./useAnnotationStore', () => ({
  useAnnotationStore: {
    getState: () => ({
      triggerAnnotation: vi.fn(async () => undefined),
    }),
  },
}));

vi.mock('./chatActions', async () => {
  const actual = await vi.importActual<typeof import('./chatActions')>('./chatActions');
  return {
    ...actual,
    closePreviousActivity: closePreviousActivityMock,
    persistMessageToSupabase: persistMessageToSupabaseMock,
    triggerMoodDetection: triggerMoodDetectionMock,
  };
});

import { useChatStore } from './useChatStore';

describe('useChatStore persistence ordering', () => {
  beforeEach(() => {
    persistMessageToSupabaseMock.mockClear();
    triggerMoodDetectionMock.mockClear();
    closePreviousActivityMock.mockClear();
    useChatStore.setState({
      messages: [],
      lastActivityTime: null,
      isMoodMode: false,
      isLoading: false,
      hasInitialized: true,
      oldestLoadedDate: null,
      hasMoreHistory: true,
      isLoadingMore: false,
      yesterdaySummary: null,
      currentDateStr: null,
      activeViewDateStr: null,
      dateCache: new Map(),
    });
  });

  it('persists a new activity message before writing its mood row', async () => {
    const callOrder: string[] = [];
    persistMessageToSupabaseMock.mockImplementationOnce(async () => {
      callOrder.push('message');
    });
    triggerMoodDetectionMock.mockImplementationOnce(async () => {
      callOrder.push('mood');
    });

    await useChatStore.getState().sendMessage('吃饭');

    expect(callOrder).toEqual(['message', 'mood']);
    expect(persistMessageToSupabaseMock).toHaveBeenCalledTimes(1);
    expect(triggerMoodDetectionMock).toHaveBeenCalledTimes(1);
  });

  it('persists both the reattached mood card and its parent event', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'event-1',
          content: 'Write docs',
          timestamp: 1_700_000_000_000,
          type: 'text',
          mode: 'record',
          activityType: 'work',
        },
        {
          id: 'mood-1',
          content: 'Relieved',
          timestamp: 1_700_000_600_000,
          type: 'text',
          mode: 'record',
          activityType: 'mood',
          isMood: true,
          detached: true,
        },
      ],
    });

    await useChatStore.getState().reattachMoodToEvent('mood-1');

    expect(persistMessageToSupabaseMock).toHaveBeenCalledTimes(2);
    const persistedIds = persistMessageToSupabaseMock.mock.calls.map(([message]) => message.id).sort();
    expect(persistedIds).toEqual(['event-1', 'mood-1']);
  });

  it('persists detached=true for first standalone mood card', async () => {
    await useChatStore.getState().sendMood('有点累');

    expect(persistMessageToSupabaseMock).toHaveBeenCalledTimes(1);
    const [persistedMessage, userId, isMood] = persistMessageToSupabaseMock.mock.calls[0];
    expect(persistedMessage.isMood).toBe(true);
    expect(persistedMessage.detached).toBe(true);
    expect(userId).toBe('user-1');
    expect(isMood).toBe(true);
  });
});
