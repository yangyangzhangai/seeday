// DOC-DEPS: LLM.md -> api/README.md -> docs/PROACTIVE_REMINDER_SPEC.md
// GET /api/check-holiday?date=2026-05-01&country=CN
// Response: { isFreeDay: boolean, reason: 'weekend' | 'legal_holiday' | null, name?: string }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Holidays from 'date-holidays';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { date, country = 'CN' } = req.query;
  const isoDate = String(date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return res.status(400).json({ error: 'Invalid date format, expected YYYY-MM-DD' });
  }

  const d = new Date(`${isoDate}T12:00:00`);
  const dayOfWeek = d.getDay();

  // 周末直接返回
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return res.status(200).json({ isFreeDay: true, reason: 'weekend' });
  }

  // 法定节假日检测
  try {
    const hd = new Holidays(String(country).toUpperCase());
    const holidays = hd.isHoliday(d);
    if (holidays) {
      const legalHoliday = Array.isArray(holidays)
        ? holidays.find((h) => h.type === 'public')
        : null;
      if (legalHoliday) {
        return res.status(200).json({
          isFreeDay: true,
          reason: 'legal_holiday',
          name: legalHoliday.name,
        });
      }
    }
  } catch {
    // date-holidays 不支持该国家代码时静默忽略
  }

  return res.status(200).json({ isFreeDay: false, reason: null });
}
