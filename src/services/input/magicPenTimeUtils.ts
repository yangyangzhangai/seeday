import { ZH_MAGIC_PEN_PERIOD_WINDOWS } from './magicPenRules.zh';
import type { MagicPenAISegment } from './magicPenTypes';

export function buildSuggestedTimeWindow(periodKeyword: string, today: Date): { startAt: number; endAt: number } {
  const fallback = { startHour: 9, endHour: 11 };
  const period = ZH_MAGIC_PEN_PERIOD_WINDOWS[periodKeyword] ?? fallback;
  const start = new Date(today);
  const end = new Date(today);
  start.setHours(period.startHour, 0, 0, 0);
  end.setHours(period.endHour, 0, 0, 0);
  return { startAt: start.getTime(), endAt: end.getTime() };
}

function parseZhNumeralToInt(raw: string): number | undefined {
  const directMap: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    俩: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  if (raw in directMap) return directMap[raw];
  if (/^十[一二三四五六七八九]$/.test(raw)) {
    return 10 + (directMap[raw.slice(1)] ?? 0);
  }
  if (/^[二三四五六七八九]十$/.test(raw)) {
    return (directMap[raw[0]] ?? 0) * 10;
  }
  if (/^[二三四五六七八九]十[一二三四五六七八九]$/.test(raw)) {
    return (directMap[raw[0]] ?? 0) * 10 + (directMap[raw.slice(2)] ?? 0);
  }
  return undefined;
}

function normalizeZhHour(hour: number, label?: string): number {
  if (!label) return hour;
  if ((label === '下午' || label === '晚上') && hour < 12) return hour + 12;
  if (label === '中午' && hour < 11) return hour + 12;
  if ((label === '早上' || label === '上午' || label === '今早') && hour === 12) return 0;
  return hour;
}

function parseZhHourToken(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^\d{1,2}$/.test(trimmed)) {
    const parsed = Number(trimmed);
    if (parsed >= 0 && parsed <= 23) return parsed;
    return undefined;
  }
  const parsed = parseZhNumeralToInt(trimmed);
  if (parsed === undefined || parsed < 0 || parsed > 23) return undefined;
  return parsed;
}

