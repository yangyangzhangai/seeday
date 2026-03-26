// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/TimeShine_植物生长_PRD_v1_8.docx -> docs/TimeShine_植物生长_技术实现文档_v1.7.docx
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isLegacyChatActivityType } from '../src/lib/activityType.js';
import {
  computeRootMetrics,
  isAirPlantDay,
  isEntertainmentDominantDay,
  matchRootType,
  resolveSupportVariant,
} from '../src/lib/plantCalculator.js';
import { mapSourcesToPlantActivities } from '../src/lib/plantActivityMapper.js';
import type { PlantGenerateRequest, PlantGenerateResponse, PlantStage, RootType } from '../src/types/plant.js';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import { generatePlantDiaryWithFallback } from '../src/server/plant-diary-service.js';
import {
  getDateInTimezone,
  isTooEarlyToGenerate,
  requirePlantAuth,
  resolveDayWindow,
  resolvePlantId,
  serializePlantRecord,
  toRootMetricsJson,
} from '../src/server/plant-shared.js';

interface MessageRow {
  id: string;
  content: string;
  duration: number | null;
  activity_type: string | null;
  is_mood: boolean | null;
  timestamp: number;
}

function resolvePlantStage(): PlantStage {
  return 'early';
}

function resolveSpecialRootType(isAirDay: boolean, fallbackRootType: RootType): RootType {
  if (isAirDay) {
    return 'sha';
  }
  return fallbackRootType;
}

function buildTooEarlyResponse(): PlantGenerateResponse {
  return {
    success: false,
    status: 'too_early',
    plant: null,
    message: 'Plant generation is available after 20:00 local time.',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  applyCors(res, ['POST']);

  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const auth = await requirePlantAuth(req, res);
  if (!auth) return;

  const body = (req.body ?? {}) as Partial<PlantGenerateRequest>;
  const timezone = body.timezone || 'UTC';
  const date = body.date || getDateInTimezone(timezone);

  // TODO: 测试完恢复 production 检查
  // const devBypass = body._devBypassTime === true && process.env.NODE_ENV !== 'production';
  const devBypass = body._devBypassTime === true;
  if (!devBypass && isTooEarlyToGenerate(date, timezone)) {
    res.status(400).json(buildTooEarlyResponse());
    return;
  }

  const { data: existing, error: existingError } = await auth.db
    .from('daily_plant_records')
    .select('*')
    .eq('user_id', auth.user.id)
    .eq('date', date)
    .maybeSingle();

  if (existingError) {
    jsonError(res, 500, 'Failed to read daily plant record', existingError.message);
    return;
  }

  if (existing) {
    res.status(200).json({
      success: true,
      status: 'already_generated',
      plant: serializePlantRecord(existing),
    } satisfies PlantGenerateResponse);
    return;
  }

  const window = resolveDayWindow(date, timezone, body.dayStartMs, body.dayEndMs);
  const { data: rows, error: messageError } = await auth.db
    .from('messages')
    .select('id, content, duration, activity_type, is_mood, timestamp')
    .eq('user_id', auth.user.id)
    .gte('timestamp', window.startMs)
    .lt('timestamp', window.endMs)
    .eq('is_mood', false)
    .gt('duration', 0)
    .order('timestamp', { ascending: true });

  if (messageError) {
    jsonError(res, 500, 'Failed to read activity records', messageError.message);
    return;
  }

  const messages = ((rows ?? []) as MessageRow[])
    .filter((row) => !isLegacyChatActivityType(row.activity_type));
  const activities = mapSourcesToPlantActivities(messages.map(row => ({
    id: row.id,
    content: row.content,
    duration: row.duration,
    activityType: row.activity_type,
    isMood: row.is_mood,
  })));

  if (activities.length === 0) {
    res.status(200).json({
      success: true,
      status: 'empty_day',
      plant: null,
      message: 'No activity records for this date.',
    } satisfies PlantGenerateResponse);
    return;
  }

  const metrics = computeRootMetrics(activities);
  const isAirDay = isAirPlantDay(activities);
  const isEntertainmentDay = !isAirDay && isEntertainmentDominantDay(metrics);
  const matchedRootType = matchRootType(metrics);
  const rootType = resolveSpecialRootType(isAirDay, matchedRootType);
  const plantStage = resolvePlantStage();
  const isSupportVariant = !isAirDay && !isEntertainmentDay && resolveSupportVariant(metrics);
  const plantId = resolvePlantId({
    rootType,
    stage: plantStage,
    date,
    isSupportVariant,
    isAirDay,
  });

  const diary = await generatePlantDiaryWithFallback({
    date,
    activities: activities.map(item => ({
      category: item.categoryKey,
      duration: item.minutes,
      focus: item.focus,
    })),
    totalDuration: metrics.totalMinutes,
    rootType,
    plantStage,
    isSpecial: isAirDay || isEntertainmentDay,
    isSupportVariant,
    lang: body.lang,
    aiMode: auth.user.user_metadata?.ai_mode,
    userName: auth.user.user_metadata?.full_name,
  });

  const insertPayload = {
    user_id: auth.user.id,
    date,
    timezone,
    root_metrics: toRootMetricsJson(metrics),
    root_type: rootType,
    plant_id: plantId,
    plant_stage: plantStage,
    is_special: isAirDay || isEntertainmentDay,
    is_support_variant: isSupportVariant,
    diary_text: diary.diaryText,
    generated_at: new Date().toISOString(),
    cycle_id: null,
  };

  const { data: inserted, error: insertError } = await auth.db
    .from('daily_plant_records')
    .insert(insertPayload)
    .select('*')
    .single();

  if (insertError) {
    jsonError(res, 500, 'Failed to persist plant record', insertError.message);
    return;
  }

  res.status(200).json({
    success: true,
    status: 'generated',
    plant: serializePlantRecord(inserted),
    diaryStatus: diary.diaryStatus,
  } satisfies PlantGenerateResponse);
}
