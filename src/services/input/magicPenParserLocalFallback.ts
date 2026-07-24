// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/growth/GrowthPage.tsx
import { v4 as uuidv4 } from 'uuid';
import { validateDrafts } from './magicPenDraftBuilder';
import {
  classifyMagicPenFallbackSegment,
  splitMagicPenFallbackSegments,
} from './magicPenFallbackSemantics';
import { buildSuggestedTimeWindow } from './magicPenTimeUtils';
import { extractTodoDueDate } from './magicPenDateParser';
import {
  ZH_MAGIC_PEN_CONNECTORS,
  ZH_MAGIC_PEN_TODO_DATE_ANCHOR_PATTERN,
  ZH_MAGIC_PEN_PERIOD_WINDOWS,
  ZH_MAGIC_PEN_PUNCT_SPLITTER,
} from './magicPenRules.zh';
import type { MagicPenDraftConfidence, MagicPenDraftItem, MagicPenParseResult } from './magicPenTypes';
import type { SupportedLang } from './lexicon/getLexicon';

interface ParsedClockToken {
  hour: number;
  minute: number;
  label?: string;
}

function normalizeText(rawText: string): string {
  return rawText.trim().replace(/[^\S\n]+/g, ' ');
}

function splitByConnectors(segment: string): string[] {
  const connectors = ['然后记得', '后来记得', ...ZH_MAGIC_PEN_CONNECTORS];
  const marked = segment.replace(new RegExp(`(${connectors.join('|')})`, 'g'), '\n$1');
  const chunks = marked.split('\n').map((item) => item.trim()).filter(Boolean);
  const parts: string[] = [];
  for (const chunk of chunks) {
    if (/^记得/.test(chunk) && parts.length > 0 && isTodoDateOnlyChunk(parts[parts.length - 1])) {
      parts[parts.length - 1] = `${parts[parts.length - 1]}${chunk}`;
    } else {
      parts.push(chunk);
    }
  }
  return parts;
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
    .replace(/^(记得|还要|要|得|需要|必须|应该|打算|计划|准备|别忘了|提醒我)\s*/, '')
    .replace(/(明天|后天|今天|待会儿?|等会儿?|等下|一会儿?|稍后|晚点|之后|今早|早上|上午|中午|下午|晚上|今晚|今夜|下周[一二三四五六日天]|这周|本周|本月)/g, '')
    .replace(/\d{1,2}[.-]\d{1,2}/g, '')
    .replace(/\d{1,2}月\d{1,2}(?:日|号)?/g, '')
    .replace(/^我(?=[\u4e00-\u9fa5])/u, '')
    .replace(/^\s*(记得|还要|要|得|需要|必须|应该|打算|计划|准备|别忘了|提醒我)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLocalizedTodoPrefix(content: string, lang: SupportedLang): string {
  if (lang === 'zh') return stripTodoDateAndDutyPrefix(content);
  if (lang === 'en') {
    return content
      .replace(/^\s*(?:and\s+)?(?:later|soon|tonight|tomorrow|afterwards)\b[\s,]*/i, '')
      .replace(/^\s*(?:i\s+)?(?:need to|have to|must|should|remember to|plan to|am going to|will)\s+/i, '')
      .trim();
  }
  return content
    .replace(/^\s*(?:e\s+)?(?:poi|pi[uù]\s+tardi|tra poco|stasera|domani|dopo)\b[\s,]*/i, '')
    .replace(/^\s*(?:io\s+)?(?:devo|dobbiamo|bisogna|ricorda(?:ti)?(?:\s+di)?|ho bisogno di|intendo|voglio)\s+/i, '')
    .trim();
}

function localizedTodoDueDate(segment: string, now: Date, lang: SupportedLang): number | undefined {
  if (lang === 'zh') return extractTodoDueDate(segment, now);
  const tomorrowPattern = lang === 'en' ? /\btomorrow\b/i : /\bdomani\b/i;
  if (tomorrowPattern.test(segment)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow.getTime();
  }
  const soonPattern = lang === 'en'
    ? /\b(?:later|soon|tonight|this afternoon|this evening)\b/i
    : /\b(?:pi[uù] tardi|tra poco|stasera|nel pomeriggio|questa sera)\b/i;
  return soonPattern.test(segment) ? now.getTime() + 30 * 60 * 1000 : undefined;
}

function buildTodoDraft(
  segment: string,
  confidence: MagicPenDraftConfidence,
  now: Date,
  lang: SupportedLang,
): MagicPenDraftItem {
  const cleanedContent = stripLocalizedTodoPrefix(segment, lang);
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
      scope: 'daily',
      dueDate: localizedTodoDueDate(segment, now, lang),
    },
  };
}

