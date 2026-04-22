import type { AIAnnotation } from '../types/annotation';
import type { DailyPlantRecord } from '../types/plant';
import type { StardustMemory } from '../types/stardust';
import { normalizeActivityType, normalizeTodoCategory } from './activityType';
import type { Message, MessageType, MoodDescription } from '../store/useChatStore';
import type { Report } from '../store/useReportStore';
import type { Todo } from '../store/useTodoStore';

export type TodoUpdates = Partial<Omit<Todo, 'id' | 'createdAt'>>;

const BIGINT_JS_SAFE_MIN = -9_000_000_000_000_000;
const BIGINT_JS_SAFE_MAX = 9_000_000_000_000_000;

function normalizeBigintLike(raw: unknown): number | null {
  if (raw == null) return null;

  const numeric = typeof raw === 'number'
    ? raw
    : (typeof raw === 'string' ? Number(raw.trim()) : Number.NaN);

  if (!Number.isFinite(numeric)) return null;

  const truncated = Math.trunc(numeric);
  if (truncated < BIGINT_JS_SAFE_MIN) return BIGINT_JS_SAFE_MIN;
  if (truncated > BIGINT_JS_SAFE_MAX) return BIGINT_JS_SAFE_MAX;
  return truncated;
}

/** 安全解析 mood_descriptions JSONB 字段，容错脏数据 */
export function safeParseMoodDescriptions(raw: unknown): MoodDescription[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw as MoodDescription[];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

function normalizeRecurrenceDays(raw: unknown): number[] | undefined {
  if (raw == null) return undefined;

  const values = Array.isArray(raw)
    ? raw
    : (typeof raw === 'string'
      ? raw.replace(/[{}]/g, '').split(',').filter(Boolean)
      : []);

  const normalized = Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
    ),
  ).sort((left, right) => left - right);

  return normalized.length > 0 ? normalized : undefined;
}

