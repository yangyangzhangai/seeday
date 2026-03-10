import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase-utils', () => ({
  getSupabaseSession: vi.fn(async () => null),
}));

vi.mock('./useAnnotationStore', () => ({
  useAnnotationStore: {
    getState: () => ({
      triggerAnnotation: vi.fn(async () => undefined),
    }),
  },
}));

import { useMoodStore } from './useMoodStore';
import { useChatStore } from './useChatStore';
import type { Message } from './useChatStore';

function resetMoodStore() {
  useMoodStore.setState({
    activityMood: {},
    customMoodLabel: {},
    customMoodApplied: {},
    customMoodOptions: [],
    moodNote: {},
  });
}

function resetChatStore(messages: Message[] = []) {
  useChatStore.setState({
    messages,
    mode: 'record',
    lastActivityTime: null,
    isMoodMode: false,
    isLoading: false,
    hasInitialized: true,
    oldestLoadedDate: null,
    hasMoreHistory: true,
    isLoadingMore: false,
    yesterdaySummary: null,
    currentDateStr: null,
  });
}

describe('useChatStore integration: auto recognition and correction flow', () => {
  beforeEach(() => {
    resetMoodStore();
    resetChatStore();
  });

  it('routes activity_with_mood sentence through send path and mood writeback', async () => {
    const classification = await useChatStore.getState().sendAutoRecognizedInput('写周报写得很烦');

    expect(classification?.kind).toBe('activity');
    expect(classification?.internalKind).toBe('activity_with_mood');

    const messages = useChatStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].isMood).toBeUndefined();

    const moodState = useMoodStore.getState();
    expect(moodState.activityMood[messages[0].id]).toBe('down');
    expect(moodState.moodNote[messages[0].id]).toBe('写周报写得很烦');
  });

  it('routes mood_about_last_activity sentence and links note to latest activity', async () => {
    const base = Date.now() - 5 * 60 * 1000;
    resetChatStore([
      {
        id: 'activity-eat',
        content: '吃饭',
        timestamp: base,
        type: 'text',
        mode: 'record',
        activityType: '待分类',
        duration: undefined,
      },
    ]);

    const classification = await useChatStore.getState().sendAutoRecognizedInput('吃饭好开心');

    expect(classification?.kind).toBe('mood');
    expect(classification?.internalKind).toBe('mood_about_last_activity');
    expect(classification?.relatedActivityId).toBe('activity-eat');

    const messages = useChatStore.getState().messages;
    expect(messages).toHaveLength(2);
    expect(messages[1].isMood).toBe(true);
    expect(useMoodStore.getState().moodNote['activity-eat']).toBe('吃饭好开心');
  });

  it('reclassifies latest mood <-> activity with minimal timeline repair', async () => {
    const base = 1_700_000_000_000;
    resetChatStore([
      {
        id: 'activity-1',
        content: '写周报',
        timestamp: base,
        type: 'text',
        mode: 'record',
        activityType: '待分类',
        duration: undefined,
      },
      {
        id: 'mood-1',
        content: '好烦',
        timestamp: base + 10 * 60 * 1000,
        type: 'text',
        mode: 'record',
        activityType: 'mood',
        isMood: true,
      },
    ]);

    useMoodStore.setState({
      ...useMoodStore.getState(),
      moodNote: { 'activity-1': '好烦' },
    });

    await useChatStore.getState().reclassifyRecentInput('mood-1', 'activity');

    let messages = useChatStore.getState().messages;
    expect(messages.find((m) => m.id === 'mood-1')?.isMood).toBe(false);
    expect(messages.find((m) => m.id === 'activity-1')?.duration).toBe(10);
    expect(useMoodStore.getState().moodNote['activity-1']).toBeUndefined();

    await useChatStore.getState().reclassifyRecentInput('mood-1', 'mood');

    messages = useChatStore.getState().messages;
    expect(messages.find((m) => m.id === 'mood-1')?.isMood).toBe(true);
    expect(messages.find((m) => m.id === 'activity-1')?.duration).toBeUndefined();
    expect(useMoodStore.getState().moodNote['activity-1']).toBe('好烦');
  });
});
