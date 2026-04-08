import type { AnnotationCurrentDate, SeasonContextV2 } from '../types/annotation.js';

export function resolveSeasonContext(currentDate?: AnnotationCurrentDate): SeasonContextV2 {
  const month = currentDate?.month;
  if (typeof month !== 'number' || month < 1 || month > 12) {
    return { season: 'unknown', source: 'fallback' };
  }

  if (month >= 3 && month <= 5) {
    return { season: 'spring', source: 'local' };
  }
  if (month >= 6 && month <= 8) {
    return { season: 'summer', source: 'local' };
  }
  if (month >= 9 && month <= 11) {
    return { season: 'autumn', source: 'local' };
  }

  return { season: 'winter', source: 'local' };
}
