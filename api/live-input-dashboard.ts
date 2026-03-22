import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import { isLiveInputAdminUser, requireSupabaseRequestAuth } from '../src/server/supabase-request-auth.js';
import type {
  LiveInputTelemetryBreakdownItem,
  LiveInputTelemetryDashboardResponse,
  LiveInputTelemetryRecentEvent,
  LiveInputTelemetrySeriesPoint,
} from '../src/services/input/liveInputTelemetryApi.js';

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
      uniqueUsers: 0,
    });
  }

  return points;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['GET']);

  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'GET')) return;

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

  const events = (rows || []) as LiveInputEventRow[];
  const byInternalKind = new Map<string, number>();
  const correctionPaths = new Map<string, number>();
  const topReasons = new Map<string, number>();
  const byLang = new Map<string, number>();
  const uniqueUsers = new Set<string>();
  const series = createDateSeries(days);
  const seriesMap = new Map(series.map((point) => [point.day, { ...point, userIds: new Set<string>() }]));

  let classificationCount = 0;
  let correctionCount = 0;

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

  const normalizedSeries: LiveInputTelemetrySeriesPoint[] = series.map((point) => {
    const current = seriesMap.get(point.day);
    return {
      day: point.day,
      classificationCount: current?.classificationCount ?? 0,
      correctionCount: current?.correctionCount ?? 0,
      uniqueUsers: current?.userIds.size ?? 0,
    };
  });

  const recentEvents: LiveInputTelemetryRecentEvent[] = events.slice(0, 50).map((event) => ({
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
    lang: event.lang,
    inputLength: event.input_length ?? 0,
    inputPreview: event.raw_input ? event.raw_input.slice(0, 120) : null,
  }));

  const payload: LiveInputTelemetryDashboardResponse = {
    success: true,
    summary: {
      days,
      classificationCount,
      correctionCount,
      correctionRate: classificationCount > 0 ? correctionCount / classificationCount : 0,
      uniqueUsers: uniqueUsers.size,
    },
    byInternalKind: toBreakdownItems(byInternalKind, classificationCount),
    correctionPaths: toBreakdownItems(correctionPaths, correctionCount),
    topReasons: toBreakdownItems(topReasons, classificationCount),
    byLang: toBreakdownItems(byLang, classificationCount),
    series: normalizedSeries,
    recentEvents,
  };

  res.status(200).json(payload);
}
