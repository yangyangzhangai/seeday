// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/todo/README.md
import { v4 as uuidv4 } from 'uuid';
import { validateDrafts } from './magicPenDraftBuilder';
import { buildSuggestedTimeWindow } from './magicPenTimeUtils';
import { extractTodoDueDate } from './magicPenDateParser';
import {
  ZH_MAGIC_PEN_ACTIVITY_EVIDENCE_WORDS,
  ZH_MAGIC_PEN_ACTIVITY_VERBS,
  ZH_MAGIC_PEN_CONNECTORS,
  ZH_MAGIC_PEN_CROSS_DAY_WORDS,
  ZH_MAGIC_PEN_TODO_DATE_ANCHOR_PATTERN,
  ZH_MAGIC_PEN_PERIOD_WINDOWS,
  ZH_MAGIC_PEN_PUNCT_SPLITTER,
  ZH_MAGIC_PEN_TODO_DUTY_WORDS,
  ZH_MAGIC_PEN_TODO_FUTURE_WORDS,
  ZH_MAGIC_PEN_UNPARSED_HINT_WORDS,
} from './magicPenRules.zh';
import type { MagicPenDraftConfidence, MagicPenDraftItem, MagicPenParseResult } from './magicPenTypes';

interface SegmentClassification {
  kind: 'activity_backfill' | 'todo_add' | 'unparsed';
  confidence: MagicPenDraftConfidence;
}

interface ParsedClockToken {
  hour: number;
  minute: number;
  label?: string;
}

function normalizeText(rawText: string): string {
  return rawText.trim().replace(/[^\S\n]+/g, ' ');
}

function splitByConnectors(segment: string): string[] {
  const connectorPattern = new RegExp(`(${ZH_MAGIC_PEN_CONNECTORS.join('|')})`, 'g');
  const tokens = segment.split(connectorPattern).map((item) => item.trim()).filter(Boolean);
  if (tokens.length <= 1) return tokens;
  const parts: string[] = [];
  let headConsumed = false;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (ZH_MAGIC_PEN_CONNECTORS.includes(token) && i + 1 < tokens.length) {
      const tail = `${token}${tokens[i + 1]}`.trim();
      if (token === '记得' && parts.length > 0 && isTodoDateOnlyChunk(parts[parts.length - 1])) {
        parts[parts.length - 1] = `${parts[parts.length - 1]}${tail}`.trim();
      } else {
        parts.push(tail);
      }
      i += 1;
      continue;
    }
    if (!headConsumed) {
      parts.push(token);
      headConsumed = true;
    }
  }
  return parts.filter(Boolean);
}

function isTodoDateOnlyChunk(segment: string): boolean {
  return /^(今天|明天|后天|早上|上午|中午|下午|晚上|今晚|今夜|下周[一二三四五六日天]|\d{1,2}[.-]\d{1,2}|\d{1,2}月\d{1,2}(?:日|号)?)$/.test(segment.trim());
}

function splitByTodoDateAnchors(segment: string): string[] {
  const regex = new RegExp(ZH_MAGIC_PEN_TODO_DATE_ANCHOR_PATTERN, 'g');
  const matches = Array.from(segment.matchAll(regex));
  if (matches.length <= 1) return [segment];

  const chunks: string[] = [];
  let start = 0;
  for (let i = 1; i < matches.length; i += 1) {
    const index = matches[i].index ?? 0;
    const piece = segment.slice(start, index).trim();
    if (piece) chunks.push(piece);
    start = index;
  }
  const tail = segment.slice(start).trim();
  if (tail) chunks.push(tail);
  return chunks.length > 0 ? chunks : [segment];
}

function splitSegments(text: string): string[] {
  const segments = text
    .split(ZH_MAGIC_PEN_PUNCT_SPLITTER)
    .flatMap(splitByConnectors)
    .flatMap(splitByTodoDateAnchors);
  return segments.map((item) => item.trim()).filter(Boolean);
}

function includesAny(input: string, words: string[]): boolean {
  return words.some((word) => input.includes(word));
}

