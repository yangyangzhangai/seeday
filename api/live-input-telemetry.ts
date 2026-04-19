import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import { requireSupabaseRequestAuth } from '../src/server/supabase-request-auth.js';
import { handleLiveInputDashboard } from '../src/server/live-input-dashboard-handler.js';
import { handleUserAnalyticsDashboard } from '../src/server/user-analytics-handler.js';
import type { LiveInputTelemetryIngestRequest } from '../src/services/input/liveInputTelemetryApi.js';
import type { PlantAssetTelemetryRequest } from '../src/types/plant.js';

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

function normalizeFallbackLevel(raw: unknown): 1 | 2 | 3 | 4 | null {
  if (raw === 1 || raw === 2 || raw === 3 || raw === 4) {
    return raw;
  }
  return null;
}

function shouldHandlePlantAssetTelemetry(payload: {
  eventType?: unknown;
  requestedPlantId?: unknown;
  resolvedAssetUrl?: unknown;
  rootType?: unknown;
  plantStage?: unknown;
  fallbackLevel?: unknown;
}): boolean {
  if (payload.eventType === 'plant_asset') return true;
  // Backward compatibility: old client payload has no eventType and posts only plant asset fields.
  return (
    payload.eventType == null
    && typeof payload.requestedPlantId !== 'undefined'
    && typeof payload.resolvedAssetUrl !== 'undefined'
    && typeof payload.rootType !== 'undefined'
    && typeof payload.plantStage !== 'undefined'
    && typeof payload.fallbackLevel !== 'undefined'
  );
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

  const payload = (req.body ?? {}) as Partial<LiveInputTelemetryIngestRequest & PlantAssetTelemetryRequest> & {
    eventType?: string;
  };
  const client = auth.adminClient ?? auth.userClient;
  const shouldStoreRawText = process.env.LIVE_INPUT_TELEMETRY_STORE_RAW_TEXT === 'true';

  if (shouldHandlePlantAssetTelemetry(payload)) {
    const requestedPlantId = normalizeOptionalString(payload.requestedPlantId, 128);
    const resolvedAssetUrl = normalizeOptionalString(payload.resolvedAssetUrl, 256);
    const rootType = normalizeOptionalString(payload.rootType, 16);
    const plantStage = normalizeOptionalString(payload.plantStage, 16);
    const lang = normalizeOptionalString(payload.lang, 16);
    const fallbackLevel = normalizeFallbackLevel(payload.fallbackLevel);

    if (!requestedPlantId || !resolvedAssetUrl || !rootType || !plantStage || !fallbackLevel) {
      jsonError(res, 400, 'Missing required plant asset telemetry fields');
      return;
    }

    const row = {
      user_id: auth.user.id,
      requested_plant_id: requestedPlantId,
      resolved_asset_url: resolvedAssetUrl,
      fallback_level: fallbackLevel,
      root_type: rootType,
      plant_stage: plantStage,
      lang,
    };

    const { data, error } = await client
      .from('plant_asset_events')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      if (error.message?.toLowerCase().includes('relation') && error.message?.includes('plant_asset_events')) {
        res.status(200).json({ success: false, skipped: true });
        return;
      }
      jsonError(res, 500, 'Failed to persist plant asset telemetry', error.message);
      return;
    }

    res.status(200).json({ success: true, id: data?.id });
    return;
  }

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
