import { describe, expect, it } from 'vitest';
import {
  createEmptyTodayContextSnapshot,
  detectTodayContextItems,
  mergeTodayContextSnapshot,
} from './todayContext';

describe('todayContext', () => {
  it('detects health and major event from one zh message', () => {
    const now = new Date('2026-04-06T10:00:00.000Z');
    const items = detectTodayContextItems('今天有点发烧，不过下午拿到offer了', now);

    const categories = items.map((item) => item.category);
    expect(categories).toContain('health');
    expect(categories).toContain('major_event');
  });

  it('detects english illness phrase and avoids cold-plunge false positive', () => {
    const now = new Date('2026-04-06T10:00:00.000Z');
    const positive = detectTodayContextItems('I came down with a cold and fever today', now);
    const negative = detectTodayContextItems('Did an ice bath and cold plunge after workout', now);

    expect(positive.some((item) => item.category === 'health')).toBe(true);
    expect(negative.some((item) => item.category === 'health')).toBe(false);
  });

  it('detects italian major life event', () => {
    const now = new Date('2026-04-06T10:00:00.000Z');
    const items = detectTodayContextItems('Oggi ho ricevuto un offerta di lavoro', now);

    expect(items.some((item) => item.category === 'major_event')).toBe(true);
  });

  it('does not detect negated health statements', () => {
    const now = new Date('2026-04-06T10:00:00.000Z');
    const zh = detectTodayContextItems('我没有感冒，只是有点困', now);
    const en = detectTodayContextItems('I am not sick now, just tired', now);

    expect(zh.some((item) => item.category === 'health')).toBe(false);
    expect(en.some((item) => item.category === 'health')).toBe(false);
  });

  it('still detects health when negation is followed by clear illness', () => {
    const now = new Date('2026-04-06T10:00:00.000Z');
    const items = detectTodayContextItems('我没有感冒，但是发烧了', now);

    expect(items.some((item) => item.category === 'health')).toBe(true);
  });

  it('keeps one strongest item per category in one message', () => {
    const now = new Date('2026-04-06T10:00:00.000Z');
    const items = detectTodayContextItems('今天感冒发烧还去医院拿药了', now);

    const healthItems = items.filter((item) => item.category === 'health');
    expect(healthItems.length).toBe(1);
  });

  it('detects special day and major event together', () => {
    const now = new Date('2026-04-06T10:00:00.000Z');
    const items = detectTodayContextItems('今天生日，而且刚拿到研究生录取通知', now);

    const categories = items.map((item) => item.category);
    expect(categories).toContain('special_day');
    expect(categories).toContain('major_event');
  });

  it('detects menstrual cycle health signals', () => {
    const now = new Date('2026-04-06T10:00:00.000Z');
    const zh = detectTodayContextItems('今天来例假了，痛经有点难受', now);
    const en = detectTodayContextItems('I am on my period and have period cramps', now);

    expect(zh.some((item) => item.category === 'health')).toBe(true);
    expect(en.some((item) => item.category === 'health')).toBe(true);
  });

  it('detects marriage or engagement as major event', () => {
    const now = new Date('2026-04-06T10:00:00.000Z');
    const items = detectTodayContextItems('We got engaged today', now);

    expect(items.some((item) => item.category === 'major_event')).toBe(true);
  });

  it('detects detailed daily health scenarios across languages', () => {
    const now = new Date('2026-04-06T10:00:00.000Z');
    const zh = detectTodayContextItems('智齿发炎了，牙疼得睡不着，还长了口腔溃疡', now);
    const en = detectTodayContextItems('My tooth is killing me and I got canker sores', now);
    const it = detectTodayContextItems('Ho il dente del giudizio infiammato e le afte', now);

    expect(zh.some((item) => item.category === 'health')).toBe(true);
    expect(en.some((item) => item.category === 'health')).toBe(true);
    expect(it.some((item) => item.category === 'health')).toBe(true);
  });

  it('detects dentist visits as medical health context', () => {
    const now = new Date('2026-04-06T10:00:00.000Z');
    const items = detectTodayContextItems('今天去看牙医做了根管治疗', now);

    expect(items.some((item) => item.category === 'health')).toBe(true);
  });

  it('resets snapshot by local day boundary', () => {
    const day1 = new Date(2026, 3, 6, 9, 0, 0);
    const day2 = new Date(2026, 3, 7, 9, 0, 0);

    const day1Items = detectTodayContextItems('今天生日', day1);
    const snap1 = mergeTodayContextSnapshot(createEmptyTodayContextSnapshot(day1), day1Items, day1);
    expect(snap1.items.length).toBe(1);

    const snap2 = mergeTodayContextSnapshot(snap1, [], day2);
    expect(snap2.items.length).toBe(0);
  });

  it('deduplicates same category summary and keeps latest first', () => {
    const now = new Date(2026, 3, 6, 10, 0, 0);
    const later = new Date(2026, 3, 6, 12, 0, 0);

    const first = detectTodayContextItems('我感冒了', now);
    const second = detectTodayContextItems('还是感冒', later);

    const snap1 = mergeTodayContextSnapshot(undefined, first, now);
    const snap2 = mergeTodayContextSnapshot(snap1, second, later);
    expect(snap2.items.length).toBe(1);
    expect(snap2.items[0].detectedAt).toBe(later.getTime());
  });
});
