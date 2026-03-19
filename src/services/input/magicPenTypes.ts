// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/growth/GrowthPage.tsx
import type { Priority, TodoScope } from '../../store/useTodoStore';

export type MagicPenDraftKind = 'activity_backfill' | 'todo_add';
export type MagicPenParseKind = 'activity' | 'mood' | 'todo_add' | 'activity_backfill';
export type MagicPenDraftConfidence = 'high' | 'medium' | 'low';
export type MagicPenTimeRelation = 'realtime' | 'future' | 'past' | 'unknown';
export type MagicPenDraftErrorCode =
  | 'missing_time'
  | 'invalid_time_range'
  | 'future_time'
  | 'cross_day'
  | 'overlap_in_batch'
  | 'overlap_with_ongoing_activity';

export interface MagicPenActivityFields {
  startAt?: number;
  endAt?: number;
  timeResolution: 'exact' | 'period' | 'missing';
  suggestedTimeLabel?: string;
}

export interface MagicPenTodoFields {
  priority: Priority;
  category: string;
  scope: TodoScope;
  dueDate?: number;
}

export interface MagicPenDraftItem {
  id: string;
  kind: MagicPenDraftKind;
  content: string;
  sourceText: string;
  confidence: MagicPenDraftConfidence;
  needsUserConfirmation: boolean;
  errors: MagicPenDraftErrorCode[];
  activity?: MagicPenActivityFields;
  todo?: MagicPenTodoFields;
}

export interface MagicPenParseResult {
  drafts: MagicPenDraftItem[];
  unparsedSegments: string[];
  autoWriteItems: MagicPenAutoWriteItem[];
}

export interface MagicPenAutoWriteItem {
  id: string;
  kind: 'activity' | 'mood';
  content: string;
  sourceText: string;
  confidence: MagicPenDraftConfidence;
  linkedMoodContent?: string;
  source?: 'ai' | 'unparsed_promoted';
}

export interface MagicPenAutoWrittenItem {
  id: string;
  kind: 'activity' | 'mood';
  content: string;
  sourceText: string;
  messageId?: string;
  linkedMoodContent?: string;
}

export interface MagicPenAISegment {
  text: string;
  sourceText: string;
  kind: MagicPenParseKind;
  confidence: MagicPenDraftConfidence;
  timeRelation?: MagicPenTimeRelation;
  durationMinutes?: number;
  startTime?: string;
  endTime?: string;
  timeSource?: 'exact' | 'period' | 'inferred' | 'missing';
  periodLabel?: string;
}

export interface MagicPenAIResult {
  segments: MagicPenAISegment[];
  unparsed: string[];
}
