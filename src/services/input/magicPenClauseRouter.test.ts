import { describe, expect, it } from 'vitest';
import { routeMagicPenClauses } from './magicPenClauseRouter';

describe('routeMagicPenClauses', () => {
  it('routes todo signal clause to magic', () => {
    const result = routeMagicPenClauses('明天记得交材料', { lang: 'zh' });
    expect(result.magicClauses).toEqual(['明天记得交材料']);
    expect(result.realtimeClauses).toEqual([]);
    expect(result.uncertainClauses).toEqual([]);
  });

  it('routes backfill signal clause to magic', () => {
    const result = routeMagicPenClauses('上午和老朋友见面了', { lang: 'zh' });
    expect(result.magicClauses).toEqual(['上午和老朋友见面了']);
  });

  it('routes realtime activity with now signal to realtime', () => {
    const result = routeMagicPenClauses('我现在在下棋', { lang: 'zh' });
    expect(result.realtimeClauses).toEqual(['我现在在下棋']);
  });

  it('routes zh implicit ongoing subject activity to realtime', () => {
    const result = routeMagicPenClauses('我在吃饭', { lang: 'zh' });
    expect(result.realtimeClauses).toEqual(['我在吃饭']);
  });

  it('routes realtime mood with medium-high confidence to realtime', () => {
    const result = routeMagicPenClauses('我好累', { lang: 'zh' });
    expect(result.realtimeClauses).toEqual(['我好累']);
  });

  it('routes uncertain activity without now signal to uncertain', () => {
    const result = routeMagicPenClauses('去公园', { lang: 'zh' });
    expect(result.uncertainClauses).toEqual(['去公园']);
  });

  it('supports mixed long sentence dual routing in one send', () => {
    const input = '我现在在下棋，我心情很难过，上午和老朋友见面了，明天还要再和其他人开会讨论方案，我好累';
    const result = routeMagicPenClauses(input, { lang: 'zh' });

    expect(result.realtimeClauses).toEqual(['我现在在下棋', '我心情很难过', '我好累']);
    expect(result.magicClauses).toEqual(['上午和老朋友见面了', '明天还要再和其他人开会讨论方案']);
    expect(result.uncertainClauses).toEqual([]);
  });

  it('routes unsupported language to uncertain for safety bias', () => {
    const result = routeMagicPenClauses('Right now I am coding', { lang: 'fr' });
    expect(result.realtimeClauses).toEqual([]);
    expect(result.magicClauses).toEqual([]);
    expect(result.uncertainClauses).toEqual(['Right now I am coding']);
  });

  it('routes english todo signal to magic', () => {
    const result = routeMagicPenClauses('tomorrow remember to submit the report', { lang: 'en' });
    expect(result.magicClauses).toEqual(['tomorrow remember to submit the report']);
  });

  it('routes english realtime mood to realtime', () => {
    const result = routeMagicPenClauses('I feel very tired right now', { lang: 'en' });
    expect(result.realtimeClauses).toEqual(['I feel very tired right now']);
  });

  it('routes italian todo signal to magic', () => {
    const result = routeMagicPenClauses('domani ricordami di chiamare mamma', { lang: 'it' });
    expect(result.magicClauses).toEqual(['domani ricordami di chiamare mamma']);
  });

  it('routes italian realtime activity to realtime', () => {
    const result = routeMagicPenClauses('adesso sto studiando', { lang: 'it' });
    expect(result.realtimeClauses).toEqual(['adesso sto studiando']);
  });

  it('keeps channels mutually exclusive', () => {
    const input = '我现在在学习，明天记得复盘，随便聊聊';
    const result = routeMagicPenClauses(input, { lang: 'zh' });
    const all = [...result.realtimeClauses, ...result.magicClauses, ...result.uncertainClauses];
    const uniqueCount = new Set(all).size;

    expect(uniqueCount).toBe(all.length);
    expect(all.length).toBe(3);
  });

  it('splits connector-only sentence and routes each clause independently', () => {
    const input = '我现在在学习然后明天记得交作业';
    const result = routeMagicPenClauses(input, { lang: 'zh' });

    expect(result.realtimeClauses).toEqual(['我现在在学习']);
    expect(result.magicClauses).toEqual(['明天记得交作业']);
  });

  it('splits mixed realtime and backfill clauses joined by 和', () => {
    const input = '我在吃饭和早上逃课去逛街';
    const result = routeMagicPenClauses(input, { lang: 'zh' });

    expect(result.realtimeClauses).toEqual(['我在吃饭']);
    expect(result.magicClauses).toEqual(['早上逃课去逛街']);
    expect(result.uncertainClauses).toEqual([]);
  });

  it('splits multiple magic clauses joined by 和 when tail starts with another time signal', () => {
    const input = '早上逃课去逛街和下午看电影';
    const result = routeMagicPenClauses(input, { lang: 'zh' });

    expect(result.magicClauses).toEqual(['早上逃课去逛街', '下午看电影']);
  });
});