function resolveLocalActivityTiming(
  segment: string,
  now: Date,
): {
  activity: NonNullable<MagicPenDraftItem['activity']>;
  needsUserConfirmation: boolean;
} {
  const explicitRange = extractExplicitRangeTime(segment, now);
  if (explicitRange) return toResolvedTiming(explicitRange, 'exact', false);

  const exact = extractExactTime(segment, now);
  if (exact) return toResolvedTiming(exact, 'exact', true);

  const period = extractPeriodTime(segment, now);
  if (period) return toResolvedTiming(period, 'period', true);
  return {
    needsUserConfirmation: true,
    activity: {
      timeResolution: 'missing',
      startAt: now.getTime() - 30 * 60 * 1000,
      endAt: now.getTime(),
    },
  };
}

function toResolvedTiming(
  range: { startAt: number; endAt: number; label?: string },
  timeResolution: 'exact' | 'period',
  needsUserConfirmation: boolean,
): {
  activity: NonNullable<MagicPenDraftItem['activity']>;
  needsUserConfirmation: boolean;
} {
  return {
    needsUserConfirmation,
    activity: {
      startAt: range.startAt,
      endAt: range.endAt,
      timeResolution,
      suggestedTimeLabel: range.label,
    },
  };
}

function buildActivityDraft(segment: string, confidence: MagicPenDraftConfidence, now: Date): MagicPenDraftItem {
  const timing = resolveLocalActivityTiming(segment, now);
  return {
    id: uuidv4(),
    kind: 'activity_backfill',
    content: stripTimePrefix(segment),
    sourceText: segment,
    confidence,
    needsUserConfirmation: timing.needsUserConfirmation,
    errors: [],
    activity: timing.activity,
  };
}

function buildUntimedActivityDraft(
  segment: string,
  confidence: MagicPenDraftConfidence,
  now: Date,
): MagicPenDraftItem {
  return {
    id: uuidv4(),
    kind: 'activity_backfill',
    content: segment.trim(),
    sourceText: segment,
    confidence,
    needsUserConfirmation: true,
    errors: [],
    activity: {
      timeResolution: 'missing',
      startAt: now.getTime() - 30 * 60 * 1000,
      endAt: now.getTime(),
    },
  };
}

function buildAutoWriteItem(
  segment: string,
  kind: 'activity' | 'mood',
  confidence: MagicPenDraftConfidence,
  linkedMoodContent?: string,
): MagicPenParseResult['autoWriteItems'][number] {
  return {
    id: uuidv4(),
    kind,
    content: segment.trim(),
    sourceText: segment,
    confidence,
    linkedMoodContent,
  };
}

function appendFallbackSegment(
  result: MagicPenParseResult,
  segment: string,
  now: Date,
  lang: SupportedLang,
): void {
  const decision = classifyMagicPenFallbackSegment(segment, now, lang);
  if (decision.kind === 'todo_add') {
    result.drafts.push(buildTodoDraft(segment, decision.confidence, now, lang));
    return;
  }
  if (decision.kind === 'activity_backfill') {
    result.drafts.push(lang === 'zh'
      ? buildActivityDraft(segment, decision.confidence, now)
      : buildUntimedActivityDraft(segment, decision.confidence, now));
    return;
  }
  if (decision.kind === 'realtime_activity' || decision.kind === 'realtime_mood') {
    result.autoWriteItems.push(buildAutoWriteItem(
      segment,
      decision.kind === 'realtime_activity' ? 'activity' : 'mood',
      decision.confidence,
      decision.linkedMoodContent,
    ));
    return;
  }
  result.unparsedSegments.push(segment);
}

export function parseMagicPenInputLocal(
  rawText: string,
  now: Date = new Date(),
  lang: SupportedLang = 'zh',
): MagicPenParseResult {
  const normalized = normalizeText(rawText);
  if (!normalized) return { drafts: [], unparsedSegments: [], autoWriteItems: [] };

  const segments = lang === 'zh'
    ? splitSegments(normalized)
    : splitMagicPenFallbackSegments(normalized, lang);
  const result: MagicPenParseResult = { drafts: [], unparsedSegments: [], autoWriteItems: [] };
  segments.forEach((segment) => appendFallbackSegment(result, segment, now, lang));

  return {
    ...result,
    drafts: validateDrafts(result.drafts, [], now.getTime()),
  };
}
