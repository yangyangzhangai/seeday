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
import { getAvailablePlants, extractStageFromPlantId } from '../src/lib/plantRegistry.js';
import type { PlantGenerateRequest, PlantGenerateResponse, RootType } from '../src/types/plant.js';
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

  if (isTooEarlyToGenerate(date, timezone)) {
    res.status(400).json(buildTooEarlyResponse());
    return;
  }

  // ── 检查是否已生成 ────────────────────────────────────────────────────────
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

  // ── 读取今日活动 ──────────────────────────────────────────────────────────
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
    .filter(row => !isLegacyChatActivityType(row.activity_type));
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

  // ── 查询该根系可用植物，交由 AI 选择 ──────────────────────────────────────
  const availablePlants = getAvailablePlants(rootType);
  const { startDate: monthStartDate, endDate: monthEndDate } = resolveMonthRange(date);
  const { data: monthlyRows, error: monthlyRowsError } = await auth.db
    .from('daily_plant_records')
    .select('plant_id')
    .eq('user_id', auth.user.id)
    .gte('date', monthStartDate)
    .lte('date', monthEndDate);

  if (monthlyRowsError) {
    jsonError(res, 500, 'Failed to read monthly plant history', monthlyRowsError.message);
    return;
  }

  const usedPlantIds = new Set((monthlyRows ?? []).map(row => String(row.plant_id ?? '')));
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
      root_metrics: toRootMetricsJson(metrics),
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
