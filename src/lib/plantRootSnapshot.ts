// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import { buildRootSegments } from './rootRenderer';
import {
  DEFAULT_DIRECTION_ORDER,
  type DirectionIndex,
  type PlantCategoryKey,
  type PlantRootSnapshot,
  type PlantRootSnapshotActivity,
  type RootSegment,
} from '../types/plant';

export function normalizePlantDirectionOrder(order?: PlantCategoryKey[] | null): PlantCategoryKey[] {
  const unique = (order ?? []).filter(
    (category, index, values) => DEFAULT_DIRECTION_ORDER.includes(category) && values.indexOf(category) === index,
  );
  DEFAULT_DIRECTION_ORDER.forEach((category) => {
    if (!unique.includes(category)) unique.push(category);
  });
  return unique.slice(0, 5);
}

function toDirectionMap(order: PlantCategoryKey[]): Record<PlantCategoryKey, DirectionIndex> {
  const map = {} as Record<PlantCategoryKey, DirectionIndex>;
  normalizePlantDirectionOrder(order).forEach((category, index) => {
    map[category] = index as DirectionIndex;
  });
  return map;
}

export function buildPlantRootSnapshot(
  date: string,
  directionOrder: PlantCategoryKey[],
  activities: PlantRootSnapshotActivity[],
): PlantRootSnapshot {
  const normalizedOrder = normalizePlantDirectionOrder(directionOrder);
  const directionMap = toDirectionMap(normalizedOrder);
  const segments = buildRootSegments(
    activities.map((activity) => ({
      activityId: activity.id,
      direction: directionMap[activity.categoryKey],
      minutes: activity.minutes,
      focus: activity.focus,
    })),
    `plant-${date}`,
  );
  return { directionOrder: normalizedOrder, segments, activities };
}

function isRootSegment(value: unknown): value is RootSegment {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<RootSegment>;
  return typeof item.id === 'string'
    && typeof item.activityId === 'string'
    && Number.isInteger(item.direction)
    && typeof item.minutes === 'number';
}

function isSnapshotActivity(value: unknown): value is PlantRootSnapshotActivity {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<PlantRootSnapshotActivity>;
  return typeof item.id === 'string'
    && typeof item.content === 'string'
    && typeof item.timestamp === 'number'
    && DEFAULT_DIRECTION_ORDER.includes(item.categoryKey as PlantCategoryKey)
    && typeof item.minutes === 'number';
}

export function parsePlantRootSnapshot(value: unknown): PlantRootSnapshot | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const snapshot = value as Partial<PlantRootSnapshot>;
  if (!Array.isArray(snapshot.directionOrder)
    || !Array.isArray(snapshot.segments)
    || !Array.isArray(snapshot.activities)) {
    return undefined;
  }
  if (!snapshot.segments.every(isRootSegment) || !snapshot.activities.every(isSnapshotActivity)) {
    return undefined;
  }
  return {
    directionOrder: normalizePlantDirectionOrder(snapshot.directionOrder),
    segments: snapshot.segments,
    activities: snapshot.activities,
  };
}
