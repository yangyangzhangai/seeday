import { describe, expect, it } from 'vitest';
import { buildNarrativeEventInstruction } from './narrative-event-library.js';

describe('narrative-event-library', () => {
  it('keeps natural_event as concise natural sentence', () => {
    const result = buildNarrativeEventInstruction({
      characterId: 'van',
      eventType: 'natural_event',
      lang: 'zh',
      random: () => 0,
    });
    expect(result).toBeTruthy();
    expect(result?.eventId).toBe('van_n_1');
    expect(result?.instruction).toBe('今天你晒到一点暖暖的阳光，叶尖都亮了一下。');
  });

  it('builds zh character_mention as prompt instruction block', () => {
    const result = buildNarrativeEventInstruction({
      characterId: 'momo',
      eventType: 'character_mention',
      lang: 'zh',
      random: () => 0,
    });
    expect(result).toBeTruthy();
    expect(result?.eventId).toBe('momo_cm_a');
    expect(result?.instruction).toContain('[角色互提背景]');
    expect(result?.instruction).toContain('Group A');
    expect(result?.instruction).toContain('不要照抄');
  });

  it('builds en character_mention with equivalent constraints', () => {
    const result = buildNarrativeEventInstruction({
      characterId: 'van',
      eventType: 'character_mention',
      lang: 'en',
      random: () => 0.26,
    });
    expect(result).toBeTruthy();
    expect(result?.eventId).toBe('van_cm_b');
    expect(result?.instruction).toContain('[Role Mention Background]');
    expect(result?.instruction).toContain('hard cap 30 words');
    expect(result?.instruction).toContain('Group B');
  });

  it('builds it character_mention with equivalent constraints', () => {
    const result = buildNarrativeEventInstruction({
      characterId: 'agnes',
      eventType: 'character_mention',
      lang: 'it',
      random: () => 0.51,
    });
    expect(result).toBeTruthy();
    expect(result?.eventId).toBe('agnes_cm_c');
    expect(result?.instruction).toContain('[Contesto Menzione tra Ruoli]');
    expect(result?.instruction).toContain('massimo 32 parole');
    expect(result?.instruction).toContain('Group C');
  });
});
