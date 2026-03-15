// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/todo/README.md
import type { Message } from '../../store/useChatStore';
import { v4 as uuidv4 } from 'uuid';
import type {
  MagicPenAISegment,
  MagicPenAIResult,
  MagicPenDraftErrorCode,
  MagicPenDraftItem,
  MagicPenParseResult,
} from './magicPenTypes';
import { extractTodoDueDate } from './magicPenDateParser';
import { ZH_MAGIC_PEN_PERIOD_WINDOWS } from './magicPenRules.zh';

function isSameLocalDay(a: number, b: number): boolean {
  const dateA = new Date(a);
  const dateB = new Date(b);
  return (
    dateA.getFullYear() === dateB.getFullYear()
    && dateA.getMonth() === dateB.getMonth()
    && dateA.getDate() === dateB.getDate()
  );
}

function cloneDraftWithErrors(draft: MagicPenDraftItem, errors: MagicPenDraftErrorCode[]): MagicPenDraftItem {
  return { ...draft, errors: Array.from(new Set(errors)) };
}

function collectTimeErrors(draft: MagicPenDraftItem, now: number): MagicPenDraftErrorCode[] {
  const activity = draft.activity;
  if (!activity) return [];
  if (activity.startAt === undefined || activity.endAt === undefined) return ['missing_time'];
  if (activity.startAt >= activity.endAt) return ['invalid_time_range'];
  if (activity.endAt > now) return ['future_time'];
  if (!isSameLocalDay(activity.startAt, activity.endAt)) return ['cross_day'];
  return [];
}

function appendOngoingOverlapError(
  draft: MagicPenDraftItem,
  ongoingActivity: Message | undefined,
): MagicPenDraftErrorCode[] {
  if (!ongoingActivity || !draft.activity?.endAt) return [];
  return draft.activity.endAt > ongoingActivity.timestamp ? ['overlap_with_ongoing_activity'] : [];
}

function getComparableStart(draft: MagicPenDraftItem): number {
  return draft.activity?.startAt ?? Number.MAX_SAFE_INTEGER;
}

function markBatchOverlapErrors(drafts: MagicPenDraftItem[]): MagicPenDraftItem[] {
  const indexed = drafts
    .map((draft, index) => ({ draft, index }))
    .filter((item) => item.draft.kind === 'activity_backfill' && item.draft.activity?.startAt !== undefined && item.draft.activity?.endAt !== undefined)
    .sort((a, b) => {
      const diff = getComparableStart(a.draft) - getComparableStart(b.draft);
      if (diff !== 0) return diff;
      return a.draft.id.localeCompare(b.draft.id);
    });

  const nextDrafts = [...drafts];
  for (let i = 1; i < indexed.length; i += 1) {
    const previous = indexed[i - 1].draft;
    const current = indexed[i].draft;
    const previousEnd = previous.activity?.endAt;
    const currentStart = current.activity?.startAt;
    if (previousEnd === undefined || currentStart === undefined) continue;
    if (currentStart < previousEnd) {
      const targetIndex = indexed[i].index;
      const target = nextDrafts[targetIndex];
      nextDrafts[targetIndex] = cloneDraftWithErrors(target, [...target.errors, 'overlap_in_batch']);
    }
  }
  return nextDrafts;
}

export function buildSuggestedTimeWindow(periodKeyword: string, today: Date): { startAt: number; endAt: number } {
  const fallback = { startHour: 9, endHour: 11 };
  const period = ZH_MAGIC_PEN_PERIOD_WINDOWS[periodKeyword] ?? fallback;
  const start = new Date(today);
  const end = new Date(today);
  start.setHours(period.startHour, 0, 0, 0);
  end.setHours(period.endHour, 0, 0, 0);
  return { startAt: start.getTime(), endAt: end.getTime() };
}

