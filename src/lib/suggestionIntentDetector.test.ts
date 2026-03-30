import { describe, expect, it } from 'vitest';
import { isExplicitSuggestionRequest, scoreExplicitSuggestionRequest } from './suggestionIntentDetector';

describe('suggestionIntentDetector', () => {
  it('recognizes explicit suggestion requests in Chinese', () => {
    expect(isExplicitSuggestionRequest('可以，帮我规划一下今天接下来做什么')).toBe(true);
    expect(isExplicitSuggestionRequest('帮我选择一个更好的下一步')).toBe(true);
    expect(isExplicitSuggestionRequest('我现在很乱，该怎么办？')).toBe(true);
  });

  it('does not over-trigger on plain records', () => {
    expect(isExplicitSuggestionRequest('我今天写了两个小时代码')).toBe(false);
    expect(isExplicitSuggestionRequest('刚刚去吃饭了')).toBe(false);
  });

  it('returns positive score for direct ask', () => {
    expect(scoreExplicitSuggestionRequest('给我一个具体建议，下一步做什么？')).toBeGreaterThanOrEqual(3);
  });

  it('recognizes natural variants of direct asks', () => {
    expect(isExplicitSuggestionRequest('能不能给点建议，我卡住了')).toBe(true);
    expect(isExplicitSuggestionRequest('我该先写文档还是先写代码？')).toBe(true);
    expect(isExplicitSuggestionRequest('请直接告诉我下一步')).toBe(true);
    expect(isExplicitSuggestionRequest('接下来我应该先做哪个')).toBe(true);
  });

  it('stays conservative on records and declarative sentences', () => {
    expect(isExplicitSuggestionRequest('下一步是把这个 bug 修掉')).toBe(false);
    expect(isExplicitSuggestionRequest('我建议你早点休息')).toBe(false);
    expect(isExplicitSuggestionRequest('今天收到很多建议，我先记下来')).toBe(false);
  });

  it('returns false for non-Chinese inputs', () => {
    expect(isExplicitSuggestionRequest('Can you suggest what to do next?')).toBe(false);
    expect(scoreExplicitSuggestionRequest('Help me plan my next step')).toBe(0);
  });

  it('handles punctuation and whitespace noise', () => {
    expect(isExplicitSuggestionRequest('  帮我   规划  一下  下一步  ')).toBe(true);
    expect(isExplicitSuggestionRequest('我该怎么办')).toBe(true);
    expect(isExplicitSuggestionRequest('我该怎么办？？？')).toBe(true);
  });
});
