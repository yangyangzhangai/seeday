// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/todo/README.md
import {
  ZH_MAGIC_PEN_TODO_RELATIVE_DATE_WORDS,
  ZH_MAGIC_PEN_TODO_SAME_DAY_WORDS,
  ZH_MAGIC_PEN_TODO_WEEKDAY_MAP,
} from './magicPenRules.zh';

function toLocalDateEpoch(baseDate: Date): number {
  const copy = new Date(baseDate);
  copy.setHours(9, 0, 0, 0);
  return copy.getTime();
}

function buildSafeDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day, 9, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function resolveYearlessDate(month: number, day: number, now: Date): number | undefined {
  const thisYear = now.getFullYear();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const candidateThisYear = buildSafeDate(thisYear, month, day);
  if (!candidateThisYear) return undefined;
  const candidateDay = new Date(candidateThisYear);
  candidateDay.setHours(0, 0, 0, 0);
  if (candidateDay >= today) return candidateThisYear.getTime();

  const candidateNextYear = buildSafeDate(thisYear + 1, month, day);
  return candidateNextYear?.getTime();
}

function resolveNextWeekWeekday(weekday: number, now: Date): number {
  const mondayBasedNow = now.getDay() === 0 ? 7 : now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() + (1 - mondayBasedNow));
  monday.setHours(9, 0, 0, 0);

  const target = new Date(monday);
  const mondayBasedTarget = weekday === 0 ? 7 : weekday;
  target.setDate(monday.getDate() + 7 + (mondayBasedTarget - 1));
  return target.getTime();
}

export function extractTodoDueDate(segment: string, now: Date): number | undefined {
  const relativeIndex = ZH_MAGIC_PEN_TODO_RELATIVE_DATE_WORDS
    .map((token) => ({ token, index: segment.indexOf(token) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)[0];

  const weekdayMatch = segment.match(/下周([一二三四五六日天])/);
  const weekdayIndex = weekdayMatch?.index ?? -1;

  const numericMatch = segment.match(/(\d{1,2})[.-](\d{1,2})/);
  const numericIndex = numericMatch?.index ?? -1;

  const chineseDateMatch = segment.match(/(\d{1,2})月(\d{1,2})(?:日|号)?/);
  const chineseDateIndex = chineseDateMatch?.index ?? -1;

  const candidates = [
    relativeIndex ? { type: 'relative' as const, index: relativeIndex.index } : null,
    weekdayMatch ? { type: 'weekday' as const, index: weekdayIndex } : null,
    numericMatch ? { type: 'numeric' as const, index: numericIndex } : null,
    chineseDateMatch ? { type: 'chinese' as const, index: chineseDateIndex } : null,
  ].filter((item): item is { type: 'relative' | 'weekday' | 'numeric' | 'chinese'; index: number } => !!item)
    .sort((a, b) => a.index - b.index);

  const best = candidates[0];
  if (!best) {
    if (ZH_MAGIC_PEN_TODO_SAME_DAY_WORDS.some((token) => segment.includes(token))) {
      return toLocalDateEpoch(now);
    }
    return undefined;
  }

  if (best.type === 'relative' && relativeIndex) {
    const target = new Date(now);
    if (relativeIndex.token === '明天') target.setDate(now.getDate() + 1);
    if (relativeIndex.token === '后天') target.setDate(now.getDate() + 2);
    return toLocalDateEpoch(target);
  }

  if (best.type === 'weekday' && weekdayMatch) {
    const weekday = ZH_MAGIC_PEN_TODO_WEEKDAY_MAP[weekdayMatch[1]];
    if (weekday === undefined) return undefined;
    return resolveNextWeekWeekday(weekday, now);
  }

  if (best.type === 'numeric' && numericMatch) {
    return resolveYearlessDate(Number(numericMatch[1]), Number(numericMatch[2]), now);
  }

  if (best.type === 'chinese' && chineseDateMatch) {
    return resolveYearlessDate(Number(chineseDateMatch[1]), Number(chineseDateMatch[2]), now);
  }

  return undefined;
}
