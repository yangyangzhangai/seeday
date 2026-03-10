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

  it('biases by expanded zh reference variants: 那个电话打完后整个人都放松了', () => {
    const result = classify('那个电话打完后整个人都放松了', {
      now: Date.now(),
      recentActivity: {
        id: 'a-call',
        content: '给客户打电话',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-call');
  });

  it('biases by expanded zh reference variants: 刚才那节课让我有点挫败', () => {
    const result = classify('刚才那节课让我有点挫败', {
      now: Date.now(),
      recentActivity: {
        id: 'a-class',
        content: '上课',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-class');
  });

  it('biases to mood_about_last_activity: 终于做完了这件事情，好开心啊', () => {
    const result = classify('终于做完了这件事情，好开心啊', contextWithWriting);
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-write');
  });

  it('uses context-gated strong completion: 刚写完报告了好累', () => {
    const result = classify('刚写完报告了好累', {
      now: Date.now(),
      recentActivity: {
        id: 'a-report',
        content: '写报告',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-report');
  });

  it('keeps strong completion as activity when no related context', () => {
    const result = classify('刚写完报告了', contextWithMeeting);
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('treats weak completion as mood signal without context linking', () => {
    const result = classify('终于松口气了', contextWithWriting);
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
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

describe('classifyLiveInput gold-driven zh regressions', () => {
  it('recognizes colloquial activity: 摸鱼', () => {
    const result = classify('摸鱼');
    expect(result.internalKind).toBe('new_activity');
  });

  it('recognizes place-based activity: 去健身房', () => {
    const result = classify('去健身房');
    expect(result.internalKind).toBe('new_activity');
  });

  it('handles completion-style short activity: 搞定了', () => {
    const result = classify('搞定了');
    expect(result.internalKind).toBe('new_activity');
  });

  it('keeps pure mood phrase as standalone mood: 很开心', () => {
    const result = classify('很开心');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('captures activity_with_mood with bodily feeling: 写代码写到头疼', () => {
    const result = classify('写代码写到头疼');
    expect(result.internalKind).toBe('activity_with_mood');
  });

  it('captures activity_with_mood with mixed clause: 上课上得有点烦', () => {
    const result = classify('上课上得有点烦');
    expect(result.internalKind).toBe('activity_with_mood');
  });

  it('does not classify negative intention as new activity: 不想开会', () => {
    const result = classify('不想开会');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('does not classify plan statement as new activity: 明天要开会', () => {
    const result = classify('明天要开会');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('biases short evaluative phrase to last activity when context exists: 爽', () => {
    const result = classify('爽', {
      now: Date.now(),
      recentActivity: {
        id: 'a-gym',
        content: '健身',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('blocks planned activity before activity detection: 明天要去开会', () => {
    const result = classify('明天要去开会');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('does not use raw substring context matching: 刚写完报告了 vs 开会', () => {
    const result = classify('刚写完报告了，有点累', {
      now: Date.now(),
      recentActivity: {
        id: 'a-meet-2',
        content: '开会',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.internalKind).toBe('activity_with_mood');
  });

  it('captures activity_with_mood in social-work phrasing: 和客户会开得很顺利', () => {
    const result = classify('和客户会开得很顺利');
    expect(result.internalKind).toBe('activity_with_mood');
  });

  it('captures activity_with_mood in completion + joy phrasing: 刚打完球，好爽', () => {
    const result = classify('刚打完球，好爽');
    expect(result.internalKind).toBe('activity_with_mood');
  });

  it('captures activity_with_mood in completion + weak mood phrasing: 写完报告了，终于松口气', () => {
    const result = classify('写完报告了，终于松口气');
    expect(result.internalKind).toBe('activity_with_mood');
  });

  it('captures activity_with_mood in result-eval phrasing: 午休睡得很好', () => {
    const result = classify('午休睡得很好');
    expect(result.internalKind).toBe('activity_with_mood');
  });

  it('captures activity_with_mood in purchase + mood phrasing: 买到想要的东西，开心', () => {
    const result = classify('买到想要的东西，开心');
    expect(result.internalKind).toBe('activity_with_mood');
  });
});

describe('classifyLiveInput en/it baseline regressions', () => {
  it('classifies English standalone mood: I feel tired', () => {
    const result = classify('I feel tired');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies English activity: I am working', () => {
    const result = classify('I am working');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English mood about last activity with context', () => {
    const result = classify('the meeting was stressful', {
      now: Date.now(),
      recentActivity: {
        id: 'a-meeting-en',
        content: 'meeting',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-meeting-en');
  });

  it('classifies English mood_about_last_activity with causal evaluation phrasing', () => {
    const result = classify('that phone call made me anxious', {
      now: Date.now(),
      recentActivity: {
        id: 'a-call-en',
        content: 'phone call with client',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-call-en');
  });

  it('classifies English activity_with_mood: just finished report, relieved', () => {
    const result = classify('Just finished the report, relieved');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('activity_with_mood');
  });

  it('keeps English future plan sentence out of activity: later I will go to the gym', () => {
    const result = classify('Later I will go to the gym');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('does not link to unrelated recent context by raw substring in English', () => {
    const result = classify('I just wrapped up the report, exhausted', {
      now: Date.now(),
      recentActivity: {
        id: 'a-meeting-only',
        content: 'team meeting',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('activity_with_mood');
  });

  it('classifies Italian standalone mood: sono stanco', () => {
    const result = classify('sono stanco');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies Italian activity: sto studiando', () => {
    const result = classify('sto studiando');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('keeps planned Italian sentence out of activity: domani voglio correre', () => {
    const result = classify('domani voglio correre');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies Italian activity_with_mood: ho appena finito la riunione, sono sollevato', () => {
    const result = classify('Ho appena finito la riunione, sono sollevato');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('activity_with_mood');
  });

  it('classifies Italian mood_about_last_activity with causal mood phrasing', () => {
    const result = classify('quella lezione mi ha confuso', {
      now: Date.now(),
      recentActivity: {
        id: 'a-lesson-it',
        content: 'lezione',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-lesson-it');
  });

  it('keeps Italian future plan sentence out of activity: stasera ho intenzione di andare in palestra', () => {
    const result = classify('Stasera ho intenzione di andare in palestra');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });
});
