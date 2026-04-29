// DOC-DEPS: LLM.md -> src/features/report/README.md
import React, { useMemo } from 'react';
import { buildRootSegments } from '../../../lib/rootRenderer';
import { mapSourcesToPlantActivities } from '../../../lib/plantActivityMapper';
import { usePlantStore, resolvePlantDurationForMessage } from '../../../store/usePlantStore';
import type { DailyPlantRecord, PlantCategoryKey } from '../../../types/plant';
import type { Message } from '../../../store/useChatStore';
import { PlantFlipCard } from './PlantFlipCard';

interface Props {
  plant: DailyPlantRecord;
  dayMessages: Message[];
  onClose: () => void;
}

export const DiaryPlantFlipModal: React.FC<Props> = ({ plant, dayMessages, onClose }) => {
  const directionOrder = usePlantStore(state => state.directionOrder);

  const segments = useMemo(() => {
    const dayStart = new Date(`${plant.date}T00:00:00`).getTime();
    const dayEnd = dayStart + 86_400_000;
    const nowMs = Date.now();
    const sources = dayMessages
      .filter(m => m.mode === 'record' && !m.isMood && m.timestamp >= dayStart && m.timestamp < dayEnd)
      .map(m => ({ ...m, duration: resolvePlantDurationForMessage(m.duration, m.timestamp, nowMs) }));
    const activities = mapSourcesToPlantActivities(sources);
    const dirMap: Record<PlantCategoryKey, 0 | 1 | 2 | 3 | 4> = {
      entertainment: 0, social: 1, work_study: 2, exercise: 3, life: 4,
    };
    directionOrder.forEach((cat, idx) => { dirMap[cat] = idx as 0 | 1 | 2 | 3 | 4; });
    return buildRootSegments(
      activities.map(a => ({ activityId: a.id, direction: dirMap[a.categoryKey], minutes: a.minutes, focus: a.focus })),
      `plant-${plant.date}`,
    );
  }, [plant, dayMessages, directionOrder]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 360, height: '90vh', position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        <PlantFlipCard
          plant={plant}
          segments={segments}
          directionOrder={directionOrder}
          onClose={onClose}
        />
      </div>
    </div>
  );
};