function isCrossDaySegment(segment: string): boolean {
  return includesAny(segment, ZH_MAGIC_PEN_CROSS_DAY_WORDS);
}

function isFuturePeriodSegment(segment: string, now: Date): boolean {
  const currentHour = now.getHours();
  if (currentHour >= 12) return false;
  if (/(今晚|今夜)/.test(segment)) {
    return currentHour < 20;
  }
  return Object.entries(ZH_MAGIC_PEN_PERIOD_WINDOWS).some(([label, window]) => (
    segment.includes(label) && currentHour < window.startHour
  ));
}

function classifySegment(segment: string, now: Date): SegmentClassification {
  if (segment.includes('很多事')) {
    return { kind: 'unparsed', confidence: 'low' };
  }
  const hasFutureSignal = includesAny(segment, ZH_MAGIC_PEN_TODO_FUTURE_WORDS);
  const hasFuturePeriodSignal = isFuturePeriodSegment(segment, now);
  const hasFutureLikeSignal = hasFutureSignal || hasFuturePeriodSignal;
  const hasDutySignal = includesAny(segment, ZH_MAGIC_PEN_TODO_DUTY_WORDS);
  const hasDateSignal = new RegExp(ZH_MAGIC_PEN_TODO_DATE_ANCHOR_PATTERN).test(segment);
  const hasTodoSignal = hasFutureLikeSignal || hasDutySignal || hasDateSignal;
  const hasActivityEvidence = includesAny(segment, ZH_MAGIC_PEN_ACTIVITY_EVIDENCE_WORDS);
  const hasActivityVerb = includesAny(segment, ZH_MAGIC_PEN_ACTIVITY_VERBS);

  if (hasTodoSignal && hasFutureLikeSignal && hasDutySignal) {
    return { kind: 'todo_add', confidence: 'high' };
  }
  if (hasDutySignal) {
    return { kind: 'todo_add', confidence: hasFutureLikeSignal ? 'high' : 'medium' };
  }
  if (hasActivityEvidence && hasActivityVerb && !hasFutureLikeSignal) {
    return { kind: 'activity_backfill', confidence: 'high' };
  }
  if (hasTodoSignal) {
    return { kind: 'todo_add', confidence: 'medium' };
  }
  if (hasActivityEvidence && hasActivityVerb) {
    return { kind: 'activity_backfill', confidence: 'medium' };
  }
  if (includesAny(segment, ZH_MAGIC_PEN_UNPARSED_HINT_WORDS)) {
    return { kind: 'unparsed', confidence: 'low' };
  }
  return { kind: 'unparsed', confidence: 'low' };
}

function toLocalEpoch(baseDate: Date, hour: number, minute: number): number {
  const copy = new Date(baseDate);
  copy.setHours(hour, minute, 0, 0);
  return copy.getTime();
}

function normalizeHour(hour: number, label: string | undefined): number {
  if (!label) return hour;
  if ((label === '下午' || label === '晚上') && hour < 12) return hour + 12;
  if (label === '中午' && hour < 11) return hour + 12;
  if ((label === '早上' || label === '上午' || label === '今早') && hour === 12) return 0;
  return hour;
}

function extractExactTime(segment: string, now: Date): { startAt: number; endAt: number; label?: string } | null {
  const colon = segment.match(/(今早|早上|上午|中午|下午|晚上)?\s*(\d{1,2})[:：](\d{1,2})/);
  if (colon) {
    const label = colon[1];
    const hour = normalizeHour(Number(colon[2]), label);
    const minute = Number(colon[3]);
    const startAt = toLocalEpoch(now, hour, minute);
    return { startAt, endAt: startAt + 30 * 60 * 1000, label };
  }

  const point = segment.match(/(今早|早上|上午|中午|下午|晚上)?\s*(\d{1,2})点(?:(\d{1,2})分?)?/);
  if (!point) return null;
  const label = point[1];
  const hour = normalizeHour(Number(point[2]), label);
  const minute = point[3] ? Number(point[3]) : 0;
  const startAt = toLocalEpoch(now, hour, minute);
  return { startAt, endAt: startAt + 30 * 60 * 1000, label };
}

