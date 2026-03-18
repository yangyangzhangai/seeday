// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/growth/GrowthPage.tsx
import { v4 as uuidv4 } from 'uuid';
import { extractTodoDueDate } from './magicPenDateParser';
import { ZH_MAGIC_PEN_PERIOD_WINDOWS } from './magicPenRules.zh';
import type { MagicPenDraftItem } from './magicPenTypes';

const FUTURE_CLOCK_BUFFER_MS = 2 * 60 * 1000;

const ZH_TODO_ACTION_PATTERN = /(?:开组会|组会|开会|会议|看电影|汇报|提交|整理|处理|准备|复习|学习|跑步|锻炼|买菜|打电话|发消息|回电话|写|改|做|去|交|发|回|买)/;
const ZH_TODO_INTENT_PATTERN = /(?:记得|要|还要|需要|得|别忘了|提醒我|计划|打算|准备)/;
const ZH_MOOD_ONLY_PATTERN = /(?:烦|焦虑|难过|低落|开心|高兴|累|崩溃|郁闷|无语|害怕|担心|紧张)/;

function toLocalDateEpoch(baseDate: Date): number {
  const copy = new Date(baseDate);
  copy.setHours(9, 0, 0, 0);
  return copy.getTime();
}

function normalizeHour(hour: number, label?: string): number {
  if (!label) return hour;
  if ((label === '下午' || label === '晚上' || label === '今晚' || label === '今夜') && hour < 12) return hour + 12;
  if (label === '中午' && hour < 11) return hour + 12;
  if ((label === '早上' || label === '上午' || label === '今早') && hour === 12) return 0;
  return hour;
}

function normalizeHourByContext(hour: number, label: string | undefined, now: Date): number {
  const normalized = normalizeHour(hour, label);
  if (label) return normalized;
  if (normalized >= 12) return normalized;
  if (now.getHours() >= 12) return normalized + 12;
  return normalized;
}

function parseZhNumber(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const map: Record<string, number> = {
    '零': 0,
    '一': 1,
    '二': 2,
    '两': 2,
    '俩': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '七': 7,
    '八': 8,
    '九': 9,
  };
  if (trimmed === '十') return 10;
  if (trimmed.includes('十')) {
    const [leftRaw, rightRaw] = trimmed.split('十');
    const left = leftRaw ? map[leftRaw] : 1;
    const right = rightRaw ? map[rightRaw] : 0;
    if (left === undefined || right === undefined) return undefined;
    return left * 10 + right;
  }
  return map[trimmed];
}

