import type { AIAnnotation } from '../types/annotation';
import type { DailyPlantRecord } from '../types/plant';
import type { StardustMemory } from '../types/stardust';
import type { Message, MessageType } from '../store/useChatStore';
import type { Report } from '../store/useReportStore';
import type { Todo } from '../store/useTodoStore';

export type TodoUpdates = Partial<Omit<Todo, 'id' | 'createdAt'>>;

const TODO_DB_FIELD_MAP: Partial<Record<keyof TodoUpdates, string>> = {
  title: 'content',
  dueAt: 'due_date',
  completedAt: 'completed_at',
  isPinned: 'is_pinned',
  startedAt: 'started_at',
  bottleId: 'bottle_id',
  sortOrder: 'sort_order',
  isTemplate: 'is_template',
  templateId: 'template_id',
};

export function fromDbMessage(row: any): Message {
  return {
    id: row.id,
    content: row.content,
    timestamp: Number(row.timestamp),
    type: row.type as MessageType,
    duration: row.duration,
    activityType: row.activity_type,
    mode: (row.activity_type === 'chat' ? 'chat' : 'record') as 'chat' | 'record',
    isMood: row.is_mood || false,
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
  };
}

export function fromDbTodo(row: any): Todo {
  return {
    id: row.id,
    title: row.content,              // DB 'content' → app 'title'
    completed: row.completed,
    priority: row.priority,
    category: row.category,
    dueAt: row.due_date,             // DB 'due_date' → app 'dueAt'
    scope: row.scope,
    createdAt: row.created_at,
    recurrence: row.recurrence,
    recurrenceId: row.recurrence_id,
    completedAt: row.completed_at,
    isPinned: row.is_pinned || false,
    startedAt: row.started_at,
    duration: row.duration,
    bottleId: row.bottle_id,
    sortOrder: row.sort_order ?? row.due_date ?? Date.now(),
    isTemplate: row.is_template ?? false,
    templateId: row.template_id,
  };
}

export function toDbTodo(todo: Todo, userId: string): Record<string, unknown> {
  return {
    id: todo.id,
    content: todo.title,             // app 'title' → DB 'content'
    completed: todo.completed,
    priority: todo.priority,
    category: todo.category,
    due_date: todo.dueAt,            // app 'dueAt' → DB 'due_date'
    scope: todo.scope,
    created_at: todo.createdAt,
    recurrence: todo.recurrence,
    recurrence_id: todo.recurrenceId,
    completed_at: todo.completedAt,
    is_pinned: todo.isPinned,
    started_at: todo.startedAt,
    duration: todo.duration,
    bottle_id: todo.bottleId,
    sort_order: todo.sortOrder,
    is_template: todo.isTemplate,
    template_id: todo.templateId,
    user_id: userId,
  };
}

export function toDbTodoUpdates(updates: TodoUpdates): Record<string, unknown> {
  const dbUpdates: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates) as [keyof TodoUpdates, TodoUpdates[keyof TodoUpdates]][]) {
    const mappedKey = TODO_DB_FIELD_MAP[key] || key;
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
    displayDuration: 8000,
    syncedToCloud: true,
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
