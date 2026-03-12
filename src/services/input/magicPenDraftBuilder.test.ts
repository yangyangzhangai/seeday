import { describe, expect, it } from 'vitest';
import { buildDraftsFromAIResult, timeStringToEpoch, validateDrafts } from './magicPenDraftBuilder';
import type { MagicPenAIResult, MagicPenDraftItem } from './magicPenTypes';

const fixedNow = new Date(2026, 2, 11, 18, 0, 0, 0);

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
    expect(parsed.drafts[0].todo?.category).toBe('life');
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

  it('keeps unparsed entries', () => {
    const parsed = buildDraftsFromAIResult({ segments: [], unparsed: ['今天做了很多事'] }, fixedNow);
    expect(parsed.unparsedSegments).toEqual(['今天做了很多事']);
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
});
