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
import { useOutboxStore } from './useOutboxStore';
import type { Message } from './useChatStore.types';
import { getLiveInputTelemetrySnapshot, resetLiveInputTelemetry } from '../services/input/liveInputTelemetry';
import { getLocalDateString } from './chatHelpers';
import { getSupabaseSession } from '../lib/supabase-utils';
import { supabase } from '../api/supabase';

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
    pendingManualEnds: {},
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

describe('useChatStore integration: auto recognition and correction flow', () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetMoodStore();
    resetChatStore();
    useOutboxStore.setState({ entries: [] });
    resetLiveInputTelemetry();
  });

  it('routes mixed evidence as new_activity and keeps its auto mood label', async () => {
    const classification = await useChatStore.getState().sendAutoRecognizedInput('写周报写得很烦');

    expect(classification?.kind).toBe('activity');
    expect(classification?.internalKind).toBe('new_activity');

    const messages = useChatStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].isMood).toBeUndefined();

    const moodState = useMoodStore.getState();
    expect(moodState.activityMood[messages[0].id]).toBe('down');
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

  it('allows sending two activities back to back and closes the first one', async () => {
    const firstTs = 1_700_000_000_000;
    await useChatStore.getState().sendMessage('吃饭', firstTs);
    await useChatStore.getState().sendMessage('睡觉', 1_700_000_600_000);

    const state = useChatStore.getState();
    const messages = state.messages;
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('吃饭');
    expect(messages[0].duration).toBe(10);
    expect(messages[0].isActive).toBe(false);
    expect(messages[1].content).toBe('睡觉');
    expect(messages[1].duration).toBeUndefined();
    expect(messages[1].isActive).toBe(true);

    const todayKey = getLocalDateString(new Date(firstTs));
    const cached = state.dateCache[todayKey] ?? [];
    expect(cached).toHaveLength(2);
    expect(cached[0].duration).toBe(10);
    expect(cached[0].isActive).toBe(false);
    expect(cached[1].isActive).toBe(true);
  });

  it('closes every ongoing activity before creating the next one', async () => {
    const base = 1_700_000_000_000;
    const olderOngoing: Message = {
      id: 'activity-ongoing-1',
      content: '写方案',
      timestamp: base,
      type: 'text',
      mode: 'record',
      activityType: 'work',
      duration: undefined,
      isActive: true,
    };
    const laterEnded: Message = {
      id: 'activity-ended-later',
      content: '吃饭',
      timestamp: base + 20 * 60 * 1000,
      type: 'text',
      mode: 'record',
      activityType: 'life',
      duration: 15,
      isActive: false,
    };
    const newerOngoing: Message = {
      id: 'activity-ongoing-2',
      content: '写代码',
      timestamp: base + 10 * 60 * 1000,
      type: 'text',
      mode: 'record',
      activityType: 'work',
      duration: undefined,
      isActive: true,
    };
    resetChatStore([olderOngoing, newerOngoing, laterEnded]);

    await useChatStore.getState().sendMessage('散步', base + 40 * 60 * 1000);

    const records = useChatStore.getState().messages.filter((message) => !message.isMood);
    const ongoing = records.filter((message) => message.duration === undefined);
    expect(ongoing).toHaveLength(1);
    expect(ongoing[0].content).toBe('散步');
    expect(records.find((message) => message.id === olderOngoing.id)?.isActive).toBe(false);
    expect(records.find((message) => message.id === newerOngoing.id)?.isActive).toBe(false);
    expect(records.find((message) => message.id === laterEnded.id)?.duration).toBe(15);
  });

  it('blocks inserted activities that overlap an ongoing activity', async () => {
    const base = 1_700_000_000_000;
    resetChatStore([
      {
        id: 'activity-ongoing',
        content: '写周报',
        timestamp: base,
        type: 'text',
        mode: 'record',
        activityType: 'work',
        duration: undefined,
        isActive: true,
      },
    ]);

    await expect(
      useChatStore.getState().insertActivity(null, null, '喝咖啡', base + 5 * 60 * 1000, base + 15 * 60 * 1000),
    ).rejects.toMatchObject({ message: 'overlap_with_ongoing_activity', activityContent: '写周报' });
    expect(useChatStore.getState().messages).toHaveLength(1);
  });

  it('blocks activity edits that would overlap an ongoing activity', async () => {
    const base = 1_700_000_000_000;
    resetChatStore([
      {
        id: 'activity-ongoing',
        content: '写周报',
        timestamp: base,
        type: 'text',
        mode: 'record',
        activityType: 'work',
        duration: undefined,
        isActive: true,
      },
      {
        id: 'activity-ended',
        content: '吃饭',
        timestamp: base - 60 * 60 * 1000,
        type: 'text',
        mode: 'record',
        activityType: 'life',
        duration: 20,
      },
    ]);

    await expect(
      useChatStore.getState().updateActivity('activity-ended', '吃饭', base - 10 * 60 * 1000, base + 5 * 60 * 1000),
    ).rejects.toMatchObject({ message: 'overlap_with_ongoing_activity', activityContent: '写周报' });
    expect(useChatStore.getState().messages.find((message) => message.id === 'activity-ended')?.duration).toBe(20);
  });

  it('keeps an edited ongoing activity open when only the start time changes', async () => {
    const base = 1_700_000_000_000;
    const dateKey = getLocalDateString(new Date(base));
    const activity: Message = {
      id: 'activity-ongoing-edit-start',
      content: '写方案',
      timestamp: base,
      type: 'text',
      mode: 'record',
      activityType: 'work',
      duration: undefined,
      isActive: true,
    };
    resetChatStore([activity]);
    useChatStore.setState({ dateCache: { [dateKey]: [activity] }, activeViewDateStr: dateKey });

    await useChatStore.getState().updateActivity(
      activity.id,
      '写方案',
      base - 5 * 60 * 1000,
      base,
      { keepOngoing: true },
    );

    let state = useChatStore.getState();
    expect(state.messages[0].timestamp).toBe(base - 5 * 60 * 1000);
    expect(state.messages[0].duration).toBeUndefined();
    expect(state.messages[0].isActive).toBe(true);
    expect(state.dateCache[dateKey][0].timestamp).toBe(base - 5 * 60 * 1000);
    expect(state.dateCache[dateKey][0].duration).toBeUndefined();
    expect(state.dateCache[dateKey][0].isActive).toBe(true);

    await useChatStore.getState().sendMessage('散步', base + 30 * 60 * 1000);

    state = useChatStore.getState();
    const edited = state.messages.find((message) => message.id === activity.id);
    expect(edited?.duration).toBe(35);
    expect(edited?.isActive).toBe(false);
  });

  it('keeps a manually ended activity closed when the next activity is added', async () => {
    const base = 1_700_000_000_000;
    const dateKey = getLocalDateString(new Date(base));
    const activity: Message = {
      id: 'activity-manual-ended',
      content: '写方案',
      timestamp: base,
      type: 'text',
      mode: 'record',
      activityType: 'work',
      duration: undefined,
      isActive: true,
    };
    resetChatStore([activity]);
    useChatStore.setState({ dateCache: { [dateKey]: [activity] }, activeViewDateStr: dateKey });

    await useChatStore.getState().updateActivity(
      activity.id,
      '写方案',
      base - 5 * 60 * 1000,
      base + 10 * 60 * 1000,
    );

    let state = useChatStore.getState();
    expect(state.messages[0].duration).toBe(15);
    expect(state.messages[0].isActive).toBe(false);
    expect(state.dateCache[dateKey][0].duration).toBe(15);
    expect(state.dateCache[dateKey][0].isActive).toBe(false);

    await useChatStore.getState().sendMessage('散步', base + 30 * 60 * 1000);

    state = useChatStore.getState();
    const edited = state.messages.find((message) => message.id === activity.id);
    expect(edited?.duration).toBe(15);
    expect(edited?.isActive).toBe(false);
  });

  it('persists closed state when manually ending an ongoing activity via edit', async () => {
    const base = 1_700_000_000_000;
    const updateChain = { eq: vi.fn().mockReturnThis() };
    const updateSpy = vi.fn().mockReturnValue(updateChain);
    const fromSpy = vi.spyOn(supabase, 'from').mockReturnValue({
      update: updateSpy,
    } as never);
    vi.mocked(getSupabaseSession).mockResolvedValue({ user: { id: 'user-1' } } as never);

    resetChatStore([
      {
        id: 'activity-persist-end',
        content: '写方案',
        timestamp: base,
        type: 'text',
        mode: 'record',
        activityType: 'work',
        duration: undefined,
        isActive: true,
      },
    ]);

    await useChatStore.getState().updateActivity(
      'activity-persist-end',
      '写方案',
      base,
      base + 10 * 60 * 1000,
    );

    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      duration: 10,
      is_active: false,
    }));

    fromSpy.mockRestore();
    vi.mocked(getSupabaseSession).mockResolvedValue(null as never);
  });

  it('keeps activity active during the 3-second manual-end undo window', async () => {
    const startedAt = 1_700_000_000_000;
    const endedAt = startedAt + 12 * 60 * 1000;
    const dateKey = getLocalDateString(new Date(startedAt));
    const activity: Message = {
      id: 'activity-manual-end',
      content: '写方案',
      timestamp: startedAt,
      type: 'text',
      mode: 'record',
      activityType: 'work',
      isActive: true,
      duration: undefined,
    };
    resetChatStore([activity]);
    useChatStore.setState({ dateCache: { [dateKey]: [activity] }, activeViewDateStr: dateKey });
    vi.useFakeTimers();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(endedAt);

    useChatStore.getState().requestManualEndActivity(activity.id);

    let state = useChatStore.getState();
    expect(state.pendingManualEnds[activity.id]).toBe(endedAt + 3_000);
    expect(state.messages[0].duration).toBeUndefined();
    expect(state.messages[0].isActive).toBe(true);
    expect(state.dateCache[dateKey][0].duration).toBeUndefined();
    expect(state.dateCache[dateKey][0].isActive).toBe(true);

    await vi.advanceTimersByTimeAsync(3_000);

    nowSpy.mockRestore();
    state = useChatStore.getState();
    expect(state.messages[0].duration).toBe(12);
    expect(state.messages[0].isActive).toBe(false);
    expect(state.pendingManualEnds[activity.id]).toBeUndefined();
    expect(state.dateCache[dateKey][0].duration).toBe(12);
    expect(state.dateCache[dateKey][0].isActive).toBe(false);
  });

  it('restores the activity when manual end is cancelled within 3 seconds', async () => {
    const startedAt = 1_700_000_000_000;
    const dateKey = getLocalDateString(new Date(startedAt));
    const activity: Message = {
      id: 'activity-manual-end-cancel',
      content: '写方案',
      timestamp: startedAt,
      type: 'text',
      mode: 'record',
      activityType: 'work',
      isActive: true,
      duration: undefined,
    };
    resetChatStore([activity]);
    useChatStore.setState({ dateCache: { [dateKey]: [activity] }, activeViewDateStr: dateKey });
    vi.useFakeTimers();

    useChatStore.getState().requestManualEndActivity(activity.id);
    useChatStore.getState().cancelManualEndActivity(activity.id);
    await vi.advanceTimersByTimeAsync(3_000);

    const state = useChatStore.getState();
    expect(state.pendingManualEnds[activity.id]).toBeUndefined();
    expect(state.messages[0].duration).toBeUndefined();
    expect(state.messages[0].isActive).toBe(true);
    expect(state.dateCache[dateKey][0].duration).toBeUndefined();
    expect(state.dateCache[dateKey][0].isActive).toBe(true);
  });

  it('keeps offline chat message as pending and enqueues outbox replay', async () => {
    await useChatStore.getState().sendMessage('离线记录', 1_700_000_000_000);

    const [message] = useChatStore.getState().messages;
    expect(message.syncState).toBe('pending');
    expect(useOutboxStore.getState().entries).toHaveLength(1);
    expect(useOutboxStore.getState().entries[0].kind).toBe('chat.upsert');
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

  it('keeps older local records when fetchMessages runs without a signed-in session', async () => {
    const base = 1_700_000_000_000;
    resetChatStore([
      {
        id: 'event-yesterday',
        content: 'Review notes',
        timestamp: base,
        type: 'text',
        mode: 'record',
        activityType: 'work',
      },
      {
        id: 'legacy',
        content: 'Legacy row',
        timestamp: base + 1_000,
        type: 'text',
        mode: 'record',
        activityType: 'chat' as never,
      },
      {
        id: 'event-today',
        content: 'Ship patch',
        timestamp: base + 2_000,
        type: 'text',
        mode: 'record',
        activityType: 'work',
      },
    ]);

    await useChatStore.getState().fetchMessages();

    expect(useChatStore.getState().messages.map((message) => message.id)).toEqual([
      'event-yesterday',
      'event-today',
    ]);
  });

  it('keeps the first mood label stable when later auto detection runs again', async () => {
    useMoodStore.getState().setMood('activity-stable', 'happy', 'auto');
    useMoodStore.getState().setMood('activity-stable', 'calm', 'auto');

    let moodState = useMoodStore.getState();
    expect(moodState.activityMood['activity-stable']).toBe('happy');
    expect(moodState.activityMoodMeta['activity-stable']?.source).toBe('auto');

    useMoodStore.getState().setMood('activity-stable', 'calm', 'manual');

    moodState = useMoodStore.getState();
    expect(moodState.activityMood['activity-stable']).toBe('calm');
    expect(moodState.activityMoodMeta['activity-stable']?.source).toBe('manual');
  });

  it('does not recompute edited activity mood after the first auto label is set', async () => {
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
    expect(moodState.activityMood['activity-auto']).toBe('down');
    expect(moodState.activityMoodMeta['activity-auto']?.source).toBe('auto');
    expect(moodState.activityMood['activity-manual']).toBe('happy');
    expect(moodState.activityMoodMeta['activity-manual']?.source).toBe('manual');
  });
});