function extractExplicitClock(segment: string, now: Date): number | undefined {
  const colon = segment.match(/(今早|早上|上午|中午|下午|晚上|今晚|今夜)?\s*(\d{1,2})[:：](\d{1,2})/);
  if (colon) {
    const label = colon[1];
    const minute = Number(colon[3]);
    let hour = Number(colon[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return undefined;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return undefined;
    hour = normalizeHourByContext(hour, label, now);
    const date = new Date(now);
    date.setHours(hour, minute, 0, 0);
    return date.getTime();
  }

  const point = segment.match(/(今早|早上|上午|中午|下午|晚上|今晚|今夜)?\s*(\d{1,2}|[零一二两俩三四五六七八九十]{1,3})点(?:(半|一刻|三刻|(\d{1,2}|[零一二两俩三四五六七八九十]{1,3})分?))?/);
  if (!point) return undefined;
  const label = point[1];
  const rawHour = point[2];
  const rawMinute = point[4];
  const tailToken = point[3];
  const hour = /^\d+$/.test(rawHour) ? Number(rawHour) : parseZhNumber(rawHour);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return undefined;

  let minute = 0;
  if (tailToken === '半') minute = 30;
  else if (tailToken === '一刻') minute = 15;
  else if (tailToken === '三刻') minute = 45;
  else if (rawMinute) minute = /^\d+$/.test(rawMinute) ? Number(rawMinute) : (parseZhNumber(rawMinute) ?? Number.NaN);
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return undefined;

  const normalized = normalizeHourByContext(hour, label, now);
  const date = new Date(now);
  date.setHours(normalized, minute, 0, 0);
  return date.getTime();
}

function inferFutureClockFromPeriod(segment: string, now: Date): number | undefined {
  for (const [label, window] of Object.entries(ZH_MAGIC_PEN_PERIOD_WINDOWS)) {
    if (!segment.includes(label)) continue;
    const date = new Date(now);
    date.setHours(window.startHour, 0, 0, 0);
    return date.getTime();
  }
  if (segment.includes('今晚') || segment.includes('今夜')) {
    const date = new Date(now);
    date.setHours(20, 0, 0, 0);
    return date.getTime();
  }
  return undefined;
}

function toDraftContent(segment: string): string {
  const cleaned = segment
    .replace(/^(然后|后来|顺便|以及)\s*/, '')
    .replace(/^(记得|还要|要|得|需要|别忘了|提醒我)\s*/, '')
    .replace(/(明天|后天|今天|待会|等会|一会|稍后|晚点|之后|今晚|今夜|下周[一二三四五六日天]|这周|本周|本月)/g, '')
    .replace(/\d{1,2}[.-]\d{1,2}/g, '')
    .replace(/\d{1,2}月\d{1,2}(?:日|号)?/g, '')
    .replace(/(今早|早上|上午|中午|下午|晚上|今晚|今夜)?\s*(\d{1,2}|[零一二两俩三四五六七八九十]{1,3})[:：点](?:(\d{1,2}|[零一二两俩三四五六七八九十]{1,3})分?|半|一刻|三刻)?/g, '')
    .replace(/^(我|自己)(?=[\u4e00-\u9fa5])/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || segment.trim();
}

export function salvageTodoDraftFromUnparsedSegment(segment: string, now: Date): MagicPenDraftItem | null {
  const source = segment.trim();
  if (!source) return null;

  const hasAction = ZH_TODO_ACTION_PATTERN.test(source);
  const hasIntent = ZH_TODO_INTENT_PATTERN.test(source);
  if (!hasAction && !hasIntent) return null;

  if (ZH_MOOD_ONLY_PATTERN.test(source) && !hasAction) {
    return null;
  }

  const nowTs = now.getTime();
  const dueFromDateWord = extractTodoDueDate(source, now);
  const explicitClockTs = extractExplicitClock(source, now);
  const periodClockTs = inferFutureClockFromPeriod(source, now);

  let dueDate: number | undefined;
  if (dueFromDateWord !== undefined) {
    dueDate = dueFromDateWord;
    if (explicitClockTs !== undefined) {
      const d = new Date(dueDate);
      const c = new Date(explicitClockTs);
      d.setHours(c.getHours(), c.getMinutes(), 0, 0);
      dueDate = d.getTime();
    }
  } else if (explicitClockTs !== undefined) {
    dueDate = explicitClockTs;
  } else if (periodClockTs !== undefined) {
    dueDate = periodClockTs;
  }

  if (dueDate === undefined) return null;

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const isCrossDayFuture = dueDate >= todayStart.getTime() + 24 * 60 * 60 * 1000;
  const isSameDayFuture = dueDate > nowTs + FUTURE_CLOCK_BUFFER_MS;
  const hasSameDayWord = /(待会|等会|一会|稍后|晚点|马上|今天|今晚|今夜|晚上)/.test(source);
  const shouldKeep = isCrossDayFuture || isSameDayFuture || hasSameDayWord;
  if (!shouldKeep) return null;

  return {
    id: uuidv4(),
    kind: 'todo_add',
    content: toDraftContent(source),
    sourceText: source,
    confidence: 'low',
    needsUserConfirmation: false,
    errors: [],
    todo: {
      priority: 'important-not-urgent',
      category: 'life',
      scope: 'daily',
      dueDate,
    },
  };
}
