// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import { describe, expect, it } from 'vitest';
import { compactDiaryInsight, isLegacyTruncatedDiaryInsight } from './diaryInsightText';

describe('diary insight text', () => {
  it('keeps English output on complete word boundaries', () => {
    const result = compactDiaryInsight(
      'You are finding a slower rhythm while still making thoughtful progress today',
      'en',
    );

    expect(result).toBe('You are finding a slower rhythm while still.');
    expect(result.split(/\s+/u)).toHaveLength(8);
  });

  it('keeps Italian output on complete word boundaries', () => {
    const result = compactDiaryInsight(
      'Hai mantenuto un ritmo tranquillo e costante durante tutta la giornata',
      'it',
    );

    expect(result).toBe('Hai mantenuto un ritmo tranquillo e costante durante.');
  });

  it('uses a nearby Chinese clause boundary before the hard safety limit', () => {
    const result = compactDiaryInsight('今天完成得很稳，接下来只要保持自己的节奏继续前进', 'zh');

    expect(result).toBe('今天完成得很稳，接下来只要保持自己的节奏。');
    expect(Array.from(result).length).toBeLessThanOrEqual(21);
  });

  it('recognizes the old twenty-character hard cut', () => {
    expect(isLegacyTruncatedDiaryInsight("You're in the slow I")).toBe(true);
    expect(isLegacyTruncatedDiaryInsight('Nice rhythm, keep going.')).toBe(false);
  });
});
