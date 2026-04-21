import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jsonError } from './http.js';
import { isLiveInputAdminUser, requireSupabaseRequestAuth } from './supabase-request-auth.js';
import type {
  LiveInputTelemetryBreakdownItem,
  LiveInputTelemetryDashboardResponse,
  LiveInputTelemetryRecentEvent,
  LiveInputTelemetrySeriesPoint,
  TodoDecomposeTelemetrySeriesPoint,
} from '../services/input/liveInputTelemetryApi.js';

interface LiveInputEventRow {
  id: string;
  created_at: string;
  user_id: string;
  event_type: 'classification' | 'correction';
  raw_input: string | null;
  input_length: number | null;
  kind: string | null;
  internal_kind: string | null;
  confidence: string | null;
  reasons: unknown;
  from_kind: string | null;
  to_kind: string | null;
  lang: string | null;
}

interface PlantAssetEventRow {
  id: string;
  created_at: string;
  user_id: string;
  requested_plant_id: string | null;
  resolved_asset_url: string | null;
  fallback_level: number | null;
  root_type: string | null;
  plant_stage: string | null;
  lang: string | null;
}

interface DiaryStickerEventRow {
  id?: unknown;
  created_at?: unknown;
  user_id?: unknown;
  event_name?: unknown;
  event_data?: unknown;
  lang?: unknown;
}

const ANNOTATION_EVENT_NAMES = new Set([
  'density_scored',
  'trigger_blocked',
  'event_triggered',
  'event_condensed',
  'lateral_sampled',
]);

const TODO_DECOMPOSE_EVENT_NAMES = new Set([
  'todo_decompose_requested',
  'todo_decompose_succeeded',
  'todo_decompose_empty',
  'todo_decompose_parse_failed',
  'todo_decompose_failed',
  'todo_decompose_regenerate_clicked',
]);

function parseNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function parseBoolean(raw: unknown): boolean | null {
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

function toScoreBucketKey(score: number): string {
  const normalized = Math.max(0, Math.min(1, score));
  const start = Math.floor(normalized * 10) / 10;
  const end = Math.min(1, start + 0.1);
  return `${start.toFixed(1)}-${end.toFixed(1)}`;
}

function isMissingOptionalTableError(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) {
    return false;
  }

  if (error.code === '42P01' || error.code === 'PGRST205') {
    return true;
  }

  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return message.includes('does not exist') || message.includes('schema cache');
}

function parseDays(raw: unknown): number {
  const value = typeof raw === 'string' ? Number(raw) : Number(raw);
  if (!Number.isFinite(value)) {
    return 14;
  }

  return Math.min(Math.max(Math.round(value), 1), 90);
}

function parseReasons(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string');
  }

  return [];
}

function parseOptionalString(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((item): item is string => typeof item === 'string');
}

function parseEventData(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  return {};
}

function toBreakdownItems(counts: Map<string, number>, total: number): LiveInputTelemetryBreakdownItem[] {
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([key, count]) => ({
      key,
      count,
      percent: total > 0 ? count / total : 0,
    }));
}

function createDateSeries(days: number): LiveInputTelemetrySeriesPoint[] {
  const points: LiveInputTelemetrySeriesPoint[] = [];
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - offset);
    points.push({
      day: date.toISOString().slice(0, 10),
      classificationCount: 0,
      correctionCount: 0,
      plantAssetCount: 0,
      diaryStickerCount: 0,
      uniqueUsers: 0,
    });
  }

  return points;
}

function createTodoDecomposeSeries(days: number): TodoDecomposeTelemetrySeriesPoint[] {
  const points: TodoDecomposeTelemetrySeriesPoint[] = [];
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - offset);
    points.push({
      day: date.toISOString().slice(0, 10),
      requestedCount: 0,
      succeededCount: 0,
      emptyCount: 0,
      parseFailedCount: 0,
      failedCount: 0,
      regenerateCount: 0,
    });
  }

  return points;
}

