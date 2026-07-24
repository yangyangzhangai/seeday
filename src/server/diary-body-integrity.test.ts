// DOC-DEPS: LLM.md -> api/README.md -> src/server/diary-body-integrity.ts
import { describe, expect, it } from 'vitest';
import { hasCompleteDiaryEnding, shouldRetryDiaryDraft } from './diary-body-integrity';

describe('diary body integrity', () => {
  it('accepts a complete Chinese diary before its signoff', () => {
    const content = '今天走得不快，但每一步都算数。\n\n——你的时间观察者 Zep';

    expect(hasCompleteDiaryEnding(content, 'zh')).toBe(true);
    expect(shouldRetryDiaryDraft(content, 'stop', 'zh')).toBe(false);
  });

  it('rejects a Chinese diary cut in the middle of its final sentence', () => {
    const content = '今天真正要说的那句话是：即便你觉得自己没做到\n\n——你的时间观察者 Zep';

    expect(hasCompleteDiaryEnding(content, 'zh')).toBe(false);
    expect(shouldRetryDiaryDraft(content, 'stop', 'zh')).toBe(true);
  });

  it('accepts complete English and Italian endings with closing punctuation', () => {
    expect(hasCompleteDiaryEnding('You made room for yourself today.”\n\n- Your Van', 'en')).toBe(true);
    expect(hasCompleteDiaryEnding('Oggi hai rispettato il tuo ritmo.\n\n- La tua Agnes', 'it')).toBe(true);
  });

  it('retries any draft stopped by the token limit', () => {
    expect(shouldRetryDiaryDraft('This sentence is complete.', 'length', 'en')).toBe(true);
  });

  it('keeps a complete Chinese body beyond the former 260-character limit', () => {
    const longBody = `${'今天认真记录了生活里的细节，'.repeat(24)}也把最后一句完整写完。`;

    expect(Array.from(longBody).length).toBeGreaterThan(260);
    expect(shouldRetryDiaryDraft(longBody, 'stop', 'zh')).toBe(false);
  });
});
