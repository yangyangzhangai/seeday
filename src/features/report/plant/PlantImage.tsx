// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { callPlantAssetTelemetryAPI } from '../../../api/client';
import { useAuthStore } from '../../../store/useAuthStore';
import { getScopedClientStorageKey, resolveStorageScopeForUser } from '../../../store/storageScope';
import type { PlantStage, RootType } from '../../../types/plant';
import { buildPlantAssetCandidates, resolvePlantFallbackLevelFromCandidateIndex } from './plantImageResolver';

interface PlantImageProps {
  plantId: string;
  rootType: RootType;
  plantStage: PlantStage;
  imgClassName?: string;
}

// Cache the resolved URL per plantId so subsequent renders skip failed attempts
const CACHE_PREFIX = 'plant_img_v1_';

function getCachedUrl(storageKey: string): string | null {
  try { return localStorage.getItem(storageKey); } catch { return null; }
}

function setCachedUrl(storageKey: string, url: string): void {
  try { localStorage.setItem(storageKey, url); } catch (err) {
    if (import.meta.env.DEV) console.warn('[plant-cache] localStorage quota exceeded, skipping cache write', err);
  }
}

function resolveInitialIndex(storageKey: string, candidates: string[]): number {
  const cached = getCachedUrl(storageKey);
  if (!cached) return 0;
  const idx = candidates.indexOf(cached);
  return idx >= 0 ? idx : 0;
}

export const PlantImage: React.FC<PlantImageProps> = ({ plantId, rootType, plantStage, imgClassName }) => {
  const { t, i18n } = useTranslation();
  const userId = useAuthStore((state) => state.user?.id);
  const candidates = useMemo(
    () => buildPlantAssetCandidates(plantId, rootType, plantStage),
    [plantId, plantStage, rootType],
  );
  const cacheStorageKey = useMemo(
    () => getScopedClientStorageKey(
      `${CACHE_PREFIX}${plantId}`,
      resolveStorageScopeForUser(userId ?? null),
    ),
    [plantId, userId],
  );

  // Start from cached index to avoid flicker on re-open
  const [index, setIndex] = useState(() => resolveInitialIndex(cacheStorageKey, candidates));
  const [reportedKey, setReportedKey] = useState<string | null>(null);

  useEffect(() => {
    setIndex(resolveInitialIndex(cacheStorageKey, candidates));
    setReportedKey(null);
  }, [cacheStorageKey, candidates]);

  const emitResolvedTelemetry = async (): Promise<void> => {
    const resolvedAssetUrl = candidates[index];
    if (!resolvedAssetUrl) return;
    const key = `${plantId}:${resolvedAssetUrl}`;
    if (reportedKey === key) return;
    setReportedKey(key);
    // Persist resolved URL so next mount starts here directly (no flicker)
    setCachedUrl(cacheStorageKey, resolvedAssetUrl);
    try {
      const lang = i18n.language?.toLowerCase() ?? 'en';
      await callPlantAssetTelemetryAPI({
        requestedPlantId: plantId,
        resolvedAssetUrl,
        fallbackLevel: resolvePlantFallbackLevelFromCandidateIndex(index),
        rootType,
        plantStage,
        lang: lang.startsWith('zh') ? 'zh' : lang.startsWith('it') ? 'it' : 'en',
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[plant-image] telemetry ingest failed', error);
      }
    }
  };

  if (!candidates[index]) {
    return (
      <div className="flex min-h-44 items-center justify-center text-sm text-stone-400">
        {t('plant_image_missing')}
      </div>
    );
  }

  return (
    <img
      src={candidates[index]}
      alt={t('plant_image_alt')}
      className={imgClassName ?? 'h-44 w-full object-contain'}
      onLoad={() => {
        void emitResolvedTelemetry();
      }}
      onError={() => {
        setIndex(prev => prev + 1);
      }}
    />
  );
};
