// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { callPlantAssetTelemetryAPI } from '../../../api/client';
import type { PlantStage, RootType } from '../../../types/plant';
import { buildPlantAssetCandidates, resolvePlantFallbackLevelFromCandidateIndex } from './plantImageResolver';

interface PlantImageProps {
  plantId: string;
  rootType: RootType;
  plantStage: PlantStage;
  imgClassName?: string;
}

export const PlantImage: React.FC<PlantImageProps> = ({ plantId, rootType, plantStage, imgClassName }) => {
  const { t, i18n } = useTranslation();
  const candidates = useMemo(
    () => buildPlantAssetCandidates(plantId, rootType, plantStage),
    [plantId, plantStage, rootType],
  );
  const [index, setIndex] = useState(0);
  const [reportedKey, setReportedKey] = useState<string | null>(null);

  useEffect(() => {
    setIndex(0);
    setReportedKey(null);
  }, [candidates]);

  const emitResolvedTelemetry = async (): Promise<void> => {
    const resolvedAssetUrl = candidates[index];
    if (!resolvedAssetUrl) {
      return;
    }
    const key = `${plantId}:${resolvedAssetUrl}`;
    if (reportedKey === key) {
      return;
    }
    setReportedKey(key);
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
      loading="lazy"
      onLoad={() => {
        void emitResolvedTelemetry();
      }}
      onError={() => {
        setIndex(prev => prev + 1);
      }}
    />
  );
};
