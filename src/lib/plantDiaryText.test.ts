import { describe, expect, it } from 'vitest';
import { compactPlantDiaryText, isPlantDiaryTextWithinCardLimit } from './plantDiaryText';

describe('plantDiaryText', () => {
  it('keeps short card copy unchanged', () => {
    const text = '叶片轻轻舒展，像你今天稳稳走过的每一步。';
    expect(compactPlantDiaryText(text, 'zh')).toBe(text);
  });

  it('uses the first complete sentence for historical long copy', () => {
    const text = '今天的叶片迎着光舒展开来。你走过了很长的一段路，也给自己留下了足够温柔的停顿，晚风经过时还带来了新的方向。';
    expect(compactPlantDiaryText(text, 'zh')).toBe('今天的叶片迎着光舒展开来。');
  });

  it('caps latin copy to the card word and character budget', () => {
    const text = Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ');
    const compacted = compactPlantDiaryText(text, 'en');
    expect(isPlantDiaryTextWithinCardLimit(compacted, 'en')).toBe(true);
    expect(compacted.endsWith('.')).toBe(true);
  });

  it('uses latin punctuation when historical copy differs from the UI language', () => {
    const text = Array.from({ length: 30 }, (_, index) => `word${index}`).join(' ');
    const compacted = compactPlantDiaryText(text, 'zh');
    expect(compacted.endsWith('.')).toBe(true);
    expect(compacted.endsWith('。')).toBe(false);
  });
});
