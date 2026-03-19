// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/TimeShine_植物生长_技术实现文档_v1.7.docx
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import { getDateInTimezone, requirePlantAuth, serializePlantRecord } from '../src/server/plant-shared.js';

function toQueryString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function shiftDate(date: string, deltaDays: number): string {
  const base = new Date(`${date}T00:00:00`);
  base.setDate(base.getDate() + deltaDays);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  applyCors(res, ['GET']);

  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'GET')) return;

  const auth = await requirePlantAuth(req, res);
  if (!auth) return;

  const timezone = toQueryString(req.query.timezone) || 'UTC';
  const endDate = toQueryString(req.query.endDate) || getDateInTimezone(timezone);
  const startDate = toQueryString(req.query.startDate) || shiftDate(endDate, -30);

  const { data, error } = await auth.db
    .from('daily_plant_records')
    .select('*')
    .eq('user_id', auth.user.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) {
    jsonError(res, 500, 'Failed to fetch plant history', error.message);
    return;
  }

  res.status(200).json({
    success: true,
    records: (data ?? []).map(row => serializePlantRecord(row)),
  });
}
