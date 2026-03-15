import { describe, expect, it } from 'vitest';
import { extractTodoDueDate } from './magicPenDateParser';

const fixedNow = new Date(2026, 2, 11, 18, 0, 0, 0);

function toYmd(epoch?: number): string {
  if (epoch === undefined) return '';
  const date = new Date(epoch);
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

describe('extractTodoDueDate', () => {
  it('keeps numeric month-day parsing', () => {
    expect(toYmd(extractTodoDueDate('3.18旅游', fixedNow))).toBe('2026-03-18');
  });

  it('does not treat time range as month-day date', () => {
    expect(extractTodoDueDate('我8-9点吃早饭', fixedNow)).toBeUndefined();
  });

  it('treats tonight period wording as same-day dueDate', () => {
    expect(toYmd(extractTodoDueDate('晚上还要开会', fixedNow))).toBe('2026-03-11');
  });
});
