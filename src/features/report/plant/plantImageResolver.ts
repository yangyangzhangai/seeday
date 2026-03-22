// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import type { PlantStage, RootType } from '../../../types/plant';

const IMAGE_SUFFIXES = ['webp', 'png', 'jpg', 'jpeg', 'webp.png', 'webp.jpg'];
export const PLANT_ASSET_SUFFIX_COUNT = IMAGE_SUFFIXES.length;

function normalizePlantId(plantId: string): string {
  return plantId.trim().toLowerCase();
}

function buildPlantIdFallbackChain(plantId: string, rootType: RootType, plantStage: PlantStage): string[] {
  const normalizedId = normalizePlantId(plantId);
  const sameTypeAndStage = `${rootType}_${plantStage}_001`;
  const rootTypeMid = `${rootType}_mid_001`;
  const globalFallback = 'sha_mid_001';
  return Array.from(new Set([normalizedId, sameTypeAndStage, rootTypeMid, globalFallback]));
}

export function buildPlantAssetCandidates(plantId: string, rootType: RootType, plantStage: PlantStage): string[] {
  const ids = buildPlantIdFallbackChain(plantId, rootType, plantStage);
  const urls: string[] = [];
  ids.forEach((id) => {
    IMAGE_SUFFIXES.forEach((suffix) => {
      urls.push(`/assets/plants/${id}.${suffix}`);
    });
  });
  return urls;
}

export function resolvePlantFallbackLevelFromCandidateIndex(index: number): 1 | 2 | 3 | 4 {
  if (!Number.isFinite(index) || index < 0) {
    return 4;
  }
  const level = Math.floor(index / PLANT_ASSET_SUFFIX_COUNT) + 1;
  if (level <= 1) return 1;
  if (level === 2) return 2;
  if (level === 3) return 3;
  return 4;
}
