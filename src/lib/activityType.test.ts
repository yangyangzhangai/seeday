import { describe, expect, it } from 'vitest';
import {
  classifyRecordActivityType,
  normalizeActivityType,
  normalizeTodoCategory,
} from './activityType';

describe('activityType', () => {
  it('classifies record content to target six categories', () => {
    expect(classifyRecordActivityType('复习数学').activityType).toBe('study');
    expect(classifyRecordActivityType('读书30分钟').activityType).toBe('study');
    expect(classifyRecordActivityType('读文献').activityType).toBe('study');
    expect(classifyRecordActivityType('开会同步需求').activityType).toBe('work');
    expect(classifyRecordActivityType('跑步30分钟').activityType).toBe('health');
    expect(classifyRecordActivityType('和朋友约饭').activityType).toBe('social');
    expect(classifyRecordActivityType('逛超市买东西').activityType).toBe('life');
    expect(classifyRecordActivityType('拖地擦桌子').activityType).toBe('life');
  });

  it('normalizes legacy activity types with content fallback', () => {
    expect(normalizeActivityType('待分类', '跑步')).toBe('health');
    expect(normalizeActivityType('work_study', '学习英语')).toBe('study');
    expect(normalizeActivityType('work_study', '需求评审')).toBe('work');
  });

  it('normalizes todo category to six categories', () => {
    expect(normalizeTodoCategory(undefined, '打游戏')).toBe('entertainment');
    expect(normalizeTodoCategory('study', '任意文本')).toBe('study');
  });
  it('uses token-aware English keyword matching for category scoring', () => {
    expect(classifyRecordActivityType('Prepare lunch', 'en').activityType).toBe('life');
    expect(classifyRecordActivityType('PR review', 'en').activityType).toBe('work');
  });
});
