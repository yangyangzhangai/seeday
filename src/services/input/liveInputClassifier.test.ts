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

  it('classifies standalone mood case: 难过了', () => {
    const result = classify('难过了');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies new activity case: 开会', () => {
    const result = classify('开会');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies group-meeting phrase as activity: 开组会', () => {
    const result = classify('开组会');
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

  it('forces short pure mood phrase to high standalone mood: 我很紧张', () => {
    const result = classify('我很紧张');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
    expect(result.confidence).toBe('high');
    expect(result.reasons).toContain('short_pure_mood_override');
  });

  it('forces colloquial short mood phrase to high standalone mood: 心情好好', () => {
    const result = classify('心情好好');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
    expect(result.confidence).toBe('high');
    expect(result.reasons).toContain('short_pure_mood_override');
  });

  it('classifies colloquial status phrase as mood: 状态还行', () => {
    const result = classify('状态还行');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('does not force short pure mood override when time anchor exists: 刚才好累', () => {
    const result = classify('刚才好累');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
    expect(result.reasons).not.toContain('short_pure_mood_override');
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

  it('biases repeated newspaper activity+emotion to mood_about_last_activity', () => {
    const result = classify('我在看报纸好开心', {
      now: Date.now(),
      recentActivity: {
        id: 'a-news-zh',
        content: '我在看报纸好开心',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-news-zh');
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

  it('treats weak completion as mood signal without context linking when no recent context', () => {
    const result = classify('终于松口气了');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('keeps weak completion as standalone mood with ongoing context', () => {
    const result = classify('终于松口气了', contextWithWriting);
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
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
    { input: '起床', kind: 'activity', internalKind: 'new_activity' },
    { input: '吃早饭', kind: 'activity', internalKind: 'new_activity' },
    { input: '看小说', kind: 'activity', internalKind: 'new_activity' },
    { input: '看动漫', kind: 'activity', internalKind: 'new_activity' },
    { input: '洗头', kind: 'activity', internalKind: 'new_activity' },
    { input: '收拾房间', kind: 'activity', internalKind: 'new_activity' },
    { input: '遛狗', kind: 'activity', internalKind: 'new_activity' },
    { input: '取快递', kind: 'activity', internalKind: 'new_activity' },
    { input: '点外卖', kind: 'activity', internalKind: 'new_activity' },
    { input: '打游戏', kind: 'activity', internalKind: 'new_activity' },
    { input: '听歌', kind: 'activity', internalKind: 'new_activity' },
    { input: '喝水', kind: 'activity', internalKind: 'new_activity' },
    { input: '聊天', kind: 'activity', internalKind: 'new_activity' },
    { input: '约饭', kind: 'activity', internalKind: 'new_activity' },
    { input: '开黑', kind: 'activity', internalKind: 'new_activity' },
    { input: '连麦', kind: 'activity', internalKind: 'new_activity' },
    { input: '逛街', kind: 'activity', internalKind: 'new_activity' },
    { input: '探店', kind: 'activity', internalKind: 'new_activity' },
    { input: '撸铁', kind: 'activity', internalKind: 'new_activity' },
    { input: '复习英语', kind: 'activity', internalKind: 'new_activity' },
    { input: '复习语文', kind: 'activity', internalKind: 'new_activity' },
    { input: '复习公司金融', kind: 'activity', internalKind: 'new_activity' },
    { input: '复习概率统计', kind: 'activity', internalKind: 'new_activity' },
    { input: '学公司金融', kind: 'activity', internalKind: 'new_activity' },
    { input: '学医学英语', kind: 'activity', internalKind: 'new_activity' },
    { input: '看公司金融', kind: 'activity', internalKind: 'new_activity' },
    { input: '练概率统计', kind: 'activity', internalKind: 'new_activity' },
    { input: '背医学英语', kind: 'activity', internalKind: 'new_activity' },
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

  it('intercepts no-output sentence as standalone mood: 今天没有产出', () => {
    const result = classify('今天没有产出');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('intercepts no-output sentence as standalone mood: 没产出', () => {
    const result = classify('没产出');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('treats inability phrasing as mood: 学不下去了', () => {
    const result = classify('学不下去了');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('treats inability phrasing as mood: 看不进去', () => {
    const result = classify('看不进去');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('treats inability phrasing as mood: 写不动了', () => {
    const result = classify('写不动了');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('treats inability phrasing as mood: 干不下去', () => {
    const result = classify('干不下去');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('treats low-motivation phrasing as mood: 学习提不起劲', () => {
    const result = classify('学习提不起劲');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('does not over-trigger activity for 学期 in mood sentence', () => {
    const result = classify('这学期压力好大');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('does not over-trigger activity for 看起来 in mood sentence', () => {
    const result = classify('今天看起来状态很差');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('does not over-trigger activity for 练习惯 in neutral sentence', () => {
    const result = classify('我想先练习惯再说');
    expect(result.kind).toBe('mood');
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

  it('classifies go+place as new activity: 去公园', () => {
    const result = classify('去公园');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies go+place as new activity: 去博物馆', () => {
    const result = classify('去博物馆');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies go+place as new activity: 去超市', () => {
    const result = classify('去超市');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('blocks planned go+place: 待会去公园', () => {
    const result = classify('待会去公园');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('blocks planned go+place: 明天去博物馆', () => {
    const result = classify('明天去博物馆');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('blocks negated not-occurred go+place: 想去公园但没去', () => {
    const result = classify('想去公园但没去');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('keeps happened shell go+place as activity: 刚去超市回来', () => {
    const result = classify('刚去超市回来');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('keeps happened shell go+place as activity: 已经去公园了', () => {
    const result = classify('已经去公园了');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies go+place with mood as activity_with_mood: 去公园好开心', () => {
    const result = classify('去公园好开心');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('activity_with_mood');
    expect(result.extractedMood).toBe('happy');
  });

  it('emits evidence entries for planned interception', () => {
    const result = classify('明天去博物馆');
    expect(result.internalKind).toBe('standalone_mood');
    expect(result.evidence?.some((item) => item.reasonCode === 'matched_future_or_planned_signal')).toBe(true);
  });

  it('emits go+place happened-shell evidence details', () => {
    const result = classify('刚去超市回来');
    expect(result.internalKind).toBe('new_activity');
    expect(result.evidence?.some((item) => item.reasonCode === 'matched_go_to_place_signal')).toBe(true);
    expect(result.evidence?.some((item) => item.reasonCode === 'matched_go_to_place_happened_shell')).toBe(true);
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

  it('classifies English generic study object: studying corporate finance', () => {
    const result = classify('Studying corporate finance');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English generic review object: reviewing probability statistics', () => {
    const result = classify('Reviewing probability statistics');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English social slang activity: grabbing lunch with friends', () => {
    const result = classify('Grabbing lunch with friends');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English entertainment activity: watching anime', () => {
    const result = classify('Watching anime');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English daily activity: reading the newspaper', () => {
    const result = classify('Reading the newspaper');
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

  it('classifies English repeated activity+mood as mood_about_last_activity with context overlap', () => {
    const result = classify('reading the newspaper feels good', {
      now: Date.now(),
      recentActivity: {
        id: 'a-news-en',
        content: 'reading the newspaper',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-news-en');
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

  it('classifies Italian generic study object: sto studiando finanza aziendale', () => {
    const result = classify('Sto studiando finanza aziendale');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies Italian generic review object: ripasso statistica', () => {
    const result = classify('Ripasso statistica');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies Italian social activity: prendo pranzo con un amico', () => {
    const result = classify('Prendo pranzo con un amico');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies Italian entertainment activity: guardo anime', () => {
    const result = classify('Guardo anime');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies Italian daily activity: leggo il giornale', () => {
    const result = classify('Leggo il giornale');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
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

  it('classifies Italian repeated activity+mood as mood_about_last_activity with context overlap', () => {
    const result = classify('leggo il giornale e mi sento bene', {
      now: Date.now(),
      recentActivity: {
        id: 'a-news-it',
        content: 'leggo il giornale',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-news-it');
  });

  it('keeps Italian future plan sentence out of activity: stasera ho intenzione di andare in palestra', () => {
    const result = classify('Stasera ho intenzione di andare in palestra');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });
});
