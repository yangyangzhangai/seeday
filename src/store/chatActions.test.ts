import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildRecentReclassifyResult,
  sendAutoRecognizedInputFlow,
} from './chatActions';
import { useMoodStore } from './useMoodStore';
import { getLiveInputTelemetrySnapshot, resetLiveInputTelemetry } from '../services/input/liveInputTelemetry';
import type { Message } from './useChatStore';

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

describe('sendAutoRecognizedInputFlow sentence-level regression', () => {
  beforeEach(() => {
    resetMoodStore();
    resetLiveInputTelemetry();
  });

  it('classifies standalone mood and dispatches to sendMood', async () => {
    const sendMessage = vi.fn(async () => 'msg-1');
    const sendMood = vi.fn(async () => 'mood-1');

    const result = await sendAutoRecognizedInputFlow('好累', [], sendMessage, sendMood);

    expect(result?.classification.kind).toBe('mood');
    expect(result?.classification.internalKind).toBe('standalone_mood');
    expect(sendMood).toHaveBeenCalledWith('好累', undefined);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('classifies new activity and dispatches to sendMessage', async () => {
    const sendMessage = vi.fn(async () => 'msg-1');
    const sendMood = vi.fn(async () => 'mood-1');

    const result = await sendAutoRecognizedInputFlow('开会', [], sendMessage, sendMood);

    expect(result?.classification.kind).toBe('activity');
    expect(result?.classification.internalKind).toBe('new_activity');
    expect(sendMessage).toHaveBeenCalledWith('开会', undefined, 'record', { skipMoodDetection: false });
    expect(sendMood).not.toHaveBeenCalled();
  });

  it('classifies activity_with_mood and writes back derived mood', async () => {
    const sendMessage = vi.fn(async () => 'activity-1');
    const sendMood = vi.fn(async () => 'mood-1');

    const result = await sendAutoRecognizedInputFlow('写周报写得很烦', [], sendMessage, sendMood);

    expect(result?.classification.internalKind).toBe('activity_with_mood');
    expect(sendMessage).toHaveBeenCalledWith('写周报写得很烦', undefined, 'record', { skipMoodDetection: true });
    const moodState = useMoodStore.getState();
    expect(moodState.activityMood['activity-1']).toBe('down');
    expect(moodState.moodNote['activity-1']).toBe('写周报写得很烦');
    expect(sendMood).not.toHaveBeenCalled();
  });

  it('classifies mood_about_last_activity with recent context sentence', async () => {
    const now = Date.now();
    const messages: Message[] = [
      {
        id: 'a-eat',
        content: '吃饭',
        timestamp: now - 5 * 60 * 1000,
        type: 'text',
        mode: 'record',
        activityType: '待分类',
        duration: undefined,
      },
    ];
    const sendMessage = vi.fn(async () => 'activity-1');
    const sendMood = vi.fn(async () => 'mood-1');

    const result = await sendAutoRecognizedInputFlow('吃饭好开心', messages, sendMessage, sendMood);

    expect(result?.classification.kind).toBe('mood');
    expect(result?.classification.internalKind).toBe('mood_about_last_activity');
    expect(result?.classification.relatedActivityId).toBe('a-eat');
    expect(sendMood).toHaveBeenCalledWith('吃饭好开心', { relatedActivityId: 'a-eat' });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('records telemetry for auto-recognized classification reasons', async () => {
    const sendMessage = vi.fn(async () => 'activity-1');
    const sendMood = vi.fn(async () => 'mood-1');

    await sendAutoRecognizedInputFlow('写周报写得很烦', [], sendMessage, sendMood);

    const snapshot = getLiveInputTelemetrySnapshot();
    expect(snapshot.autoRecognizedTotal).toBe(1);
    expect(snapshot.classificationByInternalKind.activity_with_mood).toBe(1);
    expect(snapshot.topReasons.some((item) => item.reason === 'activity_with_mood_detected')).toBe(true);
  });
});

describe('buildRecentReclassifyResult timeline repair regression', () => {
  it('mood -> activity closes previous ongoing activity', () => {
    const base = 1_700_000_000_000;
    const messages: Message[] = [
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
    ];

    const result = buildRecentReclassifyResult(messages, 'mood-1', 'activity', {
      'activity-1': { source: 'auto', linkedMoodMessageId: 'mood-1' },
    });

    expect(result).not.toBeNull();
    const latest = result!.updatedMessages.find((m) => m.id === 'mood-1');
    const previous = result!.updatedMessages.find((m) => m.id === 'activity-1');
    expect(latest?.isMood).toBe(false);
    expect(previous?.duration).toBe(10);
    expect(result?.previousActivityMoodAttachmentToClear).toBe('activity-1');
  });

  it('activity -> mood reopens adjacent previous activity when duration matches', () => {
    const base = 1_700_000_000_000;
    const messages: Message[] = [
      {
        id: 'activity-1',
        content: '吃饭',
        timestamp: base,
        type: 'text',
        mode: 'record',
        activityType: '待分类',
        duration: 10,
      },
      {
        id: 'activity-2',
        content: '散步',
        timestamp: base + 10 * 60 * 1000,
        type: 'text',
        mode: 'record',
        activityType: '待分类',
        duration: undefined,
      },
    ];

    const result = buildRecentReclassifyResult(messages, 'activity-2', 'mood', {});

    expect(result).not.toBeNull();
    const latest = result!.updatedMessages.find((m) => m.id === 'activity-2');
    const previous = result!.updatedMessages.find((m) => m.id === 'activity-1');
    expect(latest?.isMood).toBe(true);
    expect(latest?.activityType).toBe('mood');
    expect(previous?.duration).toBeUndefined();
  });

  it('returns null when target is not latest message', () => {
    const base = 1_700_000_000_000;
    const messages: Message[] = [
      {
        id: 'target',
        content: '开会',
        timestamp: base,
        type: 'text',
        mode: 'record',
        activityType: '待分类',
      },
      {
        id: 'latest',
        content: '好累',
        timestamp: base + 1_000,
        type: 'text',
        mode: 'record',
        activityType: 'mood',
        isMood: true,
      },
    ];

    const result = buildRecentReclassifyResult(messages, 'target', 'mood', {});
    expect(result).toBeNull();
  });
});
