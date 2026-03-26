// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { renderRootSegments } from '../../../lib/rootRenderer';
import { toPlantCategoryKey } from '../../../lib/plantActivityMapper';
import { useChatStore } from '../../../store/useChatStore';
import { usePlantStore } from '../../../store/usePlantStore';
import type { PlantCategoryKey } from '../../../types/plant';
import { PlantImage } from './PlantImage';
import { PlantRevealAnimation } from './PlantRevealAnimation';
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
  onOpenDiaryBook?: () => void;
}

export const PlantRootSection: React.FC<PlantRootSectionProps> = ({ onOpenDiaryBook }) => {
  const { t } = useTranslation();
  const [timeTick, setTimeTick] = useState(() => Date.now());
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [revealToken, setRevealToken] = useState(0);
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

  useEffect(() => {
    void loadTodayData();
    startActivitySync();
    const timerId = window.setInterval(() => {
      setTimeTick(Date.now());
      refreshTodaySegments();
    }, 30_000);
    return () => {
      window.clearInterval(timerId);
      stopActivitySync();
    };
  }, [loadTodayData, refreshTodaySegments, startActivitySync, stopActivitySync]);

  const renderedSegments = useMemo(() => renderRootSegments(todaySegments), [todaySegments]);
  const nowHour = new Date(timeTick).getHours();
  const plantTestMode = import.meta.env.DEV && localStorage.getItem('plant_test_mode') === '1';
  const isTooEarly = plantTestMode ? false : nowHour < 20;

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

  const handleGenerate = async () => {
    if (isTooEarly) {
      setStatusHint(t('plant_generate_locked_hint'));
      return;
    }
    if (!window.confirm(t('plant_generate_confirm'))) {
      return;
    }
    try {
      const response = await generatePlant();
      if (response.status === 'generated') {
        setRevealToken(prev => prev + 1);
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
      setStatusHint(response.message ?? t('plant_generate_locked_hint'));
    } catch {
      setStatusHint(t('plant_generate_failed'));
    }
  };

  return (
    /* Outer: flex column filling available height, bubbles overlay spans full height */
    <div className="h-full flex flex-col relative overflow-hidden">

      {/* ── Canvas area (flex-1, clips soil canvas) ── */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        {/* Soil canvas shifted down so eco-sphere bubbles float above grass */}
        <div className="absolute inset-0" style={{ top: 120 }}>
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

        {/* Plant image overlay (centered within soil area) */}
        {todayPlant ? (
          <div className="absolute inset-x-8 z-10 pointer-events-none" style={{ top: 'calc(120px + 35%)', transform: 'translateY(-50%)' }}>
            <p className="text-center text-xs font-medium mb-1" style={{ color: 'rgba(245,235,210,0.9)' }}>{t('plant_reveal_title')}</p>
            <PlantRevealAnimation revealToken={revealToken}>
              <PlantImage
                plantId={todayPlant.plantId}
                rootType={todayPlant.rootType}
                plantStage={todayPlant.plantStage}
              />
            </PlantRevealAnimation>
          </div>
        ) : null}

        {/* Generated badge (top-right of soil area) */}
        {todayPlant ? (
          <div className="absolute right-3 z-10 pointer-events-none" style={{ top: 128 }}>
            <span
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(236,253,245,0.85)', color: '#059669', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', border: '1px solid rgba(110,231,183,0.4)' }}
            >{t('plant_section_generated_badge')}</span>
          </div>
        ) : null}

        {/* Empty state hint (centered in canvas) */}
        {renderedSegments.length === 0 ? (
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <div className="rounded-2xl px-4 py-3 text-center" style={{ background: 'rgba(245,238,224,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(200,178,138,0.4)' }}>
              <p className="text-xs font-medium" style={{ color: '#5a4028' }}>{t('report_root_empty_title')}</p>
              <p className="mt-1 text-xs leading-5" style={{ color: '#7a6050' }}>{t('report_root_empty')}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Generate button: in normal flow, naturally above bottom nav ── */}
      <div className="px-4 pt-2 pb-3 space-y-1" style={{ background: 'rgba(0,0,0,0)' }}>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generateUi.disabled}
          className="w-full min-h-11 rounded-2xl text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'rgba(35, 25, 12, 0.80)', color: '#f5eedc', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {t(generateUi.buttonKey)}
        </button>
        <p className="text-center text-xs" style={{ color: 'rgba(90,64,40,0.70)' }}>
          {statusHint ?? t(generateUi.hintKey)}
        </p>
      </div>

      {/* ── Eco sphere bubbles: absolute overlay spanning full height so popups don't clip ── */}
      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
        <DayEcoSphere onOpenDiaryBook={onOpenDiaryBook} />
      </div>
    </div>
  );
};