function parseZhClockToken(token: string): { hour: number; minute: number; label?: string } | undefined {
  const match = token.match(/(今早|早上|上午|中午|下午|晚上)?\s*([零一二两俩三四五六七八九十\d]{1,3})(?:(?::|：)([0-5]?\d)|点(?:(半|一刻|三刻|[0-5]?\d分?)?)?)?/);
  if (!match) return undefined;
  const label = match[1];
  const hour = parseZhHourToken(match[2]);
  if (hour === undefined) return undefined;
  let minute = 0;
  if (match[3]) {
    minute = Number(match[3]);
  } else if (match[4]) {
    if (match[4] === '半') {
      minute = 30;
    } else if (match[4] === '一刻') {
      minute = 15;
    } else if (match[4] === '三刻') {
      minute = 45;
    } else {
      minute = Number(match[4].replace(/分$/, ''));
    }
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return undefined;
  return { hour: normalizeZhHour(hour, label), minute, label };
}

export function inferZhDurationMinutes(text: string): number | undefined {
  const input = text.trim();
  if (!input) return undefined;

  if (/(半个?小时|半小时)/.test(input)) return 30;
  if (/(一|1)个?小时半/.test(input)) return 90;

  const minuteNumber = input.match(/(\d{1,3})\s*分钟/);
  if (minuteNumber) return Math.max(1, Math.min(720, Number(minuteNumber[1])));

  const minuteZh = input.match(/([一二两俩三四五六七八九十]{1,3})\s*分钟/);
  if (minuteZh) {
    const parsed = parseZhNumeralToInt(minuteZh[1]);
    if (parsed !== undefined) return Math.max(1, Math.min(720, parsed));
  }

  const hourNumber = input.match(/(\d{1,2})(?:\.(\d))?\s*个?小时/);
  if (hourNumber) {
    const whole = Number(hourNumber[1]);
    const decimal = hourNumber[2] ? Number(`0.${hourNumber[2]}`) : 0;
    return Math.max(1, Math.min(720, Math.round((whole + decimal) * 60)));
  }

  const hourZh = input.match(/([一二两俩三四五六七八九十]{1,3})\s*个?小时/);
  if (hourZh) {
    const parsed = parseZhNumeralToInt(hourZh[1]);
    if (parsed !== undefined) return Math.max(1, Math.min(720, parsed * 60));
  }

  return undefined;
}

export function inferDurationMinutes(segment: MagicPenAISegment, lang: 'zh' | 'en' | 'it'): number | undefined {
  const explicit = segment.durationMinutes;
  if (Number.isFinite(explicit) && explicit !== undefined) {
    return Math.max(1, Math.min(720, Math.round(explicit)));
  }
  if (lang !== 'zh') return undefined;
  return inferZhDurationMinutes(segment.sourceText || segment.text || '');
}

function inferZhActivityDurationMinutes(sourceText: string): number {
  if (/开会|会议|上课|课程/.test(sourceText)) return 60;
  if (/起床|吃饭|早餐|午饭|晚饭|通勤|出门/.test(sourceText)) return 30;
  return 30;
}

export function inferZhExactRangeFromText(
  sourceText: string,
  today: Date,
): { startAt: number; endAt: number } | undefined {
  const text = sourceText.trim();
  if (!text) return undefined;

  const tokenPattern = '(?:今早|早上|上午|中午|下午|晚上)?\\s*[零一二两俩三四五六七八九十\\d]{1,3}(?:(?::|：)[0-5]?\\d|点(?:[0-5]?\\d分?)?)?';
  const rangeRegex = new RegExp(`(${tokenPattern})\\s*(?:到|至|~|～|-|—)\\s*(${tokenPattern})`);
  const rangeMatch = text.match(rangeRegex);
  if (rangeMatch) {
    const start = parseZhClockToken(rangeMatch[1]);
    const end = parseZhClockToken(rangeMatch[2]);
    if (start && end) {
      const endHasLabel = /(今早|早上|上午|中午|下午|晚上)/.test(rangeMatch[2]);
      const inferredEndHour = !endHasLabel && start.label
        ? normalizeZhHour(end.hour, start.label)
        : end.hour;
      const startDate = new Date(today);
      const endDate = new Date(today);
      startDate.setHours(start.hour, start.minute, 0, 0);
      endDate.setHours(inferredEndHour, end.minute, 0, 0);
      return { startAt: startDate.getTime(), endAt: endDate.getTime() };
    }
  }

  const adjacentMatch = text.match(/(今早|早上|上午|中午|下午|晚上)?\s*([零一二两俩三四五六七八九])([零一二两俩三四五六七八九])点/);
  if (adjacentMatch) {
    const label = adjacentMatch[1];
    const startHourBase = parseZhHourToken(adjacentMatch[2]);
    const endHourBase = parseZhHourToken(adjacentMatch[3]);
    if (startHourBase !== undefined && endHourBase !== undefined) {
      const startHour = normalizeZhHour(startHourBase, label);
      const endHour = normalizeZhHour(endHourBase, label);
      const startDate = new Date(today);
      const endDate = new Date(today);
      startDate.setHours(startHour, 0, 0, 0);
      endDate.setHours(endHour, 0, 0, 0);
      return { startAt: startDate.getTime(), endAt: endDate.getTime() };
    }
  }

  const singleTokenMatch = text.match(/((?:今早|早上|上午|中午|下午|晚上)?\s*[零一二两俩三四五六七八九十\d]{1,3}(?:(?::|：)[0-5]?\d|点(?:半|一刻|三刻|[0-5]?\d分?)?)?)/);
  if (!singleTokenMatch) return undefined;
  const single = parseZhClockToken(singleTokenMatch[1]);
  if (!single) return undefined;
  const durationMinutes = inferZhActivityDurationMinutes(text);
  const startDate = new Date(today);
  const endDate = new Date(today);
  startDate.setHours(single.hour, single.minute, 0, 0);
  endDate.setHours(single.hour, single.minute, 0, 0);
  endDate.setMinutes(endDate.getMinutes() + durationMinutes);
  return { startAt: startDate.getTime(), endAt: endDate.getTime() };
}

function getPeriodRange(periodLabel: string, today: Date): { startAt: number; endAt: number } {
  return buildSuggestedTimeWindow(periodLabel, today);
}

export function buildDynamicPeriodTime(
  segment: MagicPenAISegment,
  today: Date,
  lang: 'zh' | 'en' | 'it',
): { startAt?: number; endAt?: number } {
  const label = segment.periodLabel;
  if (!label) return {};
  const range = getPeriodRange(label, today);
  const nowEpoch = today.getTime();
  const cappedEnd = Math.min(range.endAt, nowEpoch);
  if (cappedEnd <= range.startAt) return {};

  const durationMinutes = inferDurationMinutes(segment, lang);
  if (!durationMinutes) {
    return { startAt: range.startAt, endAt: cappedEnd };
  }

  const durationMs = durationMinutes * 60 * 1000;
  const startAt = Math.max(range.startAt, cappedEnd - durationMs);
  if (startAt >= cappedEnd) return {};
  return { startAt, endAt: cappedEnd };
}