function extractClockToken(token: string): ParsedClockToken | null {
  const match = token.match(/(今早|早上|上午|中午|下午|晚上)?\s*(\d{1,2})(?::|：|点)(?:(\d{1,2})分?)?/);
  if (!match) return null;
  const label = match[1];
  const rawHour = Number(match[2]);
  const rawMinute = match[3] ? Number(match[3]) : 0;
  if (!Number.isInteger(rawHour) || !Number.isInteger(rawMinute)) return null;
  if (rawHour < 0 || rawHour > 23 || rawMinute < 0 || rawMinute > 59) return null;
  return {
    hour: normalizeHour(rawHour, label),
    minute: rawMinute,
    label,
  };
}

function extractExplicitRangeTime(segment: string, now: Date): { startAt: number; endAt: number; label?: string } | null {
  const rangeMatch = segment.match(
    /(?:从)?\s*((?:今早|早上|上午|中午|下午|晚上)?\s*\d{1,2}(?::\d{1,2}|：\d{1,2}|点(?:\d{1,2}分?)?))\s*(?:到|至|~|～|-)\s*((?:今早|早上|上午|中午|下午|晚上)?\s*\d{1,2}(?::\d{1,2}|：\d{1,2}|点(?:\d{1,2}分?)?))/,
  );
  if (!rangeMatch) return null;
  const startToken = extractClockToken(rangeMatch[1]);
  const endToken = extractClockToken(rangeMatch[2]);
  if (!startToken || !endToken) return null;
  const endHasLabel = /(今早|早上|上午|中午|下午|晚上)/.test(rangeMatch[2]);
  const inferredEndHour = !endHasLabel && startToken.label
    ? normalizeHour(endToken.hour, startToken.label)
    : endToken.hour;
  return {
    startAt: toLocalEpoch(now, startToken.hour, startToken.minute),
    endAt: toLocalEpoch(now, inferredEndHour, endToken.minute),
    label: startToken.label,
  };
}

function extractPeriodTime(segment: string, now: Date): { startAt: number; endAt: number; label: string } | null {
  const label = Object.keys(ZH_MAGIC_PEN_PERIOD_WINDOWS).find((keyword) => segment.includes(keyword));
  if (!label) return null;
  const range = buildSuggestedTimeWindow(label, now);
  return { ...range, label };
}

function stripTimePrefix(content: string): string {
  const stripped = content
    .replace(/^(然后|后来|顺便|以及)/, '')
    .replace(/(?:从)?\s*(?:今早|早上|上午|中午|下午|晚上)?\s*\d{1,2}(?::\d{1,2}|：\d{1,2}|点(?:\d{1,2}分?)?)\s*(?:到|至|~|～|-)\s*(?:今早|早上|上午|中午|下午|晚上)?\s*\d{1,2}(?::\d{1,2}|：\d{1,2}|点(?:\d{1,2}分?)?)/g, '')
    .replace(/(今天|今早|早上|上午|中午|下午|晚上|刚刚|刚才)/g, '')
    .replace(/\d{1,2}[:：]\d{1,2}/g, '')
    .replace(/\d{1,2}点(\d{1,2}分?)?/g, '')
    .replace(/(到|至|从|~|～|-)/g, '')
    .replace(/^我在(?=[\u4e00-\u9fa5])/u, '')
    .replace(/^我(?!们)(?=[\u4e00-\u9fa5])/u, '')
    .replace(/^自己(?=[\u4e00-\u9fa5])/u, '')
    .trim();
  return stripped || content.trim();
}

