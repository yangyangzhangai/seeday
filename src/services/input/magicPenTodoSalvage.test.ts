import { describe, expect, it } from 'vitest';
import { salvageTodoDraftFromUnparsedSegment } from './magicPenTodoSalvage';

const eveningNow = new Date(2026, 2, 11, 18, 0, 0, 0);

function toLocalYmd(epoch?: number): string {
  if (!epoch) return '';
  const date = new Date(epoch);
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

describe('salvageTodoDraftFromUnparsedSegment', () => {
  it('extracts future todo from relative-day phrase', () => {
    const draft = salvageTodoDraftFromUnparsedSegment('明天下午三点开组会', eveningNow);
    expect(draft).not.toBeNull();
    expect(draft?.kind).toBe('todo_add');
    expect(toLocalYmd(draft?.todo?.dueDate)).toBe('2026-03-12');
    expect(new Date(draft!.todo!.dueDate!).getHours()).toBe(15);
  });

  it('extracts same-day future todo by comparing clock with now', () => {
    const now = new Date(2026, 2, 11, 18, 0, 0, 0);
    const draft = salvageTodoDraftFromUnparsedSegment('七点开组会', now);
    expect(draft).not.toBeNull();
    expect(new Date(draft!.todo!.dueDate!).getHours()).toBe(19);
  });

  it('keeps past same-day clock phrase as unparsed', () => {
    const now = new Date(2026, 2, 11, 18, 0, 0, 0);
    const draft = salvageTodoDraftFromUnparsedSegment('下午三点开组会', now);
    expect(draft).toBeNull();
  });

  it('does not force mood sentence into todo', () => {
    const draft = salvageTodoDraftFromUnparsedSegment('下午很烦', eveningNow);
    expect(draft).toBeNull();
  });
});
