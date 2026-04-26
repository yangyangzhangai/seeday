import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callClassifierAPIMock } = vi.hoisted(() => ({
  callClassifierAPIMock: vi.fn(),
}));

vi.mock('../lib/supabase-utils', () => ({
  getSupabaseSession: vi.fn(async () => null),
}));

vi.mock('../api/client', () => ({
  callClassifierAPI: callClassifierAPIMock,
  isMembershipRequiredError: (error: unknown) => error instanceof Error
    && error.message.trim().toLowerCase() === 'membership_required',
}));

vi.mock('./useAnnotationStore', () => ({
  useAnnotationStore: {
    getState: () => ({
      triggerAnnotation: vi.fn(async () => undefined),
      consumeRecoveryBonusForCompletion: vi.fn(() => 1),
    }),
  },
}));

import { useAuthStore } from './useAuthStore';
import { useChatStore } from './useChatStore';
import { useGrowthStore } from './useGrowthStore';
import { useOutboxStore } from './useOutboxStore';
import { useTodoStore } from './useTodoStore';
import { clearMessageClassificationTasks } from './chatClassificationHelpers';

function resetChatStore() {
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
    dateCache: {},
  });
}

function resetGrowthAndTodo() {
  useGrowthStore.setState({ bottles: [] });
  useTodoStore.setState({
    todos: [],
    todoCompletionMessageMap: {},
    messageBottleStarRewardMap: {},
  });
}

function resetAuth(isPlus: boolean) {
  useAuthStore.setState({
    isPlus,
    membershipPlan: isPlus ? 'plus' : 'free',
  });
}

async function flushMicrotasks(rounds = 4): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await Promise.resolve();
  }
}

describe('useChatStore membership classify routing', () => {
  beforeEach(() => {
    clearMessageClassificationTasks();
    callClassifierAPIMock.mockReset();
    callClassifierAPIMock.mockResolvedValue({
      success: true,
      data: {
        kind: 'activity',
        activity_type: 'work',
        mood_type: null,
        matched_bottle: null,
        confidence: 0.9,
      },
    });
    resetChatStore();
    resetGrowthAndTodo();
    useOutboxStore.setState({ entries: [] });
  });

  it('Free regression: 50 messages -> classify calls = 0', async () => {
    resetAuth(false);

    for (let i = 0; i < 50; i += 1) {
      await useChatStore.getState().sendMessage(`free-case-${i}`, Date.now() + i * 60_000);
    }

    await flushMicrotasks();
    expect(callClassifierAPIMock).toHaveBeenCalledTimes(0);
  });

  it('Plus regression: 50 messages -> classify calls = 50', async () => {
    resetAuth(true);

    for (let i = 0; i < 50; i += 1) {
      await useChatStore.getState().sendMessage(`plus-case-${i}`, Date.now() + i * 60_000);
    }

    await flushMicrotasks();
    expect(callClassifierAPIMock).toHaveBeenCalledTimes(50);
  });

  it('Plus dedupe: send + endActivity does not duplicate classify', async () => {
    resetAuth(true);
    const messageId = await useChatStore.getState().sendMessage('plus-dedupe', Date.now());
    await useChatStore.getState().endActivity(messageId);

    await flushMicrotasks();
    expect(callClassifierAPIMock).toHaveBeenCalledTimes(1);
  });
});
