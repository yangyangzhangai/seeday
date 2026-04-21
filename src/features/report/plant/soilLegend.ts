// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import type { PlantCategoryKey } from '../../../types/plant';

export interface SoilLegendItem {
  slotKey: string;
  positionKey: string;
  category: PlantCategoryKey;
}

const SLOT_INDEX: Record<string, number> = {
  top: 2,
  rightTop: 3,
  rightBottom: 4,
  leftBottom: 0,
  leftTop: 1,
};

const FALLBACK_CATEGORY: Record<string, PlantCategoryKey> = {
  top: 'work_study',
  rightTop: 'exercise',
  rightBottom: 'social',
  leftBottom: 'entertainment',
  leftTop: 'life',
};

export function buildSoilLegendItems(directionOrder: PlantCategoryKey[]): SoilLegendItem[] {
  return [
    { slotKey: 'leftBottom', positionKey: 'plant_direction_left_bottom', category: directionOrder[SLOT_INDEX.leftBottom] ?? FALLBACK_CATEGORY.leftBottom },
    { slotKey: 'leftTop', positionKey: 'plant_direction_left_top', category: directionOrder[SLOT_INDEX.leftTop] ?? FALLBACK_CATEGORY.leftTop },
    { slotKey: 'top', positionKey: 'plant_direction_top', category: directionOrder[SLOT_INDEX.top] ?? FALLBACK_CATEGORY.top },
    { slotKey: 'rightTop', positionKey: 'plant_direction_right_top', category: directionOrder[SLOT_INDEX.rightTop] ?? FALLBACK_CATEGORY.rightTop },
    { slotKey: 'rightBottom', positionKey: 'plant_direction_right_bottom', category: directionOrder[SLOT_INDEX.rightBottom] ?? FALLBACK_CATEGORY.rightBottom },
  ];
}
