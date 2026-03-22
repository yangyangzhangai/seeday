import { describe, expect, it } from 'vitest';
import { toPlantCategoryKey } from './plantActivityMapper';

describe('toPlantCategoryKey', () => {
  it('maps unified activityType directly', () => {
    expect(toPlantCategoryKey('study', '刷视频')).toBe('work_study');
    expect(toPlantCategoryKey('health', '看电影')).toBe('exercise');
  });

  it('keeps legacy data compatible through normalization', () => {
    expect(toPlantCategoryKey('待分类', '跑步')).toBe('exercise');
    expect(toPlantCategoryKey('work_study', '复习数学')).toBe('work_study');
  });
});
