// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/TimeShine_植物生长_技术实现文档_v1.7.docx
import type { FocusLevel, PlantCategoryKey } from '../types/plant.js';
import { normalizeActivityType } from './activityType';

export interface PlantActivitySource {
  id: string;
  content?: string;
  duration?: number | null;
  activityType?: string | null;
  isMood?: boolean | null;
}

export interface PlantActivityMapped {
  id: string;
  categoryKey: PlantCategoryKey;
  minutes: number;
  focus: FocusLevel;
}

const TYPE_TO_CATEGORY: Record<string, PlantCategoryKey> = {
  entertainment: 'entertainment',
  social: 'social',
  work: 'work_study',
  study: 'work_study',
  health: 'exercise',
  life: 'life',
};

export function toPlantCategoryKey(activityType?: string | null, content?: string): PlantCategoryKey {
  const normalized = normalizeActivityType(activityType, content);
  if (normalized === 'mood') {
    return 'life';
  }
  return TYPE_TO_CATEGORY[normalized] ?? 'life';
}

export function toFocusLevel(minutes: number): FocusLevel {
  return minutes >= 90 ? 'high' : 'medium';
}

export function mapSourcesToPlantActivities(sources: PlantActivitySource[]): PlantActivityMapped[] {
  return sources
    .map((source) => {
      const minutes = Math.max(0, Number(source.duration ?? 0));
      return {
        id: source.id,
        minutes,
        isMood: Boolean(source.isMood),
        categoryKey: toPlantCategoryKey(source.activityType, source.content),
      };
    })
    .filter(item => !item.isMood && item.minutes > 0)
    .map(item => ({
      id: item.id,
      categoryKey: item.categoryKey,
      minutes: item.minutes,
      focus: toFocusLevel(item.minutes),
    }));
}
