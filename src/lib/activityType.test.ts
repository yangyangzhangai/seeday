import { describe, expect, it } from 'vitest';
import {
  classifyRecordActivityType,
  mapClassifierCategoryToActivityType,
  normalizeActivityType,
  normalizeTodoCategory,
} from './activityType';

describe('activityType', () => {
  it('classifies record content to target six categories', () => {
    expect(classifyRecordActivityType('复习数学').activityType).toBe('study');
    expect(classifyRecordActivityType('开会同步需求').activityType).toBe('work');
    expect(classifyRecordActivityType('跑步30分钟').activityType).toBe('health');
    expect(classifyRecordActivityType('和朋友约饭').activityType).toBe('social');
  });

  it('normalizes legacy activity types with content fallback', () => {
    expect(normalizeActivityType('待分类', '跑步')).toBe('health');
    expect(normalizeActivityType('work_study', '学习英语')).toBe('study');
    expect(normalizeActivityType('work_study', '需求评审')).toBe('work');
  });

  it('maps classifier categories to unified activity types', () => {
    expect(mapClassifierCategoryToActivityType('body', '运动')).toBe('health');
    expect(mapClassifierCategoryToActivityType('deep_focus', '背单词')).toBe('study');
    expect(mapClassifierCategoryToActivityType('deep_focus', '写周报')).toBe('work');
  });

  it('normalizes todo category to six categories', () => {
    expect(normalizeTodoCategory(undefined, '打游戏')).toBe('entertainment');
    expect(normalizeTodoCategory('study', '任意文本')).toBe('study');
  });
});
