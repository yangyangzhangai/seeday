import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import type { DailyPlantRecord } from '../../types/plant';
import type { PlantCategoryKey } from '../../types/plant';
import { buildRootSegments } from '../../lib/rootRenderer';
import { mapSourcesToPlantActivities } from '../../lib/plantActivityMapper';
import { useChatStore } from '../../store/useChatStore';
import { usePlantStore, resolvePlantDurationForMessage } from '../../store/usePlantStore';
import { PlantFlipCard } from './plant/PlantFlipCard';

interface PlantCardModalProps {
  plant: DailyPlantRecord;
  onClose: () => void;
  onGenerateDiary: () => void;
}

export const PlantCardModal: React.FC<PlantCardModalProps> = ({ plant, onClose, onGenerateDiary }) => {
  const messages = useChatStore(state => state.messages);
  const directionOrder = usePlantStore(state => state.directionOrder);

  const segments = useMemo(() => {
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
      className="fixed inset-0 z-[100] flex items-end bg-black/40 backdrop-blur-sm animate-in fade-in transition-all"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[92vh] rounded-t-2xl bg-[#f6f1e8]"
        style={{ boxShadow: '0 -12px 28px rgba(0,0,0,0.22)' }}
        onClick={e => e.stopPropagation()}
      >
        <PlantFlipCard
          plant={plant}
          segments={segments}
          directionOrder={directionOrder}
          onGenerateDiary={onGenerateDiary}
        />
      </div>

      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md hover:bg-black/40 transition-colors"
      >
        <X size={20} />
      </button>
    </div>
  );
};
