import { describe, expect, it } from 'vitest';
import { matchBottleIdByKeywords } from './bottleMatcher';

describe('bottleMatcher', () => {
  it('matches Chinese bottle names using semantic-like CJK ngram overlap', () => {
    const bottles = [
      { id: 'run', name: '跑步打卡' },
      { id: 'read', name: '读书成长' },
    ];
    expect(matchBottleIdByKeywords('今天晚上跑步了30分钟', bottles)).toBe('run');
  });

  it('does not falsely match latin substring inside another word', () => {
    const bottles = [
      { id: 'run', name: 'run' },
      { id: 'social', name: 'friends' },
    ];
    expect(matchBottleIdByKeywords('I had brunch with friends', bottles)).toBe('social');
  });

  it('supports Italian tokens with diacritics-insensitive normalization', () => {
    const bottles = [
      { id: 'gym', name: 'allenamento' },
      { id: 'study', name: 'studio' },
    ];
    expect(matchBottleIdByKeywords('Oggi ho fatto Allenamento intenso', bottles)).toBe('gym');
  });

  it('returns stable result regardless of bottle order', () => {
    const input = '今天晚上读书一小时，准备考试';
    const listA = [
      { id: 'read', name: '读书打卡' },
      { id: 'sleep', name: '早睡计划' },
    ];
    const listB = [...listA].reverse();
    expect(matchBottleIdByKeywords(input, listA)).toBe('read');
    expect(matchBottleIdByKeywords(input, listB)).toBe('read');
  });

  it('returns null when top candidates are too close', () => {
    const bottles = [
      { id: 'walk', name: 'daily walk' },
      { id: 'run', name: 'daily run' },
    ];
    expect(matchBottleIdByKeywords('daily movement', bottles)).toBeNull();
  });
});