function toActivityTimeResolutionFromSegment(segment: MagicPenAISegment): 'exact' | 'period' | 'missing' {
  if (segment.timeSource === 'exact' || segment.timeSource === 'period') return segment.timeSource;
  if (segment.periodLabel) return 'period';
  return 'missing';
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

function inferZhDurationMinutes(text: string): number | undefined {
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

function inferDurationMinutes(segment: MagicPenAISegment, lang: 'zh' | 'en' | 'it'): number | undefined {
  const explicit = segment.durationMinutes;
  if (Number.isFinite(explicit) && explicit !== undefined) {
    return Math.max(1, Math.min(720, Math.round(explicit)));
  }
  if (lang !== 'zh') return undefined;
  return inferZhDurationMinutes(segment.sourceText || segment.text || '');
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
  const match = token.match(/(今早|早上|上午|中午|下午|晚上)?\s*([零一二两俩三四五六七八九十\d]{1,3})(?:(?::|：|点)([0-5]?\d)分?)?/);
  if (!match) return undefined;
  const label = match[1];
  const hour = parseZhHourToken(match[2]);
  if (hour === undefined) return undefined;
  const minute = match[3] ? Number(match[3]) : 0;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return undefined;
  return { hour: normalizeZhHour(hour, label), minute, label };
}

function inferZhExactRangeFromText(
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
  if (!adjacentMatch) return undefined;
  const label = adjacentMatch[1];
  const startHourBase = parseZhHourToken(adjacentMatch[2]);
  const endHourBase = parseZhHourToken(adjacentMatch[3]);
  if (startHourBase === undefined || endHourBase === undefined) return undefined;
  const startHour = normalizeZhHour(startHourBase, label);
  const endHour = normalizeZhHour(endHourBase, label);
  const startDate = new Date(today);
  const endDate = new Date(today);
  startDate.setHours(startHour, 0, 0, 0);
  endDate.setHours(endHour, 0, 0, 0);
  return { startAt: startDate.getTime(), endAt: endDate.getTime() };
}

function getPeriodRange(periodLabel: string, today: Date): { startAt: number; endAt: number } {
  return buildSuggestedTimeWindow(periodLabel, today);
}

function buildDynamicPeriodTime(
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

function clipRangeToWindow(
  startAt: number,
  endAt: number,
  windowStart: number,
  windowEnd: number,
): { startAt: number; endAt: number } | undefined {
  const clippedStart = Math.max(startAt, windowStart);
  const clippedEnd = Math.min(endAt, windowEnd);
  if (clippedEnd <= clippedStart) return undefined;
  return { startAt: clippedStart, endAt: clippedEnd };
}

function mergeRanges(ranges: Array<{ startAt: number; endAt: number }>): Array<{ startAt: number; endAt: number }> {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.startAt - b.startAt);
  const merged: Array<{ startAt: number; endAt: number }> = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.startAt <= last.endAt) {
      last.endAt = Math.max(last.endAt, current.endAt);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

function collectPeriodGaps(
  messages: Message[],
  windowStart: number,
  windowEnd: number,
): Array<{ startAt: number; endAt: number }> {
  const occupied = messages
    .filter((message) => message.mode === 'record' && !message.isMood && message.duration !== undefined)
    .map((message) => {
      const startAt = message.timestamp;
      const endAt = message.timestamp + message.duration! * 60 * 1000;
      return clipRangeToWindow(startAt, endAt, windowStart, windowEnd);
    })
    .filter((item): item is { startAt: number; endAt: number } => !!item);

  const merged = mergeRanges(occupied);
  const gaps: Array<{ startAt: number; endAt: number }> = [];
  let cursor = windowStart;
  for (const block of merged) {
    if (block.startAt > cursor) {
      gaps.push({ startAt: cursor, endAt: block.startAt });
    }
    cursor = Math.max(cursor, block.endAt);
  }
  if (cursor < windowEnd) {
    gaps.push({ startAt: cursor, endAt: windowEnd });
  }
  return gaps;
}

function chooseBestGap(gaps: Array<{ startAt: number; endAt: number }>): { startAt: number; endAt: number } | undefined {
  if (gaps.length === 0) return undefined;
  const sorted = [...gaps].sort((a, b) => {
    const diff = (b.endAt - b.startAt) - (a.endAt - a.startAt);
    if (diff !== 0) return diff;
    return b.endAt - a.endAt;
  });
  return sorted[0];
}

function allocateRangeInGap(
  gap: { startAt: number; endAt: number },
  durationMinutes?: number,
): { startAt: number; endAt: number } {
  if (!durationMinutes) {
    return gap;
  }
  const durationMs = durationMinutes * 60 * 1000;
  const endAt = gap.endAt;
  const startAt = Math.max(gap.startAt, endAt - durationMs);
  return { startAt, endAt };
}

export function alignPeriodDraftsToMessageGaps(
  drafts: MagicPenDraftItem[],
  messages: Message[],
  now: number = Date.now(),
): MagicPenDraftItem[] {
  if (drafts.length === 0) return drafts;

  return drafts.map((draft) => {
    if (draft.kind !== 'activity_backfill') return draft;
    if (draft.activity?.timeResolution !== 'period') return draft;
    const label = draft.activity.suggestedTimeLabel;
    if (!label) return draft;

    const anchorDate = new Date(draft.activity.startAt ?? now);
    const periodRange = getPeriodRange(label, anchorDate);
    const periodEnd = Math.min(periodRange.endAt, now);
    if (periodEnd <= periodRange.startAt) return draft;

    const durationMinutes = inferZhDurationMinutes(draft.sourceText || draft.content);
    const bestGap = chooseBestGap(collectPeriodGaps(messages, periodRange.startAt, periodEnd));
    if (bestGap) {
      const aligned = allocateRangeInGap(bestGap, durationMinutes);
      if (aligned.endAt > aligned.startAt) {
        return {
          ...draft,
          activity: {
            ...draft.activity,
            startAt: aligned.startAt,
            endAt: aligned.endAt,
          },
        };
      }
    }

    const fallbackEnd = periodEnd;
    const fallbackStart = durationMinutes
      ? Math.max(periodRange.startAt, fallbackEnd - durationMinutes * 60 * 1000)
      : periodRange.startAt;
    if (fallbackEnd <= fallbackStart) return draft;
    return {
      ...draft,
      activity: {
        ...draft.activity,
        startAt: fallbackStart,
        endAt: fallbackEnd,
      },
    };
  });
}

export function timeStringToEpoch(timeStr: string, date: Date): number {
  const match = timeStr.match(/^(\d{2}):(\d{2})$/);
  if (!match) return Number.NaN;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return Number.NaN;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return Number.NaN;
  const local = new Date(date);
  local.setHours(hour, minute, 0, 0);
  return local.getTime();
}

function toLocalDateEpoch(baseDate: Date): number {
  const copy = new Date(baseDate);
  copy.setHours(9, 0, 0, 0);
  return copy.getTime();
}

function inferSameDayDueDate(text: string, today: Date, lang: 'zh' | 'en' | 'it'): number | undefined {
  if (!text) return undefined;
  if (lang === 'zh' && /(待会|等会|一会|稍后|晚点|马上|今天|今晚|今夜|晚上)/.test(text)) {
    return toLocalDateEpoch(today);
  }
  if (lang === 'en' && /\b(today|later|soon|in a while|tonight|this evening)\b/i.test(text)) {
    return toLocalDateEpoch(today);
  }
  if (lang === 'it' && /\b(oggi|tra poco|piu tardi|subito dopo|stasera)\b/i.test(text)) {
    return toLocalDateEpoch(today);
  }
  return undefined;
}

function inferTodoDueDate(segmentText: string, today: Date, lang: 'zh' | 'en' | 'it'): number | undefined {
  if (lang === 'zh') {
    const extracted = extractTodoDueDate(segmentText, today);
    if (extracted !== undefined) return extracted;
  }
  return inferSameDayDueDate(segmentText, today, lang);
}

function hasExplicitZhTimeAnchor(input: string): boolean {
  if (!input) return false;
  return /(今天|明天|后天|昨天|前天|今早|早上|上午|中午|下午|晚上|\d{1,2}\s*(?::|：)\s*\d{1,2}|\d{1,2}\s*(?:点(?:\d{1,2}\s*分?)?)|\d{1,2}\s*(?:到|至|~|～|-|—)\s*\d{1,2}\s*(?:点)?)/.test(input);
}

function looksLikeZhTimeResidualPrefix(input: string): boolean {
  if (!input) return false;
  return /^(?:点|到|至|~|～|-|—|\d{1,2})(?=[\u4e00-\u9fa5])/u.test(input);
}

function recoverZhActivityFromSourceTimePrefix(
  normalizedContent: string,
  sourceText: string,
): string | undefined {
  if (!looksLikeZhTimeResidualPrefix(normalizedContent)) return undefined;
  const source = sourceText.trim();
  if (!hasExplicitZhTimeAnchor(source)) return undefined;

  const dayOrPeriod = '(?:今天|明天|后天|昨天|前天|今早|早上|上午|中午|下午|晚上)';
  const clockToken = '(?:\\d{1,2}(?:\\s*(?::|：)\\s*\\d{1,2}|\\s*点(?:\\s*\\d{1,2}\\s*分?)?)?)';
  const rangePrefix = new RegExp(`^(?:从)?\\s*(?:${dayOrPeriod}\\s*)?(?:${clockToken})\\s*(?:到|至|~|～|-|—)\\s*(?:${dayOrPeriod}\\s*)?(?:${clockToken})\\s*`);
  const singlePrefix = new RegExp(`^(?:从)?\\s*(?:${dayOrPeriod}\\s*)?(?:${clockToken})\\s*`);
  const dayPrefix = new RegExp(`^(?:${dayOrPeriod})\\s*`);

  const candidate = source
    .replace(rangePrefix, '')
    .replace(singlePrefix, '')
    .replace(dayPrefix, '')
    .replace(/^[，,。.!?！？；;、\s]+/, '')
    .trim();

  if (!candidate) return undefined;
  if (candidate.length < 2) return undefined;
  return candidate;
}

function normalizeActivityContent(content: string, sourceText: string, lang: 'zh' | 'en' | 'it'): string {
  const base = (content || sourceText).trim();
  if (!base) return '';

  if (lang === 'zh') {
    const cleanedBase = base
      .replace(/^我在(?=[\u4e00-\u9fa5])/u, '')
      .replace(/^我(?!们)(?=[\u4e00-\u9fa5])/u, '')
      .replace(/^自己(?=[\u4e00-\u9fa5])/u, '')
      .trim();
    const recovered = recoverZhActivityFromSourceTimePrefix(cleanedBase, sourceText);
    const cleaned = (recovered || cleanedBase).trim();
    return cleaned || cleanedBase || base;
  }

  if (lang === 'en') {
    const cleaned = base.replace(/^I\s+(am\s+)?/i, '').trim();
    return cleaned || base;
  }

  const cleaned = base.replace(/^io\s+/i, '').trim();
  return cleaned || base;
}

function normalizeTodoContent(content: string, sourceText: string, lang: 'zh' | 'en' | 'it'): string {
  const base = (content || sourceText).trim();
  if (!base) return '';

  if (lang === 'zh') {
    const cleaned = base
      .replace(/^我(?=[\u4e00-\u9fa5])/u, '')
      .replace(/^自己(?=[\u4e00-\u9fa5])/u, '')
      .trim();
    return cleaned || base;
  }

  if (lang === 'en') {
    const cleaned = base.replace(/^I\s+/i, '').trim();
    return cleaned || base;
  }

  const cleaned = base.replace(/^io\s+/i, '').trim();
  return cleaned || base;
}

function hasTimeAnchor(segment: MagicPenAISegment): boolean {
  return Boolean(segment.startTime || segment.endTime || segment.timeSource || segment.periodLabel);
}

function isRealtimeAutoWriteCandidate(segment: MagicPenAISegment): boolean {
  if (segment.confidence !== 'high' && segment.confidence !== 'medium') return false;
  if (segment.timeRelation !== 'realtime') return false;
  if (segment.kind === 'mood') return true;
  if (segment.kind === 'activity') return !hasTimeAnchor(segment);
  return false;
}

function pushUnparsed(unparsedSegments: string[], content: string): void {
  const trimmed = content.trim();
  if (!trimmed) return;
  unparsedSegments.push(trimmed);
}

function mergeLinkedRealtimeCandidates(
  candidates: MagicPenParseResult['autoWriteItems'],
): MagicPenParseResult['autoWriteItems'] {
  const activity = candidates.find((item) => item.kind === 'activity');
  const mood = candidates.find((item) => item.kind === 'mood');

  if (!activity || !mood) {
    return candidates;
  }

  const sameSource = activity.sourceText.trim() && activity.sourceText.trim() === mood.sourceText.trim();
  if (!sameSource) {
    return candidates;
  }

  const mergedContent = [activity.content, mood.content]
    .map((item) => item.trim())
    .filter(Boolean)
    .join('，');

  return candidates
    .filter((item) => item.id !== mood.id)
    .map((item) => {
      if (item.id !== activity.id) return item;
      return {
        ...item,
        content: mergedContent || item.content,
        linkedMoodContent: mood.content,
      };
    });
}

export function buildDraftsFromAIResult(
  aiResult: MagicPenAIResult,
  today: Date,
  lang: 'zh' | 'en' | 'it' = 'zh',
): MagicPenParseResult {
  const drafts: MagicPenDraftItem[] = [];
  const unparsedSegments = [...aiResult.unparsed];
  const realtimeCandidates: MagicPenParseResult['autoWriteItems'] = [];

  for (const segment of aiResult.segments) {
    const sourceText = segment.sourceText || segment.text || '';
    const content = (segment.text || sourceText).trim();
    if (!content) {
      pushUnparsed(unparsedSegments, sourceText);
      continue;
    }

    if (segment.kind === 'mood' || segment.kind === 'activity') {
      if (isRealtimeAutoWriteCandidate(segment)) {
        realtimeCandidates.push({
          id: uuidv4(),
          kind: segment.kind,
          content,
          sourceText,
          confidence: segment.confidence || 'low',
        });
      } else if (segment.kind === 'activity' && hasTimeAnchor(segment)) {
        const normalizedActivityContent = normalizeActivityContent(content, sourceText, lang);
        const timeResolution = toActivityTimeResolutionFromSegment(segment);
        const dynamicPeriod = timeResolution === 'period'
          ? buildDynamicPeriodTime(segment, today, lang)
          : {};
        const startAt = timeResolution === 'period'
          ? dynamicPeriod.startAt
          : segment.startTime
            ? timeStringToEpoch(segment.startTime, today)
            : undefined;
        const endAt = timeResolution === 'period'
          ? dynamicPeriod.endAt
          : segment.endTime
            ? timeStringToEpoch(segment.endTime, today)
            : undefined;
        const hasValidStart = startAt !== undefined && Number.isFinite(startAt);
        const hasValidEnd = endAt !== undefined && Number.isFinite(endAt);
        const inferredExact = lang === 'zh' && (!hasValidStart || !hasValidEnd)
          ? inferZhExactRangeFromText(sourceText || content, today)
          : undefined;
        const resolvedStart = hasValidStart ? startAt : inferredExact?.startAt;
        const resolvedEnd = hasValidEnd ? endAt : inferredExact?.endAt;
        const resolvedHasStart = resolvedStart !== undefined && Number.isFinite(resolvedStart);
        const resolvedHasEnd = resolvedEnd !== undefined && Number.isFinite(resolvedEnd);
        const resolvedTimeResolution = (resolvedHasStart && resolvedHasEnd && timeResolution !== 'period')
          ? 'exact'
          : timeResolution;
        drafts.push({
          id: uuidv4(),
          kind: 'activity_backfill',
          content: normalizedActivityContent,
          sourceText,
          confidence: segment.confidence || 'low',
          needsUserConfirmation: true,
          errors: [],
          activity: {
            startAt: resolvedHasStart ? resolvedStart : undefined,
            endAt: resolvedHasEnd ? resolvedEnd : undefined,
            timeResolution: resolvedTimeResolution,
            suggestedTimeLabel: segment.periodLabel,
          },
        });
      } else {
        pushUnparsed(unparsedSegments, sourceText || content);
      }
      continue;
    }

    if (segment.kind === 'todo_add') {
      const dueDate = inferTodoDueDate(sourceText || content, today, lang);
      const normalizedTodoContent = normalizeTodoContent(content, sourceText, lang);
      drafts.push({
        id: uuidv4(),
        kind: 'todo_add',
        content: normalizedTodoContent,
        sourceText,
        confidence: segment.confidence || 'low',
        needsUserConfirmation: false,
        errors: [],
        todo: {
          priority: 'important-not-urgent',
          category: 'life',
          scope: 'daily',
          dueDate,
        },
      });
      continue;
    }

    if (segment.kind === 'activity_backfill') {
      const normalizedActivityContent = normalizeActivityContent(content, sourceText, lang);
      const timeResolution = toActivityTimeResolutionFromSegment(segment);
      const dynamicPeriod = timeResolution === 'period'
        ? buildDynamicPeriodTime(segment, today, lang)
        : {};
      const startAt = timeResolution === 'period'
        ? dynamicPeriod.startAt
        : segment.startTime
          ? timeStringToEpoch(segment.startTime, today)
          : undefined;
      const endAt = timeResolution === 'period'
        ? dynamicPeriod.endAt
        : segment.endTime
          ? timeStringToEpoch(segment.endTime, today)
          : undefined;
      const hasValidStart = startAt !== undefined && Number.isFinite(startAt);
      const hasValidEnd = endAt !== undefined && Number.isFinite(endAt);
      const inferredExact = lang === 'zh' && (!hasValidStart || !hasValidEnd)
        ? inferZhExactRangeFromText(sourceText || content, today)
        : undefined;
      const resolvedStart = hasValidStart ? startAt : inferredExact?.startAt;
      const resolvedEnd = hasValidEnd ? endAt : inferredExact?.endAt;
      const resolvedHasStart = resolvedStart !== undefined && Number.isFinite(resolvedStart);
      const resolvedHasEnd = resolvedEnd !== undefined && Number.isFinite(resolvedEnd);
      const resolvedTimeResolution = (resolvedHasStart && resolvedHasEnd && timeResolution !== 'period')
        ? 'exact'
        : timeResolution;
      drafts.push({
        id: uuidv4(),
        kind: 'activity_backfill',
        content: normalizedActivityContent,
        sourceText,
        confidence: segment.confidence || 'low',
        needsUserConfirmation: resolvedTimeResolution !== 'missing',
        errors: [],
        activity: {
          startAt: resolvedHasStart ? resolvedStart : undefined,
          endAt: resolvedHasEnd ? resolvedEnd : undefined,
          timeResolution: resolvedTimeResolution,
          suggestedTimeLabel: segment.periodLabel,
        },
      });
      continue;
    }

    pushUnparsed(unparsedSegments, sourceText || content);
  }

  const autoWriteItems = mergeLinkedRealtimeCandidates(realtimeCandidates);

  return {
    drafts,
    unparsedSegments,
    autoWriteItems,
  };
}

export function validateDrafts(
  drafts: MagicPenDraftItem[],
  messages: Message[],
  now: number = Date.now(),
): MagicPenDraftItem[] {
  const ongoingActivity = [...messages].reverse().find(
    (message) => message.mode === 'record' && !message.isMood && message.duration === undefined,
  );

  const validated = drafts.map((draft) => {
    if (draft.kind !== 'activity_backfill') return cloneDraftWithErrors(draft, []);
    const timeErrors = collectTimeErrors(draft, now);
    const overlapErrors = appendOngoingOverlapError(draft, ongoingActivity);
    return cloneDraftWithErrors(draft, [...timeErrors, ...overlapErrors]);
  });

  return markBatchOverlapErrors(validated);
}
