// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md
import { describe, expect, it } from 'vitest';
import { parseMagicPenInputLocal } from './magicPenParserLocalFallback';

const morning = new Date(2026, 6, 24, 10, 30, 0, 0);

function summarize(input: string, lang: 'zh' | 'en' | 'it') {
  const result = parseMagicPenInputLocal(input, morning, lang);
  return {
    drafts: result.drafts.map((item) => ({ kind: item.kind, content: item.content })),
    autoWrites: result.autoWriteItems.map((item) => ({ kind: item.kind, content: item.content })),
    unparsed: result.unparsedSegments,
  };
}

describe('Chinese Magic Pen local fallback semantics', () => {
  it('separates current activity, mood, future todos, and a wish', () => {
    const result = summarize(
      '我现在在工作，工作得有点烦了，等会儿去吃饭，下午去游泳，希望能开心起来',
      'zh',
    );

    expect(result.autoWrites.map((item) => item.kind)).toEqual(['activity', 'mood']);
    expect(result.drafts.map((item) => item.kind)).toEqual(['todo_add', 'todo_add']);
    expect(result.drafts.map((item) => item.content)).toEqual(['去吃饭', '去游泳']);
    expect(result.unparsed).toEqual(['希望能开心起来']);
  });

  it('requires an action context before 得 becomes a todo signal', () => {
    const result = summarize('工作得有点烦了，我得去吃饭', 'zh');

    expect(result.autoWrites.map((item) => item.kind)).toEqual(['mood']);
    expect(result.drafts.map((item) => item.content)).toEqual(['去吃饭']);
  });

  it('does not turn 觉得累 into a todo', () => {
    const result = summarize('觉得有点累', 'zh');

    expect(result.drafts).toHaveLength(0);
    expect(result.autoWrites.map((item) => item.kind)).toEqual(['mood']);
  });
});

describe('English Magic Pen local fallback semantics', () => {
  it('parses a mixed English note conservatively', () => {
    const result = summarize(
      'I am working. I feel frustrated. Later I need to eat. I hope to feel better.',
      'en',
    );

    expect(result.autoWrites.map((item) => item.kind)).toEqual(['activity', 'mood']);
    expect(result.drafts.map((item) => item.kind)).toEqual(['todo_add']);
    expect(result.drafts[0].content).toBe('eat');
    expect(result.unparsed).toEqual(['I hope to feel better']);
  });

  it('keeps past activity and future todo as separate segments', () => {
    const result = summarize(
      'I finished class and later I need to buy groceries',
      'en',
    );

    expect(result.drafts.map((item) => item.kind)).toEqual([
      'activity_backfill',
      'todo_add',
    ]);
  });
});

describe('Italian Magic Pen local fallback semantics', () => {
  it('parses a mixed Italian note conservatively', () => {
    const result = summarize(
      'Sto lavorando. Mi sento stressata. Più tardi devo mangiare. Spero di sentirmi meglio.',
      'it',
    );

    expect(result.autoWrites.map((item) => item.kind)).toEqual(['activity', 'mood']);
    expect(result.drafts.map((item) => item.kind)).toEqual(['todo_add']);
    expect(result.drafts[0].content).toBe('mangiare');
    expect(result.unparsed).toEqual(['Spero di sentirmi meglio']);
  });

  it('keeps past activity and future todo as separate segments', () => {
    const result = summarize(
      'Ho finito la riunione e poi devo comprare il pane',
      'it',
    );

    expect(result.drafts.map((item) => item.kind)).toEqual([
      'activity_backfill',
      'todo_add',
    ]);
  });
});
