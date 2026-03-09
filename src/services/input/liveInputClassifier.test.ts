import { describe, expect, it } from 'vitest';
import { classifyLiveInput } from './liveInputClassifier';
import type { LiveInputContext } from './types';

const baseContext: LiveInputContext = { now: Date.now() };

function classify(content: string, context: LiveInputContext = baseContext) {
  return classifyLiveInput(content, context);
}

describe('classifyLiveInput zh seed and regression cases', () => {
  it('defaults punct-only input to standalone mood', () => {
    const result = classify('。。。');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies standalone mood case: 好累', () => {
    const result = classify('好累');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies new activity case: 开会', () => {
    const result = classify('开会');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies activity_with_mood case: 写周报写得很烦', () => {
    const result = classify('写周报写得很烦');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('activity_with_mood');
    expect(result.extractedMood).toBe('down');
    expect(result.moodNote).toBe('写周报写得很烦');
  });

  it('defaults ambiguous short text to mood: 有点乱', () => {
    const result = classify('有点乱');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('maps happy mood keyword in activity_with_mood', () => {
    const result = classify('跑完步好开心');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('activity_with_mood');
    expect(result.extractedMood).toBe('happy');
  });

  it('maps anxious mood keyword in activity_with_mood', () => {
    const result = classify('写方案很焦虑');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('activity_with_mood');
    expect(result.extractedMood).toBe('anxious');
  });

  it('normalizes trailing particles and keeps mood classification', () => {
    const result = classify('好累啊');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });
});

describe('classifyLiveInput context bias', () => {
  const contextWithEat: LiveInputContext = {
    now: Date.now(),
    recentActivity: {
      id: 'a-eat',
      content: '吃饭',
      timestamp: Date.now() - 5 * 60 * 1000,
      isOngoing: false,
    },
  };

  const contextWithMeeting: LiveInputContext = {
    now: Date.now(),
    recentActivity: {
      id: 'a-meet',
      content: '开会',
      timestamp: Date.now() - 5 * 60 * 1000,
      isOngoing: false,
    },
  };

  const contextWithWriting: LiveInputContext = {
    now: Date.now(),
    recentActivity: {
      id: 'a-write',
      content: '写方案',
      timestamp: Date.now() - 5 * 60 * 1000,
      isOngoing: true,
    },
  };

  it('biases to mood_about_last_activity: 吃饭好开心', () => {
    const result = classify('吃饭好开心', contextWithEat);
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-eat');
  });

  it('biases to mood_about_last_activity: 刚才那个会真烦', () => {
    const result = classify('刚才那个会真烦', contextWithMeeting);
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-meet');
  });

  it('biases to mood_about_last_activity: 终于做完了这件事情，好开心啊', () => {
    const result = classify('终于做完了这件事情，好开心啊', contextWithWriting);
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-write');
  });

  it('keeps new activity when strong new-action switch exists: 写完周报后去洗澡了', () => {
    const result = classify('写完周报后去洗澡了', contextWithWriting);
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('keeps new activity when sentence turns into a next action: 吃完饭去散步', () => {
    const result = classify('吃完饭去散步', contextWithEat);
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });
});

describe('classifyLiveInput additional regression set', () => {
  const cases: Array<{ input: string; kind: 'activity' | 'mood'; internalKind: string }> = [
    { input: '学习', kind: 'activity', internalKind: 'new_activity' },
    { input: '复习数学', kind: 'activity', internalKind: 'new_activity' },
    { input: '做作业', kind: 'activity', internalKind: 'new_activity' },
    { input: '去运动', kind: 'activity', internalKind: 'new_activity' },
    { input: '去散步', kind: 'activity', internalKind: 'new_activity' },
    { input: '洗澡', kind: 'activity', internalKind: 'new_activity' },
    { input: '写代码', kind: 'activity', internalKind: 'new_activity' },
    { input: '阅读文档', kind: 'activity', internalKind: 'new_activity' },
    { input: '好烦', kind: 'mood', internalKind: 'standalone_mood' },
    { input: '很焦虑', kind: 'mood', internalKind: 'standalone_mood' },
    { input: '今天状态很差', kind: 'mood', internalKind: 'standalone_mood' },
    { input: '没精神', kind: 'mood', internalKind: 'standalone_mood' },
    { input: '乱', kind: 'mood', internalKind: 'standalone_mood' },
  ];

  for (const testCase of cases) {
    it(`classifies "${testCase.input}" as ${testCase.internalKind}`, () => {
      const result = classify(testCase.input);
      expect(result.kind).toBe(testCase.kind);
      expect(result.internalKind).toBe(testCase.internalKind);
    });
  }
});
