import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import { requireSupabaseRequestAuth } from '../src/server/supabase-request-auth.js';
import type { PlantAssetTelemetryRequest } from '../src/types/plant.js';

function normalizeText(raw: unknown, maxLength: number): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const value = raw.trim();
  if (!value) {
    return null;
  }
  return value.slice(0, maxLength);
}

function normalizeFallbackLevel(raw: unknown): 1 | 2 | 3 | 4 | null {
  if (raw === 1 || raw === 2 || raw === 3 || raw === 4) {
    return raw;
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  applyCors(res, ['POST']);

  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const auth = await requireSupabaseRequestAuth(req, res);
  if (!auth) {
    return;
  }

  const payload = (req.body ?? {}) as Partial<PlantAssetTelemetryRequest>;
  const requestedPlantId = normalizeText(payload.requestedPlantId, 128);
  const resolvedAssetUrl = normalizeText(payload.resolvedAssetUrl, 256);
  const rootType = normalizeText(payload.rootType, 16);
  const plantStage = normalizeText(payload.plantStage, 16);
  const lang = normalizeText(payload.lang, 16);
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

  const client = auth.adminClient ?? auth.userClient;
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
}
