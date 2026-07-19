// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import { PLANT_REGISTRY, type PlantEntry } from './plantRegistry';

type PlantDisplayLanguage = 'zh' | 'en' | 'it';

function normalizePlantLanguage(language: string): PlantDisplayLanguage {
  const normalized = language.toLowerCase().split('-')[0];
  if (normalized === 'zh' || normalized === 'it') return normalized;
  return 'en';
}

function findPlantEntry(plantId: string): PlantEntry | undefined {
  return Object.values(PLANT_REGISTRY)
    .flat()
    .find((entry) => entry.id === plantId);
}

export function getPlantDisplayName(plantId: string, language: string): string {
  const entry = findPlantEntry(plantId);
  if (!entry) return '';

  const normalizedLanguage = normalizePlantLanguage(language);
  if (normalizedLanguage === 'zh') return entry.nameCN;
  if (normalizedLanguage === 'it') return entry.nameIT;
  return entry.nameEN;
}
