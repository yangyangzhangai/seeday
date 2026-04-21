import { describe, expect, it } from 'vitest';
import { sampleAssociation, type LateralAssociationState } from './lateral-association-sampler';

describe('lateral-association-sampler', () => {
  it('keeps momo self_led origin close to 25% over large samples', () => {
    let seed = 123456789;
    const rng = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    let state: LateralAssociationState = {
      lastAssociationType: null,
      lastToneTagHistory: [],
      dailyTriggered: [],
      dailyDate: '2026-04-09',
    };

    const total = 20000;
    let selfLedCount = 0;

    for (let i = 0; i < total; i += 1) {
      const result = sampleAssociation({
        characterId: 'momo',
        userInput: '记录：今天吃饭然后工作',
        lang: 'zh',
        currentDate: '2026-04-09',
        state,
        rng,
      });
      if (result.originType === 'self_led') {
        selfLedCount += 1;
      }
      state = result.nextState;
    }

    const ratio = selfLedCount / total;
    expect(ratio).toBeGreaterThan(0.22);
    expect(ratio).toBeLessThan(0.28);
  });

  it('avoids repeating the immediate previous association type', () => {
    const result = sampleAssociation({
      characterId: 'van',
      userInput: '今天就是上课和工作',
      lang: 'zh',
      currentDate: '2026-04-09',
      state: {
        lastAssociationType: 'user_emotion',
        lastToneTagHistory: [],
        dailyTriggered: [],
        dailyDate: '2026-04-09',
      },
      rng: () => 0,
    });

    expect(result.associationType).not.toBe('user_emotion');
  });

  it('respects daily limit by zeroing already triggered limited type', () => {
    const result = sampleAssociation({
      characterId: 'agnes',
      userInput: '今天工作有点累',
      lang: 'zh',
      currentDate: '2026-04-09',
      state: {
        lastAssociationType: null,
        lastToneTagHistory: [],
        dailyTriggered: ['species_sense'],
        dailyDate: '2026-04-09',
      },
      rng: () => 0,
    });

    expect(result.associationType).not.toBe('species_sense');
  });

  it('samples tone tag with recent-history dedupe', () => {
    const result = sampleAssociation({
      characterId: 'van',
      userInput: '记录一下今天的学习',
      lang: 'zh',
      currentDate: '2026-04-09',
      state: {
        lastAssociationType: 'user_emotion',
        lastToneTagHistory: ['撒娇', '体贴', '卖萌'],
        dailyTriggered: [],
        dailyDate: '2026-04-09',
      },
      rng: () => 0.95,
    });

    expect(result.associationType).toBe('tone_only');
    expect(result.toneTag).toBe('温柔');
    expect(result.associationInstruction).toContain('温柔');
  });

  it('builds multilingual association + origin instruction', () => {
    const result = sampleAssociation({
      characterId: 'agnes',
      userInput: 'I felt anxious before the meeting',
      lang: 'en',
      currentDate: '2026-04-09',
      state: {
        lastAssociationType: 'user_body',
        lastToneTagHistory: [],
        dailyTriggered: [],
        dailyDate: '2026-04-09',
      },
      rng: () => 0,
    });

    expect(result.associationInstruction).toBeTruthy();
    if (result.originType !== 'user_first' && result.associationType !== 'tone_only') {
      expect(result.associationInstruction).toMatch(/lead with them|start with your own current state/i);
    }
  });
});
