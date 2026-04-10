import { describe, expect, it } from 'vitest';
import { detectNarrativeEventKey, evaluateNarrativeDensity } from './narrative-density-scorer.js';

describe('narrative-density-scorer', () => {
  it('maps common routine events to stable keys', () => {
    expect(detectNarrativeEventKey('今天吃饭了')).toBe('eat');
    expect(detectNarrativeEventKey('去上课')).toBe('study');
  });

  it('produces lower score for short repetitive input', () => {
    const low = evaluateNarrativeDensity('吃饭', 6);
    const rich = evaluateNarrativeDensity('今天在图书馆学了两小时，然后和朋友聊了很久，感觉很开心！', 0);
    expect(low.currentScore).toBeLessThan(rich.currentScore);
  });
});