export async function handleLiveInputDashboard(req: VercelRequest, res: VercelResponse): Promise<void> {
  const auth = await requireSupabaseRequestAuth(req, res);
  if (!auth) {
    return;
  }

  if (!isLiveInputAdminUser(auth.user)) {
    jsonError(res, 403, 'Forbidden');
    return;
  }

  if (!auth.adminClient) {
    jsonError(res, 500, 'Missing SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const days = parseDays(req.query.days);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await auth.adminClient
    .from('live_input_events')
    .select('id, created_at, user_id, event_type, raw_input, input_length, kind, internal_kind, confidence, reasons, from_kind, to_kind, lang')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10000);

  if (error) {
    jsonError(res, 500, 'Failed to load live input telemetry dashboard', error.message);
    return;
  }

  const { data: plantRows, error: plantError } = await auth.adminClient
    .from('plant_asset_events')
    .select('id, created_at, user_id, requested_plant_id, resolved_asset_url, fallback_level, root_type, plant_stage, lang')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10000);

  if (plantError && !isMissingOptionalTableError(plantError)) {
    jsonError(res, 500, 'Failed to load plant asset telemetry dashboard', plantError.message);
    return;
  }

  const { data: diaryRows, error: diaryError } = await auth.adminClient
    .from('telemetry_events')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10000);

  if (diaryError && !isMissingOptionalTableError(diaryError)) {
    jsonError(res, 500, 'Failed to load diary sticker telemetry dashboard', diaryError.message);
    return;
  }

  const events = (rows || []) as LiveInputEventRow[];
  const plantAssetEvents = (plantRows || []) as PlantAssetEventRow[];
  const byInternalKind = new Map<string, number>();
  const correctionPaths = new Map<string, number>();
  const topReasons = new Map<string, number>();
  const byLang = new Map<string, number>();
  const plantFallbackLevels = new Map<string, number>();
  const diaryStickerActions = new Map<string, number>();
  const annotationEventNames = new Map<string, number>();
  const annotationCharacters = new Map<string, number>();
  const associationTypes = new Map<string, number>();
  const narrativeScoreBuckets = new Map<string, { count: number; triggeredCount: number }>();
  const todoDecomposeEventNames = new Map<string, number>();
  const todoDecomposeByLang = new Map<string, number>();
  const todoDecomposeByModel = new Map<string, number>();
  const uniqueUsers = new Set<string>();
  const series = createDateSeries(days);
  const seriesMap = new Map(series.map((point) => [point.day, { ...point, userIds: new Set<string>() }]));
  const todoDecomposeSeries = createTodoDecomposeSeries(days);
  const todoDecomposeSeriesMap = new Map(todoDecomposeSeries.map((point) => [point.day, { ...point }]));
  const uniqueDecomposedTodos = new Set<string>();

  let classificationCount = 0;
  let correctionCount = 0;
  let plantAssetCount = 0;
  let diaryStickerCount = 0;
  let annotationTelemetryCount = 0;
  let densityScoredCount = 0;
  let triggerBlockedCount = 0;
  let eventTriggeredCount = 0;
  let eventCondensedCount = 0;
  let lateralSampledCount = 0;
  let lateralTriggeredCount = 0;
  let narrativeScoreSum = 0;
  let narrativeScoreCount = 0;
  let finalProbabilitySum = 0;
  let finalProbabilityCount = 0;
  let plantExactHitCount = 0;
  let todoDecomposeRequestedCount = 0;
  let todoDecomposeSucceededCount = 0;
  let todoDecomposeEmptyCount = 0;
  let todoDecomposeParseFailedCount = 0;
  let todoDecomposeFailedCount = 0;
  let todoDecomposeRegenerateCount = 0;
  let todoDecomposeStepsTotal = 0;

  for (const event of events) {
    uniqueUsers.add(event.user_id);
    const day = event.created_at.slice(0, 10);
    const seriesEntry = seriesMap.get(day);
    if (seriesEntry) {
      seriesEntry.userIds.add(event.user_id);
    }

    if (event.event_type === 'classification') {
      classificationCount += 1;
      const internalKind = event.internal_kind || 'unknown';
      byInternalKind.set(internalKind, (byInternalKind.get(internalKind) ?? 0) + 1);

      const lang = event.lang || 'unknown';
      byLang.set(lang, (byLang.get(lang) ?? 0) + 1);

      if (seriesEntry) {
        seriesEntry.classificationCount += 1;
      }

      for (const reason of parseReasons(event.reasons)) {
        topReasons.set(reason, (topReasons.get(reason) ?? 0) + 1);
      }
      continue;
    }

    if (event.event_type === 'correction') {
      correctionCount += 1;
      const path = `${event.from_kind || 'unknown'}->${event.to_kind || 'unknown'}`;
      correctionPaths.set(path, (correctionPaths.get(path) ?? 0) + 1);

      if (seriesEntry) {
        seriesEntry.correctionCount += 1;
      }
    }
  }

  for (const event of plantAssetEvents) {
    uniqueUsers.add(event.user_id);
    const day = event.created_at.slice(0, 10);
    const seriesEntry = seriesMap.get(day);
    if (seriesEntry) {
      seriesEntry.userIds.add(event.user_id);
      seriesEntry.plantAssetCount += 1;
    }

    plantAssetCount += 1;
    const fallbackLevel = event.fallback_level === 1 || event.fallback_level === 2 || event.fallback_level === 3 || event.fallback_level === 4
      ? event.fallback_level
      : 4;
    if (fallbackLevel === 1) {
      plantExactHitCount += 1;
    }

    const lang = event.lang || 'unknown';
    byLang.set(lang, (byLang.get(lang) ?? 0) + 1);
    const key = `L${fallbackLevel}`;
    plantFallbackLevels.set(key, (plantFallbackLevels.get(key) ?? 0) + 1);
  }

  const diaryStickerEvents: LiveInputTelemetryRecentEvent[] = [];
  const annotationTelemetryEvents: LiveInputTelemetryRecentEvent[] = [];
  const todoDecomposeEvents: LiveInputTelemetryRecentEvent[] = [];
  for (const event of (diaryRows || []) as DiaryStickerEventRow[]) {
    const eventName = parseOptionalString(event.event_name);
    if (!eventName) {
      continue;
    }

    const id = parseOptionalString(event.id);
    const createdAt = parseOptionalString(event.created_at);
    const userId = parseOptionalString(event.user_id);
    if (!id || !createdAt || !userId) {
      continue;
    }

    const eventData = parseEventData(event.event_data);
    const day = createdAt.slice(0, 10);
    const seriesEntry = seriesMap.get(day);
    if (seriesEntry) {
      seriesEntry.userIds.add(userId);
    }

    uniqueUsers.add(userId);
    const lang = parseOptionalString(event.lang) || parseOptionalString(eventData.lang) || 'unknown';
    byLang.set(lang, (byLang.get(lang) ?? 0) + 1);

    if (TODO_DECOMPOSE_EVENT_NAMES.has(eventName)) {
      const todoId = parseOptionalString(eventData.todoId);
      const model = parseOptionalString(eventData.model) || 'unknown';
      const isRegenerate = parseBoolean(eventData.isRegenerate);
      const stepsCount = parseNumber(eventData.stepsCount);
      const todoSeriesEntry = todoDecomposeSeriesMap.get(day);
      if (todoSeriesEntry) {
        if (eventName === 'todo_decompose_requested') todoSeriesEntry.requestedCount += 1;
        if (eventName === 'todo_decompose_succeeded') todoSeriesEntry.succeededCount += 1;
        if (eventName === 'todo_decompose_empty') todoSeriesEntry.emptyCount += 1;
        if (eventName === 'todo_decompose_parse_failed') todoSeriesEntry.parseFailedCount += 1;
        if (eventName === 'todo_decompose_failed') todoSeriesEntry.failedCount += 1;
        if (eventName === 'todo_decompose_regenerate_clicked') todoSeriesEntry.regenerateCount += 1;
      }

      todoDecomposeEventNames.set(eventName, (todoDecomposeEventNames.get(eventName) ?? 0) + 1);
      todoDecomposeByLang.set(lang, (todoDecomposeByLang.get(lang) ?? 0) + 1);
      todoDecomposeByModel.set(model, (todoDecomposeByModel.get(model) ?? 0) + 1);

      if (eventName === 'todo_decompose_requested') todoDecomposeRequestedCount += 1;
      if (eventName === 'todo_decompose_succeeded') {
        todoDecomposeSucceededCount += 1;
        if (typeof stepsCount === 'number') {
          todoDecomposeStepsTotal += stepsCount;
        }
        if (todoId) {
          uniqueDecomposedTodos.add(todoId);
        }
      }
      if (eventName === 'todo_decompose_empty') todoDecomposeEmptyCount += 1;
      if (eventName === 'todo_decompose_parse_failed') todoDecomposeParseFailedCount += 1;
      if (eventName === 'todo_decompose_failed') todoDecomposeFailedCount += 1;
      if (eventName === 'todo_decompose_regenerate_clicked') todoDecomposeRegenerateCount += 1;

      todoDecomposeEvents.push({
        id,
        createdAt,
        userId,
        eventType: 'todo_decompose',
        kind: null,
        internalKind: null,
        confidence: null,
        reasons: [],
        fromKind: null,
        toKind: null,
        fallbackLevel: null,
        requestedPlantId: null,
        resolvedAssetUrl: null,
        rootType: null,
        plantStage: null,
        eventName,
        lang,
        inputLength: 0,
        inputPreview: parseOptionalString(eventData.entry),
        todoId,
        isRegenerate,
        model,
        provider: parseOptionalString(eventData.provider),
        stepsCount,
      });
      continue;
    }

    if (eventName.startsWith('diary_sticker_')) {
      if (seriesEntry) {
        seriesEntry.diaryStickerCount += 1;
      }

      diaryStickerCount += 1;
      diaryStickerActions.set(eventName, (diaryStickerActions.get(eventName) ?? 0) + 1);

      const newOrder = parseStringArray(eventData.newOrder);
      diaryStickerEvents.push({
        id,
        createdAt,
        userId,
        eventType: 'diary_sticker',
        kind: null,
        internalKind: null,
        confidence: null,
        reasons: [],
        fromKind: null,
        toKind: null,
        fallbackLevel: null,
        requestedPlantId: null,
        resolvedAssetUrl: null,
        rootType: null,
        plantStage: null,
        eventName,
        reportId: parseOptionalString(eventData.reportId),
        reportDate: parseOptionalString(eventData.date),
        stickerId: parseOptionalString(eventData.stickerId),
        newOrder: newOrder.length > 0 ? newOrder : null,
        lang,
        inputLength: 0,
        inputPreview: parseOptionalString(eventData.source),
      });
      continue;
    }

    if (!ANNOTATION_EVENT_NAMES.has(eventName)) {
      continue;
    }

    annotationTelemetryCount += 1;
    annotationEventNames.set(eventName, (annotationEventNames.get(eventName) ?? 0) + 1);

    if (eventName === 'density_scored') densityScoredCount += 1;
    if (eventName === 'trigger_blocked') triggerBlockedCount += 1;
    if (eventName === 'event_triggered') eventTriggeredCount += 1;
    if (eventName === 'event_condensed') eventCondensedCount += 1;
    if (eventName === 'lateral_sampled') lateralSampledCount += 1;

    const narrativeScore = parseNumber(eventData.currentScore ?? eventData.narrativeScore);
    if (narrativeScore !== null) {
      narrativeScoreSum += narrativeScore;
      narrativeScoreCount += 1;
      const key = toScoreBucketKey(narrativeScore);
      const prev = narrativeScoreBuckets.get(key) || { count: 0, triggeredCount: 0 };
      prev.count += 1;
      const triggered = parseBoolean(eventData.triggered) ?? false;
      if (triggered) prev.triggeredCount += 1;
      narrativeScoreBuckets.set(key, prev);
    }

    const finalProbability = parseNumber(eventData.finalProbability);
    if (finalProbability !== null) {
      finalProbabilitySum += finalProbability;
      finalProbabilityCount += 1;
    }

    const triggered = parseBoolean(eventData.triggered);
    if (triggered) lateralTriggeredCount += 1;

    const characterId = parseOptionalString(eventData.characterId);
    if (characterId) {
      annotationCharacters.set(characterId, (annotationCharacters.get(characterId) ?? 0) + 1);
    }

    const associationType = parseOptionalString(eventData.associationType);
    if (associationType) {
      associationTypes.set(associationType, (associationTypes.get(associationType) ?? 0) + 1);
    }

    annotationTelemetryEvents.push({
      id,
      createdAt,
      userId,
      eventType: 'annotation_telemetry',
      kind: null,
      internalKind: null,
      confidence: null,
      reasons: [],
      fromKind: null,
      toKind: null,
      fallbackLevel: null,
      requestedPlantId: null,
      resolvedAssetUrl: null,
      rootType: null,
      plantStage: null,
      eventName,
      lang,
      inputLength: 0,
      inputPreview: parseOptionalString(eventData.blockedReason),
      narrativeScore,
      finalProbability,
      triggered,
      characterId,
      associationType,
    });
  }

  const normalizedSeries: LiveInputTelemetrySeriesPoint[] = series.map((point) => {
    const current = seriesMap.get(point.day);
    return {
      day: point.day,
      classificationCount: current?.classificationCount ?? 0,
      correctionCount: current?.correctionCount ?? 0,
      plantAssetCount: current?.plantAssetCount ?? 0,
      diaryStickerCount: current?.diaryStickerCount ?? 0,
      uniqueUsers: current?.userIds.size ?? 0,
    };
  });

  const normalizedTodoDecomposeSeries: TodoDecomposeTelemetrySeriesPoint[] = todoDecomposeSeries.map((point) => {
    const current = todoDecomposeSeriesMap.get(point.day);
    return {
      day: point.day,
      requestedCount: current?.requestedCount ?? 0,
      succeededCount: current?.succeededCount ?? 0,
      emptyCount: current?.emptyCount ?? 0,
      parseFailedCount: current?.parseFailedCount ?? 0,
      failedCount: current?.failedCount ?? 0,
      regenerateCount: current?.regenerateCount ?? 0,
    };
  });

  const recentEvents: LiveInputTelemetryRecentEvent[] = ([
    ...events.map((event) => ({
      id: event.id,
      createdAt: event.created_at,
      userId: event.user_id,
      eventType: event.event_type,
      kind: (event.kind as LiveInputTelemetryRecentEvent['kind']) ?? null,
      internalKind: (event.internal_kind as LiveInputTelemetryRecentEvent['internalKind']) ?? null,
      confidence: (event.confidence as LiveInputTelemetryRecentEvent['confidence']) ?? null,
      reasons: parseReasons(event.reasons),
      fromKind: (event.from_kind as LiveInputTelemetryRecentEvent['fromKind']) ?? null,
      toKind: (event.to_kind as LiveInputTelemetryRecentEvent['toKind']) ?? null,
      fallbackLevel: null,
      requestedPlantId: null,
      resolvedAssetUrl: null,
      rootType: null,
      plantStage: null,
      lang: event.lang,
      inputLength: event.input_length ?? 0,
      inputPreview: event.raw_input ? event.raw_input.slice(0, 120) : null,
    })),
    ...plantAssetEvents.map((event) => {
      const fallbackLevel = event.fallback_level === 1 || event.fallback_level === 2 || event.fallback_level === 3 || event.fallback_level === 4
        ? event.fallback_level
        : 4;
      return {
        id: event.id,
        createdAt: event.created_at,
        userId: event.user_id,
        eventType: 'plant_asset' as const,
        kind: null,
        internalKind: null,
        confidence: null,
        reasons: [],
        fromKind: null,
        toKind: null,
        fallbackLevel,
        requestedPlantId: event.requested_plant_id,
        resolvedAssetUrl: event.resolved_asset_url,
        rootType: event.root_type,
        plantStage: event.plant_stage,
        lang: event.lang,
        inputLength: 0,
        inputPreview: event.resolved_asset_url,
      };
    }),
    ...diaryStickerEvents,
    ...annotationTelemetryEvents,
    ...todoDecomposeEvents,
  ] as LiveInputTelemetryRecentEvent[])
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 50);

  const payload: LiveInputTelemetryDashboardResponse = {
    success: true,
    summary: {
      days,
      classificationCount,
      correctionCount,
      plantAssetCount,
      diaryStickerCount,
      correctionRate: classificationCount > 0 ? correctionCount / classificationCount : 0,
      plantExactHitRate: plantAssetCount > 0 ? plantExactHitCount / plantAssetCount : 0,
      uniqueUsers: uniqueUsers.size,
    },
    byInternalKind: toBreakdownItems(byInternalKind, classificationCount),
    correctionPaths: toBreakdownItems(correctionPaths, correctionCount),
    topReasons: toBreakdownItems(topReasons, classificationCount),
    byLang: toBreakdownItems(
      byLang,
      classificationCount + correctionCount + plantAssetCount + diaryStickerCount + annotationTelemetryCount,
    ),
    plantFallbackLevels: toBreakdownItems(plantFallbackLevels, plantAssetCount),
    diaryStickerActions: toBreakdownItems(diaryStickerActions, diaryStickerCount),
    annotationEventNames: toBreakdownItems(annotationEventNames, annotationTelemetryCount),
    annotationCharacters: toBreakdownItems(annotationCharacters, annotationTelemetryCount),
    associationTypes: toBreakdownItems(associationTypes, lateralSampledCount),
    narrativeScoreBuckets: Array.from(narrativeScoreBuckets.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([key, stats]) => ({
        key,
        count: stats.count,
        triggeredCount: stats.triggeredCount,
        triggerRate: stats.count > 0 ? stats.triggeredCount / stats.count : 0,
      })),
    aiAnnotationSummary: {
      totalEvents: annotationTelemetryCount,
      densityScoredCount,
      triggerBlockedCount,
      eventTriggeredCount,
      eventCondensedCount,
      lateralSampledCount,
      lateralTriggeredCount,
      lateralTriggerRate: lateralSampledCount > 0 ? lateralTriggeredCount / lateralSampledCount : 0,
      avgNarrativeScore: narrativeScoreCount > 0 ? narrativeScoreSum / narrativeScoreCount : 0,
      avgFinalProbability: finalProbabilityCount > 0 ? finalProbabilitySum / finalProbabilityCount : 0,
    },
    todoDecomposeSummary: {
      requestedCount: todoDecomposeRequestedCount,
      succeededCount: todoDecomposeSucceededCount,
      emptyCount: todoDecomposeEmptyCount,
      parseFailedCount: todoDecomposeParseFailedCount,
      failedCount: todoDecomposeFailedCount,
      regenerateCount: todoDecomposeRegenerateCount,
      uniqueTodosDecomposed: uniqueDecomposedTodos.size,
      emptyRate: todoDecomposeSucceededCount > 0 ? todoDecomposeEmptyCount / todoDecomposeSucceededCount : 0,
      parseFailureRate: todoDecomposeRequestedCount > 0 ? todoDecomposeParseFailedCount / todoDecomposeRequestedCount : 0,
      failureRate: todoDecomposeRequestedCount > 0 ? todoDecomposeFailedCount / todoDecomposeRequestedCount : 0,
      regenerateRate: uniqueDecomposedTodos.size > 0 ? todoDecomposeRegenerateCount / uniqueDecomposedTodos.size : 0,
      avgStepsPerSuccess: todoDecomposeSucceededCount > 0 ? todoDecomposeStepsTotal / todoDecomposeSucceededCount : 0,
    },
    todoDecomposeEventNames: toBreakdownItems(
      todoDecomposeEventNames,
      todoDecomposeRequestedCount
      + todoDecomposeSucceededCount
      + todoDecomposeEmptyCount
      + todoDecomposeParseFailedCount
      + todoDecomposeFailedCount
      + todoDecomposeRegenerateCount,
    ),
    todoDecomposeByLang: toBreakdownItems(
      todoDecomposeByLang,
      todoDecomposeRequestedCount
      + todoDecomposeSucceededCount
      + todoDecomposeEmptyCount
      + todoDecomposeParseFailedCount
      + todoDecomposeFailedCount
      + todoDecomposeRegenerateCount,
    ),
    todoDecomposeByModel: toBreakdownItems(
      todoDecomposeByModel,
      todoDecomposeRequestedCount
      + todoDecomposeSucceededCount
      + todoDecomposeEmptyCount
      + todoDecomposeParseFailedCount
      + todoDecomposeFailedCount
      + todoDecomposeRegenerateCount,
    ),
    todoDecomposeSeries: normalizedTodoDecomposeSeries,
    todoDecomposeRecentEvents: todoDecomposeEvents.slice(0, 50),
    series: normalizedSeries,
    recentEvents,
  };

  res.status(200).json(payload);
}
