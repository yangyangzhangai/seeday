// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/todo/README.md
import type { Message } from '../../store/useChatStore';
import { v4 as uuidv4 } from 'uuid';
import type {
  MagicPenAIResult,
  MagicPenDraftErrorCode,
  MagicPenDraftItem,
  MagicPenParseResult,
} from './magicPenTypes';
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

function toActivityTimeResolution(timeSource?: 'exact' | 'period' | 'missing'): 'exact' | 'period' | 'missing' {
  if (timeSource === 'exact' || timeSource === 'period') return timeSource;
  return 'missing';
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

export function buildDraftsFromAIResult(aiResult: MagicPenAIResult, today: Date): MagicPenParseResult {
  const drafts: MagicPenDraftItem[] = [];
  const unparsedSegments = [...aiResult.unparsed];

  for (const segment of aiResult.segments) {
    const sourceText = segment.sourceText || segment.text || '';
    const content = (segment.text || sourceText).trim();
    if (!content) {
      if (sourceText.trim()) unparsedSegments.push(sourceText);
      continue;
    }

    if (segment.kind === 'todo_add') {
      drafts.push({
        id: uuidv4(),
        kind: 'todo_add',
        content,
        sourceText,
        confidence: segment.confidence || 'low',
        needsUserConfirmation: false,
        errors: [],
        todo: {
          priority: 'important-not-urgent',
          category: 'life',
          scope: 'daily',
        },
      });
      continue;
    }

    if (segment.kind === 'activity_backfill') {
      const startAt = segment.startTime ? timeStringToEpoch(segment.startTime, today) : undefined;
      const endAt = segment.endTime ? timeStringToEpoch(segment.endTime, today) : undefined;
      const hasValidStart = startAt !== undefined && Number.isFinite(startAt);
      const hasValidEnd = endAt !== undefined && Number.isFinite(endAt);
      const timeResolution = toActivityTimeResolution(segment.timeSource);
      drafts.push({
        id: uuidv4(),
        kind: 'activity_backfill',
        content,
        sourceText,
        confidence: segment.confidence || 'low',
        needsUserConfirmation: timeResolution !== 'missing',
        errors: [],
        activity: {
          startAt: hasValidStart ? startAt : undefined,
          endAt: hasValidEnd ? endAt : undefined,
          timeResolution,
          suggestedTimeLabel: segment.periodLabel,
        },
      });
      continue;
    }

    if (sourceText.trim()) {
      unparsedSegments.push(sourceText);
    }
  }

  return {
    drafts,
    unparsedSegments,
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
