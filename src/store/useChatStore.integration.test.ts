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
import { getLiveInputTelemetrySnapshot, resetLiveInputTelemetry } from '../services/input/liveInputTelemetry';

function resetMoodStore() {
  useMoodStore.setState({
    activityMood: {},
    activityMoodMeta: {},
    customMoodLabel: {},
    customMoodApplied: {},
    customMoodOptions: [],
    moodNote: {},
    moodNoteMeta: {},
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
    resetLiveInputTelemetry();
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
        activityType: 'life',
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

  it('attaches standalone mood to ongoing activity only', async () => {
    const base = Date.now() - 5 * 60 * 1000;
    resetChatStore([
      {
        id: 'activity-ongoing',
        content: '写周报',
        timestamp: base,
        type: 'text',
        mode: 'record',
        activityType: 'life',
        duration: undefined,
      },
    ]);

    await useChatStore.getState().sendAutoRecognizedInput('好累');

    let moodState = useMoodStore.getState();
    expect(moodState.moodNote['activity-ongoing']).toBe('好累');
    expect(moodState.moodNoteMeta['activity-ongoing']?.source).toBe('auto');
    expect(moodState.moodNoteMeta['activity-ongoing']?.linkedMoodMessageId).toBeDefined();

    resetMoodStore();
    resetChatStore([
      {
        id: 'activity-ended',
        content: '吃饭',
        timestamp: base,
        type: 'text',
        mode: 'record',
        activityType: 'life',
        duration: 20,
      },
    ]);

    await useChatStore.getState().sendAutoRecognizedInput('好累');

    moodState = useMoodStore.getState();
    expect(moodState.moodNote['activity-ended']).toBeUndefined();
    expect(moodState.moodNoteMeta['activity-ended']).toBeUndefined();
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
        activityType: 'life',
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
      moodNoteMeta: {
        'activity-1': { source: 'auto', linkedMoodMessageId: 'mood-1' },
      },
    });

    await useChatStore.getState().reclassifyRecentInput('mood-1', 'activity');

    let messages = useChatStore.getState().messages;
    expect(messages.find((m) => m.id === 'mood-1')?.isMood).toBe(false);
    expect(messages.find((m) => m.id === 'activity-1')?.duration).toBe(10);
    expect(useMoodStore.getState().moodNote['activity-1']).toBeUndefined();
    expect(useMoodStore.getState().moodNoteMeta['activity-1']).toBeUndefined();

    await useChatStore.getState().reclassifyRecentInput('mood-1', 'mood');

    messages = useChatStore.getState().messages;
    expect(messages.find((m) => m.id === 'mood-1')?.isMood).toBe(true);
    expect(messages.find((m) => m.id === 'activity-1')?.duration).toBeUndefined();
    expect(useMoodStore.getState().moodNote['activity-1']).toBe('好烦');

    const telemetry = getLiveInputTelemetrySnapshot();
    expect(telemetry.correctionByPath['mood->activity']).toBe(1);
    expect(telemetry.correctionByPath['activity->mood']).toBe(1);
  });

  it('allows converting detached mood card even when it is not the latest record message', async () => {
    const base = 1_700_000_000_000;
    resetChatStore([
      {
        id: 'mood-old',
        content: '有点烦',
        timestamp: base,
        type: 'text',
        mode: 'record',
        activityType: 'mood',
        isMood: true,
        detached: true,
      },
      {
        id: 'activity-latest',
        content: '写代码',
        timestamp: base + 10 * 60 * 1000,
        type: 'text',
        mode: 'record',
        activityType: 'work',
        duration: undefined,
      },
    ]);

    await useChatStore.getState().convertMoodToEvent('mood-old');

    const messages = useChatStore.getState().messages;
    expect(messages.find((m) => m.id === 'mood-old')?.isMood).toBe(false);
    expect(messages.find((m) => m.id === 'mood-old')?.activityType).not.toBe('mood');
    expect(messages.find((m) => m.id === 'mood-old')?.duration).toBe(0);
    expect(messages.find((m) => m.id === 'activity-latest')?.isMood).toBeUndefined();
  });

  it('auto-assigns mood label after converting latest mood card to event', async () => {
    const base = 1_700_000_000_000;
    resetChatStore([
      {
        id: 'activity-old',
        content: '开会',
        timestamp: base,
        type: 'text',
        mode: 'record',
        activityType: 'work',
        duration: undefined,
      },
      {
        id: 'mood-latest',
        content: '整理文档',
        timestamp: base + 10 * 60 * 1000,
        type: 'text',
        mode: 'record',
        activityType: 'mood',
        isMood: true,
        detached: true,
      },
    ]);

    await useChatStore.getState().convertMoodToEvent('mood-latest');

    const messages = useChatStore.getState().messages;
    expect(messages.find((m) => m.id === 'mood-latest')?.isMood).toBe(false);
    expect(useMoodStore.getState().activityMood['mood-latest']).toBeDefined();
  });

  it('re-sorts timeline items when a detached mood card time is edited', async () => {
    const base = 1_700_000_000_000;
    resetChatStore([
      {
        id: 'event-1',
        content: '阅读',
        timestamp: base,
        type: 'text',
        mode: 'record',
        activityType: 'life',
        duration: 20,
      },
      {
        id: 'mood-detached',
        content: '有点累',
        timestamp: base + 30 * 60 * 1000,
        type: 'text',
        mode: 'record',
        activityType: 'mood',
        isMood: true,
        detached: true,
      },
    ]);

    await useChatStore.getState().updateActivity(
      'mood-detached',
      '有点累',
      base - 5 * 60 * 1000,
      base - 5 * 60 * 1000,
    );

    const ordered = useChatStore.getState().messages.map((m) => m.id);
    expect(ordered[0]).toBe('mood-detached');
    expect(ordered[1]).toBe('event-1');
  });

  it('assigns auto mood when detaching mood description into a mood card', async () => {
    const base = 1_700_000_000_000;
    resetChatStore([
      {
        id: 'event-1',
        content: '开会',
        timestamp: base,
        type: 'text',
        mode: 'record',
        activityType: 'work',
        duration: undefined,
        moodDescriptions: [
          {
            id: 'mood-1',
            content: '有点烦',
            timestamp: base + 10 * 60 * 1000,
          },
        ],
      },
      {
        id: 'mood-1',
        content: '有点烦',
        timestamp: base + 10 * 60 * 1000,
        type: 'text',
        mode: 'record',
        activityType: 'mood',
        isMood: true,
        detached: false,
      },
    ]);

    useChatStore.getState().detachMoodFromEvent('event-1', 'mood-1');

    const messages = useChatStore.getState().messages;
    expect(messages.find((m) => m.id === 'mood-1')?.detached).toBe(true);
    expect(useMoodStore.getState().activityMood['mood-1']).toBeDefined();
  });

  it('assigns auto mood for inserted activity card immediately', async () => {
    const base = 1_700_000_000_000;
    resetChatStore([
      {
        id: 'event-1',
        content: '学习',
        timestamp: base,
        type: 'text',
        mode: 'record',
        activityType: 'life',
        duration: 60,
      },
    ]);

    await useChatStore.getState().insertActivity(
      'event-1',
      null,
      '跑步',
      base + 70 * 60 * 1000,
      base + 100 * 60 * 1000,
    );

    const inserted = useChatStore.getState().messages.find((m) => m.content === '跑步');
    expect(inserted).toBeDefined();
    expect(useMoodStore.getState().activityMood[inserted!.id]).toBeDefined();
  });

  it('recomputes edited activity mood only when source is auto', async () => {
    const base = 1_700_000_000_000;
    resetChatStore([
      {
        id: 'activity-auto',
        content: '开会',
        timestamp: base,
        type: 'text',
        mode: 'record',
        activityType: 'life',
        duration: 10,
      },
      {
        id: 'activity-manual',
        content: '学习',
        timestamp: base + 20 * 60 * 1000,
        type: 'text',
        mode: 'record',
        activityType: 'life',
        duration: 10,
      },
    ]);

    useMoodStore.setState({
      ...useMoodStore.getState(),
      activityMood: {
        'activity-auto': 'down',
        'activity-manual': 'happy',
      },
      activityMoodMeta: {
        'activity-auto': { source: 'auto' },
        'activity-manual': { source: 'manual' },
      },
    });

    await useChatStore.getState().updateActivity('activity-auto', '跑步', base, base + 10 * 60 * 1000);
    await useChatStore.getState().updateActivity(
      'activity-manual',
      '跑步',
      base + 20 * 60 * 1000,
      base + 30 * 60 * 1000,
    );

    const moodState = useMoodStore.getState();
    expect(moodState.activityMood['activity-auto']).toBe('happy');
    expect(moodState.activityMoodMeta['activity-auto']?.source).toBe('auto');
    expect(moodState.activityMood['activity-manual']).toBe('happy');
    expect(moodState.activityMoodMeta['activity-manual']?.source).toBe('manual');
  });
});
