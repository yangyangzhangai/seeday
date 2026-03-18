// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/TimeShine_植物生长_技术实现文档_v1.7.docx
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from './http.js';
import { requirePlantAuth } from './plant-shared.js';
import { generatePlantDiaryWithFallback } from './plant-diary-service.js';
import type { PlantDiaryRequest } from '../src/types/plant.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  applyCors(res, ['POST']);

  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const auth = await requirePlantAuth(req, res);
  if (!auth) return;

  const body = (req.body ?? {}) as Partial<PlantDiaryRequest>;
  if (!body.date || !body.rootType || !body.plantStage || !Array.isArray(body.activities)) {
    jsonError(res, 400, 'Invalid plant diary payload');
    return;
  }

  try {
    const result = await generatePlantDiaryWithFallback({
      date: body.date,
      activities: body.activities,
      totalDuration: Number(body.totalDuration ?? 0),
      rootType: body.rootType,
      plantStage: body.plantStage,
      isSpecial: Boolean(body.isSpecial),
      isSupportVariant: Boolean(body.isSupportVariant),
      lang: body.lang,
      userName: auth.user.user_metadata?.full_name,
    });

    res.status(200).json({
      success: true,
      diaryText: result.diaryText,
      diaryStatus: result.diaryStatus,
    });
  } catch (error) {
    jsonError(res, 500, 'Failed to generate plant diary', undefined, error instanceof Error ? error.message : 'Unknown');
  }
}