function stripTodoDateAndDutyPrefix(content: string): string {
  return content
    .replace(/^(然后|后来|顺便|以及)/, '')
    .replace(/^(记得|还要|要|得|需要|别忘了|提醒我)\s*/, '')
    .replace(/(明天|后天|今天|待会|一会|稍后|晚点|之后|晚上|今晚|今夜|下周[一二三四五六日天]|这周|本周|本月)/g, '')
    .replace(/\d{1,2}[.-]\d{1,2}/g, '')
    .replace(/\d{1,2}月\d{1,2}(?:日|号)?/g, '')
    .replace(/^我(?=[\u4e00-\u9fa5])/u, '')
    .replace(/^\s*(记得|还要|要|得|需要|别忘了|提醒我)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTodoDraft(segment: string, confidence: MagicPenDraftConfidence, now: Date): MagicPenDraftItem {
  const cleanedContent = stripTodoDateAndDutyPrefix(segment);
  return {
    id: uuidv4(),
    kind: 'todo_add',
    content: cleanedContent || segment.trim(),
    sourceText: segment,
    confidence,
    needsUserConfirmation: false,
    errors: [],
    todo: {
      priority: 'important-not-urgent',
      category: 'life',
      scope: 'daily',
      dueDate: extractTodoDueDate(segment, now),
    },
  };
}

function buildActivityDraft(segment: string, confidence: MagicPenDraftConfidence, now: Date): MagicPenDraftItem {
  const explicitRange = extractExplicitRangeTime(segment, now);
  if (explicitRange) {
    return {
      id: uuidv4(),
      kind: 'activity_backfill',
      content: stripTimePrefix(segment),
      sourceText: segment,
      confidence,
      needsUserConfirmation: false,
      errors: [],
      activity: {
        startAt: explicitRange.startAt,
        endAt: explicitRange.endAt,
        timeResolution: 'exact',
        suggestedTimeLabel: explicitRange.label,
      },
    };
  }

  const exact = extractExactTime(segment, now);
  if (exact) {
    return {
      id: uuidv4(),
      kind: 'activity_backfill',
      content: stripTimePrefix(segment),
      sourceText: segment,
      confidence,
      needsUserConfirmation: true,
      errors: [],
      activity: {
        startAt: exact.startAt,
        endAt: exact.endAt,
        timeResolution: 'exact',
        suggestedTimeLabel: exact.label,
      },
    };
  }

  const period = extractPeriodTime(segment, now);
  if (period) {
    return {
      id: uuidv4(),
      kind: 'activity_backfill',
      content: stripTimePrefix(segment),
      sourceText: segment,
      confidence,
      needsUserConfirmation: true,
      errors: [],
      activity: {
        startAt: period.startAt,
        endAt: period.endAt,
        timeResolution: 'period',
        suggestedTimeLabel: period.label,
      },
    };
  }

  return {
    id: uuidv4(),
    kind: 'activity_backfill',
    content: stripTimePrefix(segment),
    sourceText: segment,
    confidence,
    needsUserConfirmation: true,
    errors: [],
    activity: {
      timeResolution: 'missing',
    },
  };
}

function buildDraftFromSegment(segment: string, now: Date): MagicPenDraftItem | null {
  if (isCrossDaySegment(segment)) return null;
  const classified = classifySegment(segment, now);
  if (classified.kind === 'todo_add') return buildTodoDraft(segment, classified.confidence, now);
  if (classified.kind === 'activity_backfill') return buildActivityDraft(segment, classified.confidence, now);
  return null;
}

export function parseMagicPenInputLocal(rawText: string, now: Date = new Date()): MagicPenParseResult {
  const normalized = normalizeText(rawText);
  if (!normalized) return { drafts: [], unparsedSegments: [], autoWriteItems: [] };

  const segments = splitSegments(normalized);
  const drafts: MagicPenDraftItem[] = [];
  const unparsedSegments: string[] = [];

  for (const segment of segments) {
    const draft = buildDraftFromSegment(segment, now);
    if (draft) {
      drafts.push(draft);
      continue;
    }
    unparsedSegments.push(segment);
  }

  return {
    drafts: validateDrafts(drafts, [], now.getTime()),
    unparsedSegments,
    autoWriteItems: [],
  };
}
