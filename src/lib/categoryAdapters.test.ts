import { describe, expect, it } from 'vitest';
import { mapDiaryClassifierCategoryToActivityType } from './categoryAdapters';

describe('categoryAdapters', () => {
  it('maps known classifier categories to app record categories', () => {
    expect(mapDiaryClassifierCategoryToActivityType('body', 'go for a run', 'en')).toBe('health');
    expect(mapDiaryClassifierCategoryToActivityType('social_duty', 'call my team', 'en')).toBe('social');
    expect(mapDiaryClassifierCategoryToActivityType('necessary', 'do laundry', 'en')).toBe('life');
  });

  it('splits deep_focus into study or work based on localized content', () => {
    expect(mapDiaryClassifierCategoryToActivityType('deep_focus', '背单词', 'zh')).toBe('study');
    expect(mapDiaryClassifierCategoryToActivityType('deep_focus', 'debug production issue', 'en')).toBe('work');
  });

  it('keeps recharge socially aware', () => {
    expect(mapDiaryClassifierCategoryToActivityType('recharge', 'hang out with friends', 'en')).toBe('social');
    expect(mapDiaryClassifierCategoryToActivityType('recharge', 'watch a movie', 'en')).toBe('entertainment');
  });

  it('falls back to lexical classification for unknown categories', () => {
    expect(mapDiaryClassifierCategoryToActivityType('unknown', '跑步30分钟', 'zh')).toBe('health');
    expect(mapDiaryClassifierCategoryToActivityType('not_in_taxonomy', 'study calculus', 'en')).toBe('study');
  });
});
