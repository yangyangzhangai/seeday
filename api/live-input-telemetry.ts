import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import { requireSupabaseRequestAuth } from '../src/server/supabase-request-auth.js';
import { handleLiveInputDashboard } from '../src/server/live-input-dashboard-handler.js';
import { handleUserAnalyticsDashboard } from '../src/server/user-analytics-handler.js';
import type { LiveInputTelemetryIngestRequest } from '../src/services/input/liveInputTelemetryApi.js';
import Holidays from 'date-holidays';

function handleHolidayCheckGet(req: VercelRequest, res: VercelResponse): void {
  const { date, country = 'CN' } = req.query;
  const isoDate = String(date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    jsonError(res, 400, 'Invalid date format, expected YYYY-MM-DD');
    return;
  }

  const checkDate = new Date(`${isoDate}T12:00:00`);
  const dayOfWeek = checkDate.getDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    res.status(200).json({ isFreeDay: true, reason: 'weekend' });
    return;
  }

  try {
    const holidayResolver = new Holidays(String(country).toUpperCase());
    const holidays = holidayResolver.isHoliday(checkDate);
    if (holidays) {
      const legalHoliday = Array.isArray(holidays)
        ? holidays.find((item) => item.type === 'public')
        : null;
      if (legalHoliday) {
        res.status(200).json({
          isFreeDay: true,
          reason: 'legal_holiday',
          name: legalHoliday.name,
        });
        return;
      }
    }
  } catch {
    // ignore unsupported country code and fallback to weekday
  }

  res.status(200).json({ isFreeDay: false, reason: null });
}

function normalizeReasons(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 32);
}

function normalizeOptionalString(raw: unknown, maxLength = 200): string | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const value = raw.trim();
  if (!value) {
    return null;
  }

  return value.slice(0, maxLength);
}

function normalizeInputLength(raw: unknown, fallbackText?: string): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return Math.round(raw);
  }

  return fallbackText?.length ?? 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['GET', 'POST']);

  if (handlePreflight(req, res)) return;
  if (req.method === 'GET') {
    if (req.query.module === 'holiday_check') {
      handleHolidayCheckGet(req, res);
      return;
    }
    if (req.query.module === 'user_analytics') {
      await handleUserAnalyticsDashboard(req, res);
      return;
    }
    await handleLiveInputDashboard(req, res);
    return;
  }
  if (!requireMethod(req, res, 'POST')) return;

  const auth = await requireSupabaseRequestAuth(req, res);
  if (!auth) {
    return;
  }

  const payload = (req.body ?? {}) as Partial<LiveInputTelemetryIngestRequest>;
  const client = auth.adminClient ?? auth.userClient;
  const shouldStoreRawText = process.env.LIVE_INPUT_TELEMETRY_STORE_RAW_TEXT === 'true';

  if (payload.eventType === 'classification') {
    const rawInput = typeof payload.rawInput === 'string' ? payload.rawInput.trim() : '';
    if (!rawInput) {
      jsonError(res, 400, 'Missing rawInput');
      return;
    }

    if (!payload.kind || !payload.internalKind || !payload.confidence) {
      jsonError(res, 400, 'Missing classification fields');
      return;
    }

    const row = {
      user_id: auth.user.id,
      event_type: 'classification',
      raw_input: shouldStoreRawText ? rawInput : null,
      input_length: normalizeInputLength(payload.inputLength, rawInput),
      kind: payload.kind,
      internal_kind: payload.internalKind,
      confidence: payload.confidence,
      reasons: normalizeReasons(payload.reasons),
      related_activity_id: normalizeOptionalString(payload.relatedActivityId),
      contains_mood_signal: Boolean(payload.containsMoodSignal),
      extracted_mood: normalizeOptionalString(payload.extractedMood, 64),
      message_id: normalizeOptionalString(payload.messageId),
      session_id: normalizeOptionalString(payload.sessionId),
      lang: normalizeOptionalString(payload.lang, 16),
      platform: normalizeOptionalString(payload.platform, 64),
      app_version: normalizeOptionalString(payload.appVersion, 64),
    };

    const { data, error } = await client
      .from('live_input_events')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      jsonError(res, 500, 'Failed to persist live input telemetry', error.message);
      return;
    }

    res.status(200).json({ success: true, id: data?.id });
    return;
  }

  if (payload.eventType === 'correction') {
    if (!payload.fromKind || !payload.toKind) {
      jsonError(res, 400, 'Missing correction fields');
      return;
    }

    const rawInput = typeof payload.rawInput === 'string' ? payload.rawInput.trim() : '';
    const row = {
      user_id: auth.user.id,
      event_type: 'correction',
      raw_input: shouldStoreRawText && rawInput ? rawInput : null,
      input_length: normalizeInputLength(payload.inputLength, rawInput),
      from_kind: payload.fromKind,
      to_kind: payload.toKind,
      message_id: normalizeOptionalString(payload.messageId),
      session_id: normalizeOptionalString(payload.sessionId),
      lang: normalizeOptionalString(payload.lang, 16),
      platform: normalizeOptionalString(payload.platform, 64),
      app_version: normalizeOptionalString(payload.appVersion, 64),
    };

    const { data, error } = await client
      .from('live_input_events')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      jsonError(res, 500, 'Failed to persist live input telemetry', error.message);
      return;
    }

    res.status(200).json({ success: true, id: data?.id });
    return;
  }

  jsonError(res, 400, 'Unsupported eventType');
}
