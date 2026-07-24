import { describe, expect, it } from 'vitest';
import { assessMagicPenResult } from './magic-pen-quality';

describe('assessMagicPenResult', () => {
  it('rejects an empty but valid JSON result', () => {
    const result = assessMagicPenResult('I need to submit the report tomorrow', {
      segments: [],
      unparsed: [],
    });

    expect(result).toMatchObject({
      ok: false,
      failure: 'empty_result',
    });
  });

  it('rejects a result that leaves the whole input unrecognized', () => {
    const rawText = '今天上午开会，然后去超市，晚上还要整理发票';
    const result = assessMagicPenResult(rawText, {
      segments: [],
      unparsed: [rawText],
    });

    expect(result).toMatchObject({
      ok: false,
      failure: 'no_recognized_segments',
    });
  });

  it('rejects a complex result that recognizes only a small opening fragment', () => {
    const result = assessMagicPenResult(
      'I woke up at 8, had breakfast, went to class, and need to finish my report tonight',
      {
        segments: [{
          text: 'wake up',
          sourceText: 'I woke up at 8',
        }],
        unparsed: [],
      },
    );

    expect(result.ok).toBe(false);
    expect([
      'low_total_coverage',
      'low_recognized_coverage',
      'undersplit_complex_input',
    ]).toContain(result.failure);
  });

  it('rejects a result that omits an explicit time anchor', () => {
    const result = assessMagicPenResult(
      '九点起床，吃了早饭，十一点去上课',
      {
        segments: [
          { text: '起床', sourceText: '九点起床' },
          { text: '吃早饭', sourceText: '吃了早饭' },
        ],
        unparsed: ['十一点去上课'],
      },
    );

    expect(result).toMatchObject({
      ok: false,
      failure: 'missing_time_anchor',
    });
  });

  it('accepts complete English mixed-intent extraction', () => {
    const result = assessMagicPenResult(
      'I am coding, and later I need to buy groceries',
      {
        segments: [
          { text: 'code', sourceText: 'I am coding' },
          { text: 'buy groceries', sourceText: 'later I need to buy groceries' },
        ],
        unparsed: [],
      },
    );

    expect(result.ok).toBe(true);
  });

  it('accepts complete Chinese multi-event extraction', () => {
    const result = assessMagicPenResult(
      '九点起床，吃了早饭，十一点去上课',
      {
        segments: [
          { text: '起床', sourceText: '九点起床' },
          { text: '吃早饭', sourceText: '吃了早饭' },
          { text: '去上课', sourceText: '十一点去上课' },
        ],
        unparsed: [],
      },
    );

    expect(result.ok).toBe(true);
  });
});