function toTimestampMs(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const normalized = raw < 1e11 ? raw * 1000 : raw;
    const safe = normalizeBigintLike(normalized);
    return safe == null ? undefined : safe;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      const normalized = numeric < 1e11 ? numeric * 1000 : numeric;
      const safe = normalizeBigintLike(normalized);
      return safe == null ? undefined : safe;
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

const TODO_DB_FIELD_MAP: Partial<Record<keyof TodoUpdates, string>> = {
  title: 'content',
  dueAt: 'due_date',
  completedAt: 'completed_at',
  isPinned: 'is_pinned',
  startedAt: 'started_at',
  recurrenceDays: 'recurrence_days',
  bottleId: 'bottle_id',
  sortOrder: 'sort_order',
  isTemplate: 'is_template',
  templateId: 'template_id',
  parentId: 'parent_id',
  suggestedDuration: 'suggested_duration',
};

export function fromDbMessage(row: any): Message {
  return {
    id: row.id,
    content: row.content,
    timestamp: Number(row.timestamp),
    type: row.type as MessageType,
    duration: row.duration ?? undefined,
    activityType: normalizeActivityType(row.activity_type, row.content),
    mode: 'record',
    isMood: row.is_mood || false,
    // ★ v1.2 新增字段
    imageUrl: row.image_url ?? null,
    imageUrl2: row.image_url_2 ?? null,
    moodDescriptions: safeParseMoodDescriptions(row.mood_descriptions),
    isActive: row.is_active ?? false,
    detached: row.detached ?? false,
    syncState: 'synced',
    syncError: null,
  };
}

export function toDbMessage(message: Message, userId: string): Record<string, unknown> {
  return {
    id: message.id,
    content: message.content,
    timestamp: message.timestamp,
    type: message.type,
    duration: message.duration,
    activity_type: message.activityType,
    is_mood: message.isMood || false,
    user_id: userId,
    // ★ v1.2 新增字段
    image_url: message.imageUrl ?? null,
    image_url_2: message.imageUrl2 ?? null,
    mood_descriptions: message.moodDescriptions ?? null,
    is_active: message.isActive ?? false,
    detached: message.detached ?? false,
  };
}

export function fromDbTodo(row: any): Todo {
  const createdAt = toTimestampMs(row.created_at) ?? Date.now();
  const dueAt = toTimestampMs(row.due_date);
  const completedAt = toTimestampMs(row.completed_at);
  const startedAt = toTimestampMs(row.started_at);
  const rawSortOrder = row.sort_order;
  const sortOrder = (typeof rawSortOrder === 'number' && Number.isFinite(rawSortOrder))
    ? rawSortOrder
    : (dueAt ?? createdAt);

  return {
    id: row.id,
    title: row.content,              // DB 'content' → app 'title'
    completed: row.completed,
    priority: row.priority,
    category: normalizeTodoCategory(row.category, row.content),
    dueAt,                           // DB 'due_date' → app 'dueAt'
    scope: row.scope,
    createdAt,
    recurrence: row.recurrence,
    recurrenceDays: normalizeRecurrenceDays(row.recurrence_days),
    recurrenceId: row.recurrence_id,
    completedAt,
    isPinned: row.is_pinned || false,
    startedAt,
    duration: row.duration,
    bottleId: row.bottle_id,
    sortOrder,
    isTemplate: row.is_template ?? false,
    templateId: row.template_id,
    parentId: row.parent_id ?? undefined,
    suggestedDuration: row.suggested_duration ?? undefined,
    syncState: 'synced',             // 从云端来的都是已同步状态
  };
}

export function toDbTodo(todo: Todo, userId: string): Record<string, unknown> {
  const createdAt = normalizeBigintLike(todo.createdAt) ?? Math.trunc(Date.now());
  const sortOrder = normalizeBigintLike(todo.sortOrder) ?? createdAt;

  return {
    id: todo.id,
    content: todo.title,             // app 'title' → DB 'content'
    completed: todo.completed,
    priority: todo.priority,
    category: todo.category,
    due_date: normalizeBigintLike(todo.dueAt), // app 'dueAt' → DB 'due_date'
    scope: todo.scope,
    created_at: createdAt,
    recurrence: todo.recurrence,
    recurrence_days: normalizeRecurrenceDays(todo.recurrenceDays) ?? null,
    recurrence_id: todo.recurrenceId,
    completed_at: normalizeBigintLike(todo.completedAt),
    is_pinned: todo.isPinned,
    started_at: normalizeBigintLike(todo.startedAt),
    duration: todo.duration,
    bottle_id: todo.bottleId,
    sort_order: sortOrder,
    is_template: todo.isTemplate,
    template_id: todo.templateId,
    parent_id: todo.parentId ?? null,
    suggested_duration: todo.suggestedDuration ?? null,
    user_id: userId,
    deleted_at: null,                // 明确标记为未删除
    updated_at: new Date().toISOString(),
  };
}

export function toDbTodoUpdates(updates: TodoUpdates): Record<string, unknown> {
  const dbUpdates: Record<string, unknown> = {};
  const bigintKeys = new Set<keyof TodoUpdates>(['dueAt', 'completedAt', 'startedAt', 'sortOrder']);

  for (const [key, value] of Object.entries(updates) as [keyof TodoUpdates, TodoUpdates[keyof TodoUpdates]][]) {
    const mappedKey = TODO_DB_FIELD_MAP[key] || key;
    if (key === 'recurrenceDays') {
      dbUpdates[mappedKey] = normalizeRecurrenceDays(value) ?? null;
      continue;
    }
    if (bigintKeys.has(key)) {
      dbUpdates[mappedKey] = value === undefined ? null : normalizeBigintLike(value);
      continue;
    }
    dbUpdates[mappedKey] = value === undefined ? null : value;
  }

  return dbUpdates;
}

export function fromDbReport(row: any): Report {
  return {
    id: row.id,
    title: row.title,
    date: Number(row.date),
    startDate: row.start_date ? Number(row.start_date) : undefined,
    endDate: row.end_date ? Number(row.end_date) : undefined,
    type: row.type,
    content: row.content,
    aiAnalysis: row.ai_analysis,
    teaserText: row.teaser_text ?? null,
    userNote: row.user_note ?? undefined,
    stats: row.stats,
    analysisStatus: row.ai_analysis ? 'success' : 'idle',
    errorMessage: null,
  };
}

export function toDbReport(report: Report, userId: string): Record<string, unknown> {
  return {
    id: report.id,
    user_id: userId,
    title: report.title,
    date: report.date,
    start_date: report.startDate,
    end_date: report.endDate,
    type: report.type,
    content: report.content,
    ai_analysis: report.aiAnalysis,
    teaser_text: report.teaserText,
    user_note: report.userNote,
    stats: report.stats,
  };
}

export function fromDbStardust(row: any): StardustMemory {
  return {
    id: row.id,
    messageId: row.message_id,
    userId: row.user_id,
    message: row.message,
    emojiChar: row.emoji_char,
    userRawContent: row.user_raw_content,
    createdAt: new Date(row.created_at).getTime(),
    alienName: row.alien_name,
    syncStatus: 'synced',
  };
}

export function toDbStardust(memory: StardustMemory): Record<string, unknown> {
  return {
    id: memory.id,
    message_id: memory.messageId,
    user_id: memory.userId,
    message: memory.message,
    emoji_char: memory.emojiChar,
    user_raw_content: memory.userRawContent,
    created_at: new Date(memory.createdAt).toISOString(),
    alien_name: memory.alienName,
  };
}

export function fromDbAnnotation(row: any): AIAnnotation {
  return {
    id: row.id,
    content: row.content,
    tone: row.tone,
    timestamp: row.event_timestamp,
    relatedEvent: row.related_event,
    todayContext: row.today_context ?? undefined,
    displayDuration: 8000,
    syncedToCloud: true,
    suggestionAccepted: typeof row.suggestion_accepted === 'boolean' ? row.suggestion_accepted : undefined,
  };
}

export function toDbAnnotation(annotation: AIAnnotation, userId: string): Record<string, unknown> {
  return {
    id: annotation.id,
    user_id: userId,
    content: annotation.content,
    tone: annotation.tone,
    event_timestamp: annotation.timestamp,
    related_event: annotation.relatedEvent,
    today_context: annotation.todayContext ?? null,
    suggestion_accepted: annotation.suggestionAccepted ?? null,
    created_at: new Date(annotation.timestamp).toISOString(),
  };
}

export function fromDbPlantRecord(row: any): DailyPlantRecord {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    timezone: row.timezone,
    rootMetrics: {
      dominantRatio: Number(row.root_metrics?.dominant_ratio ?? 0),
      top2Gap: Number(row.root_metrics?.top2_gap ?? 0),
      depthScore: Number(row.root_metrics?.depth_score ?? 0),
      evenness: Number(row.root_metrics?.evenness ?? 0),
      branchiness: Number(row.root_metrics?.branchiness ?? 0),
      totalMinutes: Number(row.root_metrics?.total_minutes ?? 0),
      activeTargetDirections: Number(row.root_metrics?.active_target_directions ?? 0),
      directionBreakdown: row.root_metrics?.direction_breakdown ?? {},
    },
    rootType: row.root_type,
    plantId: row.plant_id,
    plantStage: row.plant_stage,
    isSpecial: Boolean(row.is_special),
    isSupportVariant: Boolean(row.is_support_variant),
    diaryText: row.diary_text ?? undefined,
    generatedAt: row.generated_at ? new Date(row.generated_at).getTime() : Date.now(),
    cycleId: row.cycle_id ?? null,
  };
}

export function toDbPlantRecord(record: DailyPlantRecord, userId: string): Record<string, unknown> {
  return {
    id: record.id,
    user_id: userId,
    date: record.date,
    timezone: record.timezone,
    root_metrics: {
      dominant_ratio: record.rootMetrics.dominantRatio,
      top2_gap: record.rootMetrics.top2Gap,
      depth_score: record.rootMetrics.depthScore,
      evenness: record.rootMetrics.evenness,
      branchiness: record.rootMetrics.branchiness,
      total_minutes: record.rootMetrics.totalMinutes,
      active_target_directions: record.rootMetrics.activeTargetDirections,
      direction_breakdown: record.rootMetrics.directionBreakdown,
    },
    root_type: record.rootType,
    plant_id: record.plantId,
    plant_stage: record.plantStage,
    is_special: record.isSpecial,
    is_support_variant: record.isSupportVariant,
    diary_text: record.diaryText ?? null,
    generated_at: new Date(record.generatedAt).toISOString(),
    cycle_id: record.cycleId ?? null,
  };
}
