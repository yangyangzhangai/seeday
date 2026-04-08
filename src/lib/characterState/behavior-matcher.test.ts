import { describe, expect, it } from 'vitest';
import { detectBehaviors } from './behavior-matcher';

describe('behavior-matcher', () => {
  it('matches multilingual keywords', () => {
    const zh = detectBehaviors('今天喝了红酒还有咖啡', 30).map((item) => item.behaviorId);
    const en = detectBehaviors('rainy day and I had bubble tea', 10).map((item) => item.behaviorId);
    const it = detectBehaviors('ho usato profumo forte', 5).map((item) => item.behaviorId);
    const sport = detectBehaviors('晚上打羽毛球了', 20).map((item) => item.behaviorId);

    expect(zh).toContain('B01');
    expect(zh).toContain('B09');
    expect(en).toContain('B07');
    expect(en).toContain('B10');
    expect(it).toContain('B21');
    expect(sport).toContain('B04');
  });

  it('routes tea subtype with priority', () => {
    const matched = detectBehaviors('今天喝了普洱也喝了玫瑰花茶', 20).find((item) => item.behaviorId === 'B06');
    expect(matched?.teaSubtype).toBe('herbal');
  });

  it('matches expanded tea subtype vocabulary', () => {
    const leaf = detectBehaviors('下午泡了铁观音', 10).find((item) => item.behaviorId === 'B06');
    const light = detectBehaviors('晚上喝了白毫银针', 10).find((item) => item.behaviorId === 'B06');
    const fermented = detectBehaviors('我今天喝了茯砖', 10).find((item) => item.behaviorId === 'B06');
    const herbal = detectBehaviors('睡前来一杯陈皮茶', 10).find((item) => item.behaviorId === 'B06');

    expect(leaf?.teaSubtype).toBe('leaf');
    expect(light?.teaSubtype).toBe('light');
    expect(fermented?.teaSubtype).toBe('fermented');
    expect(herbal?.teaSubtype).toBe('herbal');
  });

  it('covers expanded scenario keywords', () => {
    const alcohol = detectBehaviors('昨天有点宿醉', 15).map((item) => item.behaviorId);
    const smoke = detectBehaviors('最近总在vaping', 15).map((item) => item.behaviorId);
    const late = detectBehaviors('last night was an all nighter', 15).map((item) => item.behaviorId);
    const greasy = detectBehaviors('中午吃了炸鸡和薯条', 15).map((item) => item.behaviorId);
    const coffee = detectBehaviors('早上喝了cold brew', 15).map((item) => item.behaviorId);
    const bath = detectBehaviors('睡前洗了个热水澡', 15).map((item) => item.behaviorId);
    const ferment = detectBehaviors('晚餐配了kimchi和kefir', 15).map((item) => item.behaviorId);
    const dry = detectBehaviors('办公室heating太强空气很干', 15).map((item) => item.behaviorId);

    expect(alcohol).toContain('B01');
    expect(smoke).toContain('B02');
    expect(late).toContain('B03');
    expect(greasy).toContain('B08');
    expect(coffee).toContain('B09');
    expect(bath).toContain('B11');
    expect(ferment).toContain('B19');
    expect(dry).toContain('B20');
  });

  it('uses duration threshold for B05', () => {
    const miss = detectBehaviors('上课很久', 119).map((item) => item.behaviorId);
    const hit = detectBehaviors('上课很久', 120).map((item) => item.behaviorId);
    expect(miss).not.toContain('B05');
    expect(hit).toContain('B05');
  });

  it('keeps B21 over B20 when both hit', () => {
    const ids = detectBehaviors('空调房里喷了香水', 5).map((item) => item.behaviorId);
    expect(ids).toContain('B21');
    expect(ids).not.toContain('B20');
  });
});
