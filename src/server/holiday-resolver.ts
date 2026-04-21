// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import Holidays from 'date-holidays';
import type { AnnotationCurrentDate, AnnotationHolidayContext } from '../types/annotation.js';

interface SocialHolidayRule {
  name: { zh: string; en: string; it: string };
  month: number;
  day: number;
}

const SOCIAL_HOLIDAY_RULES: SocialHolidayRule[] = [
  {
    name: { zh: '情人节', en: "Valentine's Day", it: 'San Valentino' },
    month: 2,
    day: 14,
  },
  {
    name: { zh: '万圣节', en: 'Halloween', it: 'Halloween' },
    month: 10,
    day: 31,
  },
  {
    name: { zh: '平安夜', en: 'Christmas Eve', it: 'Vigilia di Natale' },
    month: 12,
    day: 24,
  },
  {
    name: { zh: '圣诞节', en: 'Christmas Day', it: 'Natale' },
    month: 12,
    day: 25,
  },
  {
    name: { zh: '跨年夜', en: "New Year's Eve", it: 'San Silvestro' },
    month: 12,
    day: 31,
  },
];

const LEGAL_HOLIDAY_TYPES = new Set(['public', 'bank', 'school']);

export interface ResolveHolidayInput {
  countryCode: string;
  lang: 'zh' | 'en' | 'it';
  currentDate?: AnnotationCurrentDate;
}

function formatIsoDate(currentDate: AnnotationCurrentDate | undefined): string {
  if (currentDate?.isoDate && /^\d{4}-\d{2}-\d{2}$/.test(currentDate.isoDate)) {
    return currentDate.isoDate;
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resolveSocialHolidayName(month: number, day: number, lang: 'zh' | 'en' | 'it'): string | undefined {
  const rule = SOCIAL_HOLIDAY_RULES.find((item) => item.month === month && item.day === day);
  if (!rule) return undefined;
  return rule.name[lang];
}

export function resolveHoliday(input: ResolveHolidayInput): AnnotationHolidayContext {
  const isoDate = formatIsoDate(input.currentDate);
  const [year, month, day] = isoDate.split('-').map((item) => Number(item));

  try {
    const hd = new Holidays(input.countryCode);
    const holidays = hd.getHolidays(year).filter((item) => item.date.startsWith(isoDate));

    if (holidays.length > 0) {
      const legal = holidays.find((item) => LEGAL_HOLIDAY_TYPES.has(item.type));
      const picked = legal || holidays[0];
      return {
        isHoliday: true,
        name: picked.name,
        type: legal ? 'legal' : 'social',
        source: 'calendar',
      };
    }
  } catch {
    // fallback to lightweight social holiday rules
  }

  const socialName = resolveSocialHolidayName(month, day, input.lang);
  if (socialName) {
    return {
      isHoliday: true,
      name: socialName,
      type: 'social',
      source: 'calendar',
    };
  }

  return {
    isHoliday: false,
    source: 'none',
  };
}
