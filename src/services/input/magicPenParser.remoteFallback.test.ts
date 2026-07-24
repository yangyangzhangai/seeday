import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callMagicPenParseAPI } from '../../api/client';
import { parseMagicPenInput } from './magicPenParser';

vi.mock('../../api/client', () => ({
  callMagicPenParseAPI: vi.fn(),
}));

const mockedCallMagicPenParseAPI = vi.mocked(callMagicPenParseAPI);
const fixedNow = new Date(2026, 6, 24, 10, 30, 0, 0);

function mockRemoteFailure(rawText: string) {
  mockedCallMagicPenParseAPI.mockResolvedValue({
    success: true,
    data: { segments: [], unparsed: [rawText] },
    parseStrategy: 'fallback_failed',
    providerUsed: 'none',
  });
}

describe('parseMagicPenInput remote failure recovery', () => {
  beforeEach(() => {
    mockedCallMagicPenParseAPI.mockReset();
  });

  it('recovers the complete English input instead of a fixed failure placeholder', async () => {
    const rawText = 'I finished class and later I need to buy groceries';
    mockRemoteFailure(rawText);

    const result = await parseMagicPenInput(rawText, { now: fixedNow, lang: 'en' });

    expect(result.drafts.map((item) => item.kind)).toEqual([
      'activity_backfill',
      'todo_add',
    ]);
    expect(result.drafts.map((item) => item.sourceText).join(' ')).toContain('finished class');
    expect(result.drafts.map((item) => item.sourceText).join(' ')).toContain('buy groceries');
    expect(result.unparsedSegments.join(' ')).not.toContain('AI 解析失败');
  });

  it('uses the local Chinese parser when both remote providers fail', async () => {
    const rawText = '今天上午改方案，晚上记得整理发票';
    mockRemoteFailure(rawText);

    const result = await parseMagicPenInput(rawText, { now: fixedNow, lang: 'zh' });

    expect(result.drafts).toHaveLength(2);
    expect(result.drafts.map((draft) => draft.kind)).toEqual([
      'activity_backfill',
      'todo_add',
    ]);
  });

  it('sends text beyond the former 500-character cutoff', async () => {
    const rawText = `${'review notes '.repeat(45)}tomorrow submit the final report`;
    mockRemoteFailure(rawText);

    await parseMagicPenInput(rawText, { now: fixedNow, lang: 'en' });

    expect(rawText.length).toBeGreaterThan(500);
    expect(mockedCallMagicPenParseAPI).toHaveBeenCalledWith(
      expect.objectContaining({ rawText }),
    );
  });
});
