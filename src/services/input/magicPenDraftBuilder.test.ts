import { describe, expect, it } from 'vitest';
import {
  alignPeriodDraftsToMessageGaps,
  buildDraftsFromAIResult,
  timeStringToEpoch,
  validateDrafts,
} from './magicPenDraftBuilder';
import type { MagicPenAIResult, MagicPenDraftItem } from './magicPenTypes';

const fixedNow = new Date(2026, 2, 11, 18, 0, 0, 0);

function toLocalYmd(epoch?: number): string {
  if (!epoch) return '';
  const date = new Date(epoch);
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

describe('magicPenDraftBuilder', () => {
  it('maps activity segment from AI result', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '改方案',
        sourceText: '上午改方案',
        kind: 'activity_backfill',
        confidence: 'high',
        startTime: '09:00',
        endTime: '11:00',
        timeSource: 'period',
        periodLabel: '上午',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow);
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].kind).toBe('activity_backfill');
    expect(parsed.drafts[0].activity?.timeResolution).toBe('period');
    expect(new Date(parsed.drafts[0].activity!.startAt!).getHours()).toBe(9);
    expect(new Date(parsed.drafts[0].activity!.endAt!).getHours()).toBe(11);
  });

  it('caps period end time to now for same-day backfill', () => {
    const now = new Date(2026, 2, 11, 10, 30, 0, 0);
    const input: MagicPenAIResult = {
      segments: [{
        text: '开会',
        sourceText: '上午开会了',
        kind: 'activity_backfill',
        confidence: 'high',
        timeRelation: 'past',
        timeSource: 'period',
        periodLabel: '上午',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, now, 'zh');
    const draft = parsed.drafts[0];
    expect(new Date(draft.activity!.startAt!).getHours()).toBe(9);
    expect(new Date(draft.activity!.endAt!).getHours()).toBe(10);
    expect(new Date(draft.activity!.endAt!).getMinutes()).toBe(30);
  });

  it('uses explicit duration in period segment to anchor near now', () => {
    const now = new Date(2026, 2, 11, 10, 30, 0, 0);
    const input: MagicPenAIResult = {
      segments: [{
        text: '开会',
        sourceText: '上午开会半小时',
        kind: 'activity_backfill',
        confidence: 'high',
        timeRelation: 'past',
        timeSource: 'period',
        periodLabel: '上午',
        durationMinutes: 30,
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, now, 'zh');
    const draft = parsed.drafts[0];
    expect(new Date(draft.activity!.startAt!).getHours()).toBe(10);
    expect(new Date(draft.activity!.startAt!).getMinutes()).toBe(0);
    expect(new Date(draft.activity!.endAt!).getHours()).toBe(10);
    expect(new Date(draft.activity!.endAt!).getMinutes()).toBe(30);
  });

  it('infers zh duration when period segment omits durationMinutes', () => {
    const now = new Date(2026, 2, 11, 10, 30, 0, 0);
    const input: MagicPenAIResult = {
      segments: [{
        text: '开会',
        sourceText: '上午开会半小时',
        kind: 'activity_backfill',
        confidence: 'high',
        timeRelation: 'past',
        timeSource: 'period',
        periodLabel: '上午',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, now, 'zh');
    const draft = parsed.drafts[0];
    expect(new Date(draft.activity!.startAt!).getHours()).toBe(10);
    expect(new Date(draft.activity!.startAt!).getMinutes()).toBe(0);
    expect(new Date(draft.activity!.endAt!).getHours()).toBe(10);
    expect(new Date(draft.activity!.endAt!).getMinutes()).toBe(30);
  });

  it('normalizes leading first-person token in activity backfill content', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '我学习',
        sourceText: '我上午学习了',
        kind: 'activity_backfill',
        confidence: 'high',
        startTime: '09:00',
        endTime: '11:00',
        timeSource: 'period',
        periodLabel: '上午',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow, 'zh');
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].kind).toBe('activity_backfill');
    expect(parsed.drafts[0].content).toBe('学习');
  });

  it('infers exact range from zh hyphen shorthand when ai misses one side', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '8吃早饭',
        sourceText: '8-9点吃早饭',
        kind: 'activity_backfill',
        confidence: 'high',
        endTime: '09:00',
        timeSource: 'exact',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow, 'zh');
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].content).toBe('吃早饭');
    expect(parsed.drafts[0].activity?.timeResolution).toBe('exact');
    expect(new Date(parsed.drafts[0].activity!.startAt!).getHours()).toBe(8);
    expect(new Date(parsed.drafts[0].activity!.endAt!).getHours()).toBe(9);
  });

  it('recovers action phrase from source text when ai returns time residue prefix', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '点看书',
        sourceText: '9-10点看书',
        kind: 'activity_backfill',
        confidence: 'high',
        startTime: '09:00',
        endTime: '10:00',
        timeSource: 'exact',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow, 'zh');
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].content).toBe('看书');
  });

  it('does not strip normal text without explicit time anchor', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '点兵点将',
        sourceText: '点兵点将',
        kind: 'activity_backfill',
        confidence: 'high',
        startTime: '09:00',
        endTime: '10:00',
        timeSource: 'exact',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow, 'zh');
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].content).toBe('点兵点将');
  });

  it('infers exact range from adjacent zh numeral hour phrase', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '吃早饭',
        sourceText: '八九点吃早饭',
        kind: 'activity_backfill',
        confidence: 'high',
        timeSource: 'missing',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow, 'zh');
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].activity?.timeResolution).toBe('exact');
    expect(new Date(parsed.drafts[0].activity!.startAt!).getHours()).toBe(8);
    expect(new Date(parsed.drafts[0].activity!.endAt!).getHours()).toBe(9);
  });

  it('maps todo segment from AI result with fixed defaults', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '整理发票',
        sourceText: '记得整理发票',
        kind: 'todo_add',
        confidence: 'medium',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow);
    expect(parsed.drafts[0].todo?.scope).toBe('daily');
    expect(parsed.drafts[0].todo?.priority).toBe('important-not-urgent');
    expect(parsed.drafts[0].todo?.category).toBeUndefined();
  });

  it('normalizes leading first-person token in todo content', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '我开会',
        sourceText: '我待会开会',
        kind: 'todo_add',
        confidence: 'high',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow, 'zh');
    expect(parsed.drafts[0].kind).toBe('todo_add');
    expect(parsed.drafts[0].content).toBe('开会');
  });

  it('fills same-day dueDate for immediate todo phrasing', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '跑步',
        sourceText: '待会跑步',
        kind: 'todo_add',
        confidence: 'medium',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow, 'zh');
    const dueDate = parsed.drafts[0].todo?.dueDate;
    expect(dueDate).toBeDefined();
    expect(new Date(dueDate!).toISOString().slice(0, 10)).toBe('2026-03-11');
  });

  it('fills same-day dueDate for tonight todo phrasing', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '开会',
        sourceText: '晚上还要开会',
        kind: 'todo_add',
        confidence: 'medium',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow, 'zh');
    const dueDate = parsed.drafts[0].todo?.dueDate;
    expect(dueDate).toBeDefined();
    expect(new Date(dueDate!).toISOString().slice(0, 10)).toBe('2026-03-11');
  });

  it('uses AI todo startTime to keep exact clock in dueDate', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '开组会',
        sourceText: '明天下午三点要开组会',
        kind: 'todo_add',
        confidence: 'high',
        timeRelation: 'future',
        startTime: '15:00',
        timeSource: 'exact',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow, 'zh');
    const dueDate = parsed.drafts[0].todo?.dueDate;
    expect(dueDate).toBeDefined();
    expect(toLocalYmd(dueDate)).toBe('2026-03-12');
    expect(new Date(dueDate!).getHours()).toBe(15);
    expect(new Date(dueDate!).getMinutes()).toBe(0);
  });

  it('uses period start hour for todo when AI gives period label only', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '开会',
        sourceText: '明天下午要开会',
        kind: 'todo_add',
        confidence: 'medium',
        timeRelation: 'future',
        timeSource: 'period',
        periodLabel: '下午',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow, 'zh');
    const dueDate = parsed.drafts[0].todo?.dueDate;
    expect(dueDate).toBeDefined();
    expect(toLocalYmd(dueDate)).toBe('2026-03-12');
    expect(new Date(dueDate!).getHours()).toBe(15);
    expect(new Date(dueDate!).getMinutes()).toBe(0);
  });

  it('reclassifies future-period backfill to todo when current time is earlier', () => {
    const morning = new Date(2026, 2, 11, 9, 0, 0, 0);
    const input: MagicPenAIResult = {
      segments: [{
        text: '看电影',
        sourceText: '晚上看电影',
        kind: 'activity_backfill',
        confidence: 'high',
        timeSource: 'period',
        periodLabel: '晚上',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, morning, 'zh');
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].kind).toBe('todo_add');
    expect(parsed.drafts[0].content).toBe('看电影');
    expect(parsed.drafts[0].todo?.dueDate).toBeDefined();
  });

  it('prioritizes explicit clock over period window when source has exact zh time', () => {
    const now = new Date(2026, 2, 16, 10, 52, 0, 0);
    const input: MagicPenAIResult = {
      segments: [{
        text: '八点起床',
        sourceText: '八点起床',
        kind: 'activity_backfill',
        confidence: 'high',
        timeRelation: 'past',
        timeSource: 'period',
        periodLabel: '早上',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, now, 'zh');
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].kind).toBe('activity_backfill');
    expect(parsed.drafts[0].activity?.timeResolution).toBe('exact');
    expect(new Date(parsed.drafts[0].activity!.startAt!).getHours()).toBe(8);
    expect(new Date(parsed.drafts[0].activity!.startAt!).getMinutes()).toBe(0);
  });

  it('infers exact start for zh half-hour clock expression', () => {
    const now = new Date(2026, 2, 16, 10, 52, 0, 0);
    const input: MagicPenAIResult = {
      segments: [{
        text: '九点半起床',
        sourceText: '九点半起床',
        kind: 'activity_backfill',
        confidence: 'high',
        timeRelation: 'past',
        timeSource: 'missing',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, now, 'zh');
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].activity?.timeResolution).toBe('exact');
    expect(new Date(parsed.drafts[0].activity!.startAt!).getHours()).toBe(9);
    expect(new Date(parsed.drafts[0].activity!.startAt!).getMinutes()).toBe(30);
  });

  it('keeps realtime activity with past cue out of auto-write', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '出门',
        sourceText: '十点才出门',
        kind: 'activity',
        confidence: 'high',
        timeRelation: 'realtime',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow, 'zh');
    expect(parsed.autoWriteItems).toHaveLength(0);
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].kind).toBe('activity_backfill');
    expect(parsed.drafts[0].activity?.timeResolution).toBe('exact');
    expect(new Date(parsed.drafts[0].activity!.startAt!).getHours()).toBe(10);
  });

  it('keeps todo core action for mixed mood + plan sentence', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '最近太累了有点难过但是决定从明天开始每天都跑步',
        sourceText: '最近太累了有点难过但是决定从明天开始每天都跑步',
        kind: 'todo_add',
        confidence: 'medium',
        timeRelation: 'future',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow, 'zh');
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].kind).toBe('todo_add');
    expect(parsed.drafts[0].content).toBe('每天都跑步');
  });

  it('downgrades timed activity to backfill when current activity exists in same message', () => {
    const input: MagicPenAIResult = {
      segments: [
        {
          text: '上课',
          sourceText: '我在上课',
          kind: 'activity',
          confidence: 'high',
          timeRelation: 'realtime',
        },
        {
          text: '出门上学',
          sourceText: '九点出门上学',
          kind: 'activity',
          confidence: 'high',
          timeRelation: 'realtime',
        },
      ],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow, 'zh');
    expect(parsed.autoWriteItems).toHaveLength(1);
    expect(parsed.autoWriteItems[0].content).toContain('上课');
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].kind).toBe('activity_backfill');
    expect(parsed.drafts[0].content).toBe('出门上学');
    expect(parsed.drafts[0].activity?.timeResolution).toBe('exact');
    expect(new Date(parsed.drafts[0].activity!.startAt!).getHours()).toBe(9);
  });

  it('keeps only one realtime activity when model returns multiple non-parallel ones', () => {
    const input: MagicPenAIResult = {
      segments: [
        {
          text: '上课',
          sourceText: '我在上课',
          kind: 'activity',
          confidence: 'high',
          timeRelation: 'realtime',
        },
        {
          text: '聊天',
          sourceText: '我在聊天',
          kind: 'activity',
          confidence: 'medium',
          timeRelation: 'realtime',
        },
      ],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow, 'zh');
    expect(parsed.autoWriteItems).toHaveLength(1);
    expect(parsed.autoWriteItems[0].content).toBe('上课');
  });

  it('merges explicit parallel realtime activities into one current activity', () => {
    const input: MagicPenAIResult = {
      segments: [
        {
          text: '吃饭',
          sourceText: '我在吃饭和下棋',
          kind: 'activity',
          confidence: 'high',
          timeRelation: 'realtime',
        },
        {
          text: '下棋',
          sourceText: '我在吃饭和下棋',
          kind: 'activity',
          confidence: 'high',
          timeRelation: 'realtime',
        },
      ],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow, 'zh');
    expect(parsed.autoWriteItems).toHaveLength(1);
    expect(parsed.autoWriteItems[0].content).toBe('吃饭+下棋');
  });

  it('keeps unparsed entries', () => {
    const parsed = buildDraftsFromAIResult({ segments: [], unparsed: ['今天做了很多事'] }, fixedNow);
    expect(parsed.unparsedSegments).toEqual(['今天做了很多事']);
  });

  it('keeps low-confidence mood as unparsed only', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '我有点烦',
        sourceText: '我有点烦',
        kind: 'mood',
        confidence: 'low',
        timeRelation: 'realtime',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow);
    expect(parsed.autoWriteItems).toHaveLength(0);
    expect(parsed.drafts).toHaveLength(0);
    expect(parsed.unparsedSegments).toEqual(['我有点烦']);
  });

  it('keeps low-confidence activity without time anchor as unparsed only', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '我在整理东西',
        sourceText: '我在整理东西',
        kind: 'activity',
        confidence: 'low',
        timeRelation: 'realtime',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow);
    expect(parsed.autoWriteItems).toHaveLength(0);
    expect(parsed.drafts).toHaveLength(0);
    expect(parsed.unparsedSegments).toEqual(['我在整理东西']);
  });

  it('auto-writes exactly one high-confidence realtime mood', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '我很开心',
        sourceText: '我很开心',
        kind: 'mood',
        confidence: 'high',
        timeRelation: 'realtime',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow);
    expect(parsed.autoWriteItems).toHaveLength(1);
    expect(parsed.autoWriteItems[0].kind).toBe('mood');
    expect(parsed.unparsedSegments).toHaveLength(0);
    expect(parsed.drafts).toHaveLength(0);
  });

  it('auto-writes realtime mood while keeping future todo in review', () => {
    const input: MagicPenAIResult = {
      segments: [
        {
          text: '我很开心',
          sourceText: '我很开心',
          kind: 'mood',
          confidence: 'high',
          timeRelation: 'realtime',
        },
        {
          text: '明天开会',
          sourceText: '明天开会',
          kind: 'todo_add',
          confidence: 'high',
          timeRelation: 'future',
        },
      ],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow, 'zh');
    expect(parsed.autoWriteItems).toHaveLength(1);
    expect(parsed.autoWriteItems[0].kind).toBe('mood');
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].kind).toBe('todo_add');
    expect(parsed.unparsedSegments).toHaveLength(0);
  });

  it('auto-writes medium-confidence realtime mood', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '感觉很开心',
        sourceText: '感觉很开心',
        kind: 'mood',
        confidence: 'medium',
        timeRelation: 'realtime',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow);
    expect(parsed.autoWriteItems).toHaveLength(1);
    expect(parsed.autoWriteItems[0].kind).toBe('mood');
    expect(parsed.drafts).toHaveLength(0);
    expect(parsed.unparsedSegments).toHaveLength(0);
  });

  it('auto-writes medium-confidence realtime activity without time anchor', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '我在整理桌面',
        sourceText: '我在整理桌面',
        kind: 'activity',
        confidence: 'medium',
        timeRelation: 'realtime',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow);
    expect(parsed.autoWriteItems).toHaveLength(1);
    expect(parsed.autoWriteItems[0].kind).toBe('activity');
    expect(parsed.drafts).toHaveLength(0);
    expect(parsed.unparsedSegments).toHaveLength(0);
  });

  it('splits four-kind parse result into auto-write and review groups', () => {
    const input: MagicPenAIResult = {
      segments: [
        {
          text: '吃饭',
          sourceText: '我在吃饭',
          kind: 'activity',
          confidence: 'high',
          timeRelation: 'realtime',
        },
        {
          text: '很开心',
          sourceText: '感觉很开心',
          kind: 'mood',
          confidence: 'high',
          timeRelation: 'realtime',
        },
        {
          text: '开会',
          sourceText: '明天要开会',
          kind: 'todo_add',
          confidence: 'high',
          timeRelation: 'future',
        },
        {
          text: '学习',
          sourceText: '我上午学习了',
          kind: 'activity_backfill',
          confidence: 'high',
          timeRelation: 'past',
          startTime: '09:00',
          endTime: '11:00',
          timeSource: 'period',
          periodLabel: '上午',
        },
      ],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow);
    expect(parsed.autoWriteItems).toHaveLength(2);
    expect(parsed.autoWriteItems.map((item) => item.kind)).toEqual(['activity', 'mood']);
    expect(parsed.drafts).toHaveLength(2);
    expect(parsed.drafts.map((item) => item.kind)).toEqual(['todo_add', 'activity_backfill']);
    expect(parsed.unparsedSegments).toHaveLength(0);
  });

  it('auto-writes multiple high-confidence realtime moods', () => {
    const input: MagicPenAIResult = {
      segments: [
        {
          text: '我有点累',
          sourceText: '我有点累',
          kind: 'mood',
          confidence: 'high',
          timeRelation: 'realtime',
        },
        {
          text: '但还算满足',
          sourceText: '但还算满足',
          kind: 'mood',
          confidence: 'high',
          timeRelation: 'realtime',
        },
      ],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow);
    expect(parsed.autoWriteItems).toHaveLength(2);
    expect(parsed.unparsedSegments).toHaveLength(0);
  });

  it('keeps future-triggered mood in review path', () => {
    const input: MagicPenAIResult = {
      segments: [{
        text: '想到明天开会有点烦',
        sourceText: '想到明天开会有点烦',
        kind: 'mood',
        confidence: 'high',
        timeRelation: 'future',
      }],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow);
    expect(parsed.autoWriteItems).toHaveLength(0);
    expect(parsed.unparsedSegments).toEqual(['想到明天开会有点烦']);
  });

  it('merges linked realtime activity and mood into one auto-write activity', () => {
    const input: MagicPenAIResult = {
      segments: [
        {
          text: '整理桌面',
          sourceText: '刚刚整理桌面有点烦',
          kind: 'activity',
          confidence: 'high',
          timeRelation: 'realtime',
        },
        {
          text: '有点烦',
          sourceText: '刚刚整理桌面有点烦',
          kind: 'mood',
          confidence: 'high',
          timeRelation: 'realtime',
        },
      ],
      unparsed: [],
    };
    const parsed = buildDraftsFromAIResult(input, fixedNow);
    expect(parsed.autoWriteItems).toHaveLength(1);
    expect(parsed.autoWriteItems[0].kind).toBe('activity');
    expect(parsed.autoWriteItems[0].linkedMoodContent).toBe('有点烦');
    expect(parsed.autoWriteItems[0].content).toContain('整理桌面');
    expect(parsed.autoWriteItems[0].content).toContain('有点烦');
  });

  it('converts HH:mm to local epoch', () => {
    const epoch = timeStringToEpoch('20:30', fixedNow);
    expect(new Date(epoch).getHours()).toBe(20);
    expect(new Date(epoch).getMinutes()).toBe(30);
  });

  it('flags missing_time after validation', () => {
    const drafts: MagicPenDraftItem[] = [{
      id: 'a',
      kind: 'activity_backfill',
      content: '开会',
      sourceText: '今天开会',
      confidence: 'low',
      needsUserConfirmation: true,
      errors: [],
      activity: { timeResolution: 'missing' },
    }];
    const validated = validateDrafts(drafts, [], fixedNow.getTime());
    expect(validated[0].errors).toContain('missing_time');
  });

  it('marks both overlapping activity drafts with overlap_in_batch', () => {
    const drafts: MagicPenDraftItem[] = [
      {
        id: 'left',
        kind: 'activity_backfill',
        content: '上课',
        sourceText: '9点上课',
        confidence: 'high',
        needsUserConfirmation: false,
        errors: [],
        activity: {
          startAt: new Date(2026, 2, 11, 9, 0, 0, 0).getTime(),
          endAt: new Date(2026, 2, 11, 10, 0, 0, 0).getTime(),
          timeResolution: 'exact',
        },
      },
      {
        id: 'right',
        kind: 'activity_backfill',
        content: '开会',
        sourceText: '9点半开会',
        confidence: 'high',
        needsUserConfirmation: false,
        errors: [],
        activity: {
          startAt: new Date(2026, 2, 11, 9, 30, 0, 0).getTime(),
          endAt: new Date(2026, 2, 11, 10, 30, 0, 0).getTime(),
          timeResolution: 'exact',
        },
      },
    ];

    const validated = validateDrafts(drafts, [], fixedNow.getTime());
    expect(validated[0].errors).toContain('overlap_in_batch');
    expect(validated[1].errors).toContain('overlap_in_batch');
  });

  it('aligns period drafts into largest local gap before now', () => {
    const now = new Date(2026, 2, 11, 10, 30, 0, 0).getTime();
    const drafts: MagicPenDraftItem[] = [{
      id: 'period-1',
      kind: 'activity_backfill',
      content: '开会',
      sourceText: '上午开会半小时',
      confidence: 'high',
      needsUserConfirmation: true,
      errors: [],
      activity: {
        startAt: new Date(2026, 2, 11, 9, 0, 0, 0).getTime(),
        endAt: new Date(2026, 2, 11, 10, 30, 0, 0).getTime(),
        timeResolution: 'period',
        suggestedTimeLabel: '上午',
      },
    }];

    const messages = [
      {
        id: 'm1',
        content: '深度工作',
        timestamp: new Date(2026, 2, 11, 9, 0, 0, 0).getTime(),
        duration: 60,
        type: 'text' as const,
        mode: 'record' as const,
        isMood: false,
      },
    ];

    const aligned = alignPeriodDraftsToMessageGaps(drafts, messages, now);
    expect(new Date(aligned[0].activity!.startAt!).getHours()).toBe(10);
    expect(new Date(aligned[0].activity!.startAt!).getMinutes()).toBe(0);
    expect(new Date(aligned[0].activity!.endAt!).getHours()).toBe(10);
    expect(new Date(aligned[0].activity!.endAt!).getMinutes()).toBe(30);
  });

  it('allocates period drafts without reusing same gap', () => {
    const now = new Date(2026, 2, 11, 10, 30, 0, 0).getTime();
    const drafts: MagicPenDraftItem[] = [
      {
        id: 'period-a',
        kind: 'activity_backfill',
        content: '开会A',
        sourceText: '上午开会半小时',
        confidence: 'high',
        needsUserConfirmation: true,
        errors: [],
        activity: {
          startAt: new Date(2026, 2, 11, 9, 0, 0, 0).getTime(),
          endAt: new Date(2026, 2, 11, 10, 30, 0, 0).getTime(),
          timeResolution: 'period',
          suggestedTimeLabel: '上午',
        },
      },
      {
        id: 'period-b',
        kind: 'activity_backfill',
        content: '开会B',
        sourceText: '上午开会半小时',
        confidence: 'high',
        needsUserConfirmation: true,
        errors: [],
        activity: {
          startAt: new Date(2026, 2, 11, 9, 0, 0, 0).getTime(),
          endAt: new Date(2026, 2, 11, 10, 30, 0, 0).getTime(),
          timeResolution: 'period',
          suggestedTimeLabel: '上午',
        },
      },
    ];

    const aligned = alignPeriodDraftsToMessageGaps(drafts, [], now);
    expect(aligned[0].activity?.endAt).toBe(new Date(2026, 2, 11, 10, 30, 0, 0).getTime());
    expect(aligned[1].activity?.endAt).toBe(new Date(2026, 2, 11, 10, 0, 0, 0).getTime());
    expect(aligned[1].activity?.startAt).toBe(new Date(2026, 2, 11, 9, 30, 0, 0).getTime());
  });
});
