// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { buildRootSegments, renderRootSegments } from '../../../lib/rootRenderer';
import { mapSourcesToPlantActivities, toPlantCategoryKey } from '../../../lib/plantActivityMapper';
import { useChatStore } from '../../../store/useChatStore';
import { usePlantStore, resolvePlantDurationForMessage } from '../../../store/usePlantStore';
import type { PlantCategoryKey } from '../../../types/plant';
import { PlantFlipCard } from './PlantFlipCard';
import { buildPlantGenerateUiState } from './plantGenerateUi';
import { SoilCanvas } from './SoilCanvas';
import { DayEcoSphere } from './DayEcoSphere';

function getCategoryKey(category: PlantCategoryKey): string {
  switch (category) {
    case 'work_study':
      return 'plant_category_work_study';
    case 'exercise':
      return 'plant_category_exercise';
    case 'social':
      return 'category_social';
    case 'entertainment':
      return 'category_entertainment';
    default:
      return 'category_life';
  }
}

interface PlantRootSectionProps {
  onGenerateDiary?: () => void;
}

export const PlantRootSection: React.FC<PlantRootSectionProps> = ({ onGenerateDiary }) => {
  const { t } = useTranslation();
  const [timeTick, setTimeTick] = useState(() => Date.now());
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const todaySegments = usePlantStore(state => state.todaySegments);
  const todayPlant = usePlantStore(state => state.todayPlant);
  const selectedRootId = usePlantStore(state => state.selectedRootId);
  const directionOrder = usePlantStore(state => state.directionOrder);
  const isGenerating = usePlantStore(state => state.isGenerating);
  const loadTodayData = usePlantStore(state => state.loadTodayData);
  const refreshTodaySegments = usePlantStore(state => state.refreshTodaySegments);
  const startActivitySync = usePlantStore(state => state.startActivitySync);
  const stopActivitySync = usePlantStore(state => state.stopActivitySync);
  const generatePlant = usePlantStore(state => state.generatePlant);
  const setSelectedRootId = usePlantStore(state => state.setSelectedRootId);
  const messages = useChatStore(state => state.messages);
  const loadMessagesForDateRange = useChatStore(state => state.loadMessagesForDateRange);

  useEffect(() => {
    void (async () => {
      await loadTodayData();
      const now = new Date();
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(now);
      dayEnd.setHours(23, 59, 59, 999);
      await loadMessagesForDateRange(dayStart, dayEnd);
      refreshTodaySegments();
    })();
    startActivitySync();
    const timerId = window.setInterval(() => {
      setTimeTick(Date.now());
      refreshTodaySegments();
    }, 30_000);
    return () => {
      window.clearInterval(timerId);
      stopActivitySync();
    };
  }, [loadMessagesForDateRange, loadTodayData, refreshTodaySegments, startActivitySync, stopActivitySync]);

  const renderedSegments = useMemo(() => renderRootSegments(todaySegments), [todaySegments]);

  // When plant is locked, the store clears todaySegments (refreshTodaySegments returns early).
  // Recompute from messages so the flip card back can display the root system.
  const flipCardSegments = useMemo(() => {
    if (todaySegments.length > 0) return todaySegments;
    if (!todayPlant) return [];
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayStartMs + 86_400_000;
    const nowMs = Date.now();
    const sources = messages
      .filter(m => m.mode === 'record' && !m.isMood && m.timestamp >= dayStartMs && m.timestamp < dayEndMs)
      .map(m => ({ ...m, duration: resolvePlantDurationForMessage(m.duration, m.timestamp, nowMs) }));
    const activities = mapSourcesToPlantActivities(sources);
    const dirMap: Record<PlantCategoryKey, 0 | 1 | 2 | 3 | 4> = {
      entertainment: 0, social: 1, work_study: 2, exercise: 3, life: 4,
    };
    directionOrder.forEach((cat, idx) => { dirMap[cat] = idx as 0 | 1 | 2 | 3 | 4; });
    return buildRootSegments(
      activities.map(a => ({ activityId: a.id, direction: dirMap[a.categoryKey], minutes: a.minutes, focus: a.focus })),
      `plant-${todayPlant.date}`,
    );
  }, [todayPlant, todaySegments, messages, directionOrder]);

  const nowHour = new Date(timeTick).getHours();
  const isTooEarly = nowHour < 20;

  const messageMap = useMemo(() => {
    const map = new Map<string, {
      content: string;
      category: PlantCategoryKey;
      timestamp: number;
    }>();
    messages.forEach((message) => {
      map.set(message.id, {
        content: message.content,
        category: toPlantCategoryKey(message.activityType, message.content),
        timestamp: message.timestamp,
      });
    });
    return map;
  }, [messages]);

  const selectedSegment = useMemo(
    () => todaySegments.find(segment => segment.id === selectedRootId) ?? null,
    [selectedRootId, todaySegments],
  );

  const selectedMessage = selectedSegment ? messageMap.get(selectedSegment.activityId) : null;

  useEffect(() => {
    if (!selectedRootId) return;
    const timerId = window.setTimeout(() => {
      setSelectedRootId(null);
    }, 5000);
    return () => window.clearTimeout(timerId);
  }, [selectedRootId, setSelectedRootId]);

  const selectedTimeRange = useMemo(() => {
    if (!selectedSegment || !selectedMessage) {
      return '-';
    }
    const startTs = selectedMessage.timestamp;
    const endTs = startTs + selectedSegment.minutes * 60 * 1000;
    return `${format(startTs, 'HH:mm')}-${format(endTs, 'HH:mm')}`;
  }, [selectedMessage, selectedSegment]);

  const generateUi = useMemo(
    () => buildPlantGenerateUiState({
      hasTodayPlant: Boolean(todayPlant),
      isGenerating,
      isTooEarly,
    }),
    [isGenerating, isTooEarly, todayPlant],
  );
  const generateHint = statusHint ?? (generateUi.hintKey ? t(generateUi.hintKey) : null);

  const handleGenerate = async () => {
    if (isTooEarly) {
      setStatusHint(t('plant_generate_locked_with_diary_hint'));
      return;
    }
    if (!window.confirm(t('plant_generate_confirm'))) {
      return;
    }
    try {
      const response = await generatePlant();
      if (response.status === 'generated') {
        setStatusHint(t('plant_generate_success'));
        return;
      }
      if (response.status === 'already_generated') {
        setStatusHint(t('plant_generate_already'));
        return;
      }
      if (response.status === 'empty_day') {
        setStatusHint(t('plant_generate_empty_day_fallback'));
        return;
      }
      if (response.status === 'monthly_exhausted') {
        setStatusHint(t('plant_generate_monthly_exhausted'));
        return;
      }
      setStatusHint(response.message ?? t('plant_generate_locked_hint'));
    } catch {
      setStatusHint(t('plant_generate_failed'));
    }
  };

  /* ── When plant is generated: show flip card only ── */
  if (todayPlant) {
    return (
      <div className="h-full flex flex-col relative overflow-hidden">
        <PlantFlipCard
          plant={todayPlant}
          segments={flipCardSegments}
          directionOrder={directionOrder}
          onGenerateDiary={onGenerateDiary ?? (() => {})}
        />
      </div>
    );
  }

  return (
    /* Outer: flex column filling available height, bubbles overlay spans full height */
    <div className="h-full flex flex-col relative overflow-hidden">

      {/* ── Canvas area (flex-1, clips soil canvas) ── */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        {/* Soil + roots: pushed down so eco-sphere bubbles (130px) are fully above soil */}
        <div className="absolute inset-0" style={{ top: 130 }}>
          <SoilCanvas
            items={renderedSegments}
            selectedRootId={selectedRootId}
            onSelectRoot={setSelectedRootId}
            directionOrder={directionOrder}
            detailBubble={selectedSegment ? {
              title: t('plant_detail_title'),
              activity: `${t('plant_detail_activity')}: ${selectedMessage?.content ?? '-'}`,
              category: `${t('plant_detail_category')}: ${t(getCategoryKey(selectedMessage?.category ?? 'life'))}`,
              timeRange: `${t('plant_detail_time_range')}: ${selectedTimeRange}`,
              duration: `${t('plant_detail_duration')}: ${t('duration_minutes', { mins: selectedSegment.minutes })}`,
              focus: `${t('plant_detail_focus')}: ${selectedSegment.focus === 'high' ? t('plant_focus_high') : t('plant_focus_medium')}`,
            } : null}
            onCloseDetail={() => setSelectedRootId(null)}
          />
        </div>

        {/* ── Eco sphere bubbles above soil ── */}
        <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
          <DayEcoSphere />
        </div>

        {/* ── Generate button: absolute at bottom, overlapping soil ── */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pt-2 pb-1">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generateUi.disabled}
            className="w-full min-h-11 rounded-2xl text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'rgba(35, 25, 12, 0.80)', color: '#f5eedc', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {t(generateUi.buttonKey)}
          </button>
          {generateHint ? (
            <p className="mt-1 text-center text-xs" style={{ color: 'rgba(90,64,40,0.70)' }}>
              {generateHint}
            </p>
          ) : null}
        </div>

        {/* Empty state hint (centered in canvas) */}
        {renderedSegments.length === 0 ? (
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <div className="rounded-2xl px-4 py-3 text-center" style={{ background: 'transparent', border: 'none' }}>
              <p className="text-xs font-medium" style={{ color: '#5a4028' }}>{t('report_root_empty_title')}</p>
              <p className="mt-1 text-xs leading-5" style={{ color: '#7a6050' }}>{t('report_root_empty')}</p>
            </div>
          </div>
        ) : null}
      </div>

    </div>
  );
};
