// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/Seeday_植物生长_PRD_v1_8.docx -> docs/Seeday_植物生长_技术实现文档_v1.7.docx
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
import {
  buildPlantRootSnapshot,
  normalizePlantDirectionOrder,
  parsePlantRootSnapshot,
} from '../src/lib/plantRootSnapshot.js';
import { getAvailablePlants, extractStageFromPlantId } from '../src/lib/plantRegistry.js';
import {
  DEFAULT_DIRECTION_ORDER,
  type PlantCategoryKey,
  type PlantGenerateRequest,
  type PlantGenerateResponse,
  type PlantRootSnapshot,
  type RootType,
} from '../src/types/plant.js';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import { generatePlantDiaryWithFallback, FREE_FALLBACK_TEXT } from '../src/server/plant-diary-service.js';
import {
  getDateInTimezone,
  isTooEarlyToGenerate,
  requirePlantAuth,
  resolveDayWindow,
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

interface DirectionRow {
  direction_index: number;
  category_key: string;
}

function resolveDirectionOrder(rows: DirectionRow[]): PlantCategoryKey[] {
  const order = [...DEFAULT_DIRECTION_ORDER];
  rows.forEach((row) => {
    const index = Number(row.direction_index);
    if (index >= 0 && index < 5 && DEFAULT_DIRECTION_ORDER.includes(row.category_key as PlantCategoryKey)) {
      order[index] = row.category_key as PlantCategoryKey;
    }
  });
  return normalizePlantDirectionOrder(order);
}

function buildSnapshot(
  date: string,
  messages: MessageRow[],
  directionRows: DirectionRow[],
): PlantRootSnapshot {
  const activities = mapSourcesToPlantActivities(messages.map(row => ({
    id: row.id,
    content: row.content,
    duration: row.duration,
    activityType: row.activity_type,
    isMood: row.is_mood,
  })));
  const messageMap = new Map(messages.map(message => [message.id, message]));
  return buildPlantRootSnapshot(date, resolveDirectionOrder(directionRows), activities.map((activity) => {
    const source = messageMap.get(activity.id);
    return {
      id: activity.id,
      content: source?.content ?? '',
      activityType: source?.activity_type,
      timestamp: Number(source?.timestamp ?? 0),
      categoryKey: activity.categoryKey,
      minutes: activity.minutes,
      focus: activity.focus,
    };
  }));
}

function resolveMonthRange(date: string): { startDate: string; endDate: string } {
  const [yearRaw, monthRaw] = date.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return { startDate: date, endDate: date };
  }

  const startDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
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
  const action = body.action === 'snapshot_existing' ? 'snapshot_existing' : 'generate';

  if (action === 'generate' && isTooEarlyToGenerate(date, timezone)) {
    res.status(400).json(buildTooEarlyResponse());
    return;
  }

  // ── 三次 Supabase 查询并行执行，节省 ~600-800ms ──────────────────────────
  const dayWindow = resolveDayWindow(date, timezone, body.dayStartMs, body.dayEndMs);
  const { startDate: monthStartDate, endDate: monthEndDate } = resolveMonthRange(date);

  const [existingResult, messagesResult, monthlyResult, directionResult] = await Promise.all([
    auth.db
      .from('daily_plant_records')
      .select('*')
      .eq('user_id', auth.user.id)
      .eq('date', date)
      .maybeSingle(),
    auth.db
      .from('messages')
      .select('id, content, duration, activity_type, is_mood, timestamp')
      .eq('user_id', auth.user.id)
      .gte('timestamp', dayWindow.startMs)
      .lt('timestamp', dayWindow.endMs)
      .eq('is_mood', false)
      .gt('duration', 0)
      .order('timestamp', { ascending: true }),
    auth.db
      .from('daily_plant_records')
      .select('plant_id')
      .eq('user_id', auth.user.id)
      .gte('date', monthStartDate)
      .lte('date', monthEndDate),
    auth.db
      .from('plant_direction_config')
      .select('direction_index, category_key')
      .eq('user_id', auth.user.id)
      .order('direction_index', { ascending: true }),
  ]);

  if (existingResult.error) {
    jsonError(res, 500, 'Failed to read daily plant record', existingResult.error.message);
    return;
  }
  const existingSnapshot = parsePlantRootSnapshot(existingResult.data?.root_metrics?.root_snapshot);
  if (existingResult.data && existingSnapshot) {
    res.status(200).json({
      success: true,
      status: 'already_generated',
      plant: serializePlantRecord(existingResult.data),
    } satisfies PlantGenerateResponse);
    return;
  }

  if (messagesResult.error) {
    jsonError(res, 500, 'Failed to read activity records', messagesResult.error.message);
    return;
  }
  if (directionResult.error) {
    jsonError(res, 500, 'Failed to read plant direction config', directionResult.error.message);
    return;
  }

  const messages = ((messagesResult.data ?? []) as MessageRow[])
    .filter(row => !isLegacyChatActivityType(row.activity_type));
  const rootSnapshot = buildSnapshot(
    date,
    messages,
    (directionResult.data ?? []) as DirectionRow[],
  );

  if (existingResult.data) {
    const rootMetrics = {
      ...((existingResult.data.root_metrics ?? {}) as Record<string, unknown>),
      root_snapshot: rootSnapshot,
    };
    const { data: updated, error: updateError } = await auth.db
      .from('daily_plant_records')
      .update({ root_metrics: rootMetrics })
      .eq('id', existingResult.data.id)
      .eq('user_id', auth.user.id)
      .select('*')
      .single();
    if (updateError) {
      jsonError(res, 500, 'Failed to persist plant root snapshot', updateError.message);
      return;
    }
    res.status(200).json({
      success: true,
      status: 'already_generated',
      plant: serializePlantRecord(updated),
    } satisfies PlantGenerateResponse);
    return;
  }

  if (action === 'snapshot_existing') {
    jsonError(res, 404, 'Plant record not found');
    return;
  }
  if (monthlyResult.error) {
    jsonError(res, 500, 'Failed to read monthly plant history', monthlyResult.error.message);
    return;
  }

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

  // ── 计算根系指标 ──────────────────────────────────────────────────────────
  const metrics = computeRootMetrics(activities);
  const isAirDay = isAirPlantDay(activities);
  const isEntertainmentDay = !isAirDay && isEntertainmentDominantDay(metrics);
  const matchedRootType = matchRootType(metrics);
  const rootType: RootType = isAirDay ? 'sha' : matchedRootType;
  const isSupportVariant = !isAirDay && !isEntertainmentDay && resolveSupportVariant(metrics);

  // ── 筛选该根系本月可用植物 ────────────────────────────────────────────────
  const availablePlants = getAvailablePlants(rootType);
  const usedPlantIds = new Set((monthlyResult.data ?? []).map(row => String(row.plant_id ?? '')));

  const monthlyCandidates = availablePlants.filter(plant => !usedPlantIds.has(plant.id));

  if (monthlyCandidates.length === 0) {
    res.status(200).json({
      success: true,
      status: 'monthly_exhausted',
      plant: null,
      message: 'All plant candidates for this root type have been used this month.',
    } satisfies PlantGenerateResponse);
    return;
  }

  // Free users skip AI — pick first candidate + static template text
  const userMeta = auth.user.user_metadata ?? {};
  const appMeta = (auth.user as { app_metadata?: Record<string, unknown> }).app_metadata ?? {};
  const isPlus = ['plus', 'premium', true].includes(
    appMeta.membership_plan ?? appMeta.membership_tier ?? appMeta.is_plus ??
    userMeta.membership_plan ?? userMeta.membership_tier ?? userMeta.is_plus ?? false
  );

  const resolvedLang = (body.lang === 'zh' || body.lang === 'it') ? body.lang : 'en';
  const diary = isPlus
    ? await generatePlantDiaryWithFallback({
        date,
        activities: activities.map(item => ({
          category: item.categoryKey,
          duration: item.minutes,
          focus: item.focus,
        })),
        totalDuration: metrics.totalMinutes,
        rootType,
        plantStage: 'early',
        isSpecial: isAirDay || isEntertainmentDay,
        isSupportVariant,
        availablePlants: monthlyCandidates,
        lang: body.lang,
        aiMode: auth.user.user_metadata?.ai_mode,
        userName: auth.user.user_metadata?.full_name,
      })
    : {
        diaryText: FREE_FALLBACK_TEXT[resolvedLang],
        chosenPlantId: monthlyCandidates[Math.floor(Math.random() * monthlyCandidates.length)]?.id
          ?? monthlyCandidates[0]?.id ?? 'sha_early_0001',
        diaryStatus: 'fallback' as const,
      };

  // AI 返回的 plantId 包含了 stage 信息（如 fib_late_0001）
  const plantId = diary.chosenPlantId;
  const plantStage = extractStageFromPlantId(plantId);

  // ── 写入数据库 ────────────────────────────────────────────────────────────
  const { data: inserted, error: insertError } = await auth.db
    .from('daily_plant_records')
    .insert({
      user_id: auth.user.id,
      date,
      timezone,
      root_metrics: toRootMetricsJson(metrics, rootSnapshot),
      root_type: rootType,
      plant_id: plantId,
      plant_stage: plantStage,
      is_special: isAirDay || isEntertainmentDay,
      is_support_variant: isSupportVariant,
      diary_text: diary.diaryText,
      generated_at: new Date().toISOString(),
      cycle_id: null,
    })
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
