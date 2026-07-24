import React, { useMemo } from 'react';
import type { DailyPlantRecord } from '../../types/plant';
import type { PlantCategoryKey } from '../../types/plant';
import { buildRootSegments } from '../../lib/rootRenderer';
import { mapSourcesToPlantActivities } from '../../lib/plantActivityMapper';
import { cn } from '../../lib/utils';
import { APP_MODAL_OVERLAY_CLASS } from '../../lib/modalTheme';
import { useChatStore } from '../../store/useChatStore';
import { usePlantStore, resolvePlantDurationForMessage } from '../../store/usePlantStore';
import { PlantFlipCard } from './plant/PlantFlipCard';

interface PlantCardModalProps {
  plant: DailyPlantRecord;
  onClose: () => void;
}

export const PlantCardModal: React.FC<PlantCardModalProps> = ({ plant, onClose }) => {
  const messages = useChatStore(state => state.messages);
  const directionOrder = usePlantStore(state => state.directionOrder);
  const cardDirectionOrder = plant.rootSnapshot?.directionOrder ?? directionOrder;

  const segments = useMemo(() => {
    if (plant.rootSnapshot) return plant.rootSnapshot.segments;
    const dayStart = new Date(`${plant.date}T00:00:00`);
    const dayStartMs = dayStart.getTime();
    if (!Number.isFinite(dayStartMs)) return [];
    const dayEndMs = dayStartMs + 86_400_000;
    const nowMs = Date.now();
    const sources = messages
      .filter(m => m.mode === 'record' && !m.isMood && m.timestamp >= dayStartMs && m.timestamp < dayEndMs)
      .map(m => ({
        ...m,
        duration: resolvePlantDurationForMessage(m.duration, m.timestamp, nowMs),
      }));

    const activities = mapSourcesToPlantActivities(sources);
    const dirMap: Record<PlantCategoryKey, 0 | 1 | 2 | 3 | 4> = {
      entertainment: 0,
      social: 1,
      work_study: 2,
      exercise: 3,
      life: 4,
    };
    directionOrder.forEach((cat, idx) => {
      dirMap[cat] = idx as 0 | 1 | 2 | 3 | 4;
    });

    return buildRootSegments(
      activities.map(a => ({
        activityId: a.id,
        direction: dirMap[a.categoryKey],
        minutes: a.minutes,
        focus: a.focus,
      })),
      `plant-${plant.date}`,
    );
  }, [directionOrder, messages, plant.date]);

  return (
    <div
      className={cn('fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in transition-all', APP_MODAL_OVERLAY_CLASS)}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(290px, calc(100vw - 32px), calc((100dvh - 32px) * 0.75))',
          aspectRatio: '3 / 4',
        }}
        onClick={e => e.stopPropagation()}
      >
        <PlantFlipCard
          plant={plant}
          segments={segments}
          directionOrder={cardDirectionOrder}
          cardOnly
          onClose={onClose}
        />
      </div>

    </div>
  );
};
