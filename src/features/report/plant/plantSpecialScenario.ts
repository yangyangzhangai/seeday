// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import { ROOT_SCORE_CONFIG } from '../../../lib/plantCalculator';
import type { DailyPlantRecord } from '../../../types/plant';

export type PlantSpecialScenario = 'normal' | 'air' | 'entertainment';

function sumActivityCount(record: DailyPlantRecord): number {
  const breakdown = record.rootMetrics.directionBreakdown;
  return Object.values(breakdown).reduce((total, item) => total + (item?.activities ?? 0), 0);
}

function resolveEntertainmentRatio(record: DailyPlantRecord): number {
  const entertainmentMinutes = record.rootMetrics.directionBreakdown.entertainment?.minutes ?? 0;
  const totalMinutes = record.rootMetrics.totalMinutes;
  if (totalMinutes <= 0) return 0;
  return entertainmentMinutes / totalMinutes;
}

export function resolvePlantSpecialScenario(record: DailyPlantRecord | null): PlantSpecialScenario {
  if (!record || !record.isSpecial) {
    return 'normal';
  }

  const activityCount = sumActivityCount(record);
  const isAirDay = record.rootType === 'sha'
    && activityCount <= ROOT_SCORE_CONFIG.specialThreshold.airMaxActivities
    && record.rootMetrics.totalMinutes < ROOT_SCORE_CONFIG.specialThreshold.airMaxTotalMinutesExclusive;
  if (isAirDay) {
    return 'air';
  }

  const entertainmentRatio = resolveEntertainmentRatio(record);
  if (entertainmentRatio >= ROOT_SCORE_CONFIG.specialThreshold.entertainmentRatioMin) {
    return 'entertainment';
  }

  return 'normal';
}
