import { describe, expect, it } from 'vitest';
import {
  ZH_ACTIVITY_ONGOING_PATTERNS,
  ZH_FUTURE_OR_PLAN_PATTERNS,
  ZH_NEGATED_OR_NOT_OCCURRED_PATTERNS,
  ZH_PLACE_NOUNS,
  ZH_STRONG_COMPLETION_PATTERNS,
  ZH_MOOD_PATTERNS,
} from './liveInputRules.zh';
import {
  EN_ACTIVITY_PATTERNS,
  EN_FUTURE_OR_PLAN_PATTERNS,
  EN_MOOD_PATTERNS,
  EN_STRONG_COMPLETION_PATTERNS,
} from './liveInputRules.en';
import {
  IT_ACTIVITY_PATTERNS,
  IT_FUTURE_OR_PLAN_PATTERNS,
  IT_MOOD_PATTERNS,
  IT_STRONG_COMPLETION_PATTERNS,
} from './liveInputRules.it';

function matchesAny(input: string, rules: RegExp[]): boolean {
  return rules.some((rule) => rule.test(input));
}

describe('liveInputRules pattern smoke regression', () => {
  const zhCases: Array<{ input: string; shouldMatch: boolean; rules: RegExp[] }> = [
    { input: '正在写报告', shouldMatch: true, rules: ZH_ACTIVITY_ONGOING_PATTERNS },
    { input: '开会中', shouldMatch: true, rules: ZH_ACTIVITY_ONGOING_PATTERNS },
    { input: '刚写完报告了', shouldMatch: true, rules: ZH_STRONG_COMPLETION_PATTERNS },
    { input: '已经做完了', shouldMatch: true, rules: ZH_STRONG_COMPLETION_PATTERNS },
    { input: '好累', shouldMatch: true, rules: ZH_MOOD_PATTERNS },
    { input: '真烦', shouldMatch: true, rules: ZH_MOOD_PATTERNS },
    { input: '明天要去开会', shouldMatch: true, rules: ZH_FUTURE_OR_PLAN_PATTERNS },
    { input: '待会去公园', shouldMatch: true, rules: ZH_FUTURE_OR_PLAN_PATTERNS },
    { input: '不想运动', shouldMatch: true, rules: ZH_NEGATED_OR_NOT_OCCURRED_PATTERNS },
    { input: '想去公园但没去', shouldMatch: true, rules: ZH_NEGATED_OR_NOT_OCCURRED_PATTERNS },
    { input: '今天没有产出', shouldMatch: true, rules: ZH_NEGATED_OR_NOT_OCCURRED_PATTERNS },
    { input: '没产出', shouldMatch: true, rules: ZH_NEGATED_OR_NOT_OCCURRED_PATTERNS },
  ];

  const enCases: Array<{ input: string; shouldMatch: boolean; rules: RegExp[] }> = [
    { input: 'I am working', shouldMatch: true, rules: EN_ACTIVITY_PATTERNS },
    { input: 'working right now', shouldMatch: true, rules: EN_ACTIVITY_PATTERNS },
    { input: 'just had a meeting', shouldMatch: true, rules: EN_ACTIVITY_PATTERNS },
    { input: 'Just finished the report', shouldMatch: true, rules: EN_STRONG_COMPLETION_PATTERNS },
    { input: 'I got done with the task', shouldMatch: true, rules: EN_STRONG_COMPLETION_PATTERNS },
    { input: 'I feel exhausted', shouldMatch: true, rules: EN_MOOD_PATTERNS },
    { input: 'that was stressful', shouldMatch: true, rules: EN_MOOD_PATTERNS },
    { input: 'later I will go to the gym', shouldMatch: true, rules: EN_FUTURE_OR_PLAN_PATTERNS },
  ];

  const itCases: Array<{ input: string; shouldMatch: boolean; rules: RegExp[] }> = [
    { input: 'sto studiando', shouldMatch: true, rules: IT_ACTIVITY_PATTERNS },
    { input: 'ho appena fatto la riunione', shouldMatch: true, rules: IT_ACTIVITY_PATTERNS },
    { input: 'in ufficio', shouldMatch: true, rules: IT_ACTIVITY_PATTERNS },
    { input: 'ho finito', shouldMatch: true, rules: IT_STRONG_COMPLETION_PATTERNS },
    { input: 'ho terminato la sessione', shouldMatch: true, rules: IT_STRONG_COMPLETION_PATTERNS },
    { input: 'sono esausto', shouldMatch: true, rules: IT_MOOD_PATTERNS },
    { input: 'era stressante', shouldMatch: true, rules: IT_MOOD_PATTERNS },
    { input: 'stasera ho intenzione di andare in palestra', shouldMatch: true, rules: IT_FUTURE_OR_PLAN_PATTERNS },
  ];

  for (const [index, testCase] of [...zhCases, ...enCases, ...itCases].entries()) {
    it(`matches expected rule set case #${index + 1}: ${testCase.input}`, () => {
      expect(matchesAny(testCase.input, testCase.rules)).toBe(testCase.shouldMatch);
    });
  }

  it('contains high-frequency place nouns for go+place detector', () => {
    expect(ZH_PLACE_NOUNS).toEqual(
      expect.arrayContaining(['公园', '博物馆', '超市', '图书馆', '医院']),
    );
  });
});
