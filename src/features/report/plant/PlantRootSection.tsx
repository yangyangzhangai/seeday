// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { renderRootSegments } from '../../../lib/rootRenderer';
import { toPlantCategoryKey } from '../../../lib/plantActivityMapper';
import { useChatStore } from '../../../store/useChatStore';
import { usePlantStore } from '../../../store/usePlantStore';
import type { PlantCategoryKey } from '../../../types/plant';
import { buildPlantGenerateUiState } from './plantGenerateUi';
import { SoilCanvas } from './SoilCanvas';

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

export const PlantRootSection: React.FC = () => {
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

  const handleGenerate = async () => {
    if (isTooEarly) {
      setStatusHint(t('plant_generate_locked_hint'));
      return;
    }
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
      setStatusHint(t('plant_generate_empty_day'));
      return;
    }
    setStatusHint(response.message ?? t('plant_generate_locked_hint'));
  };

  return (
    <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">{t('report_root_section_title')}</h3>
          <p className="mt-1 text-xs text-stone-500">{t('report_root_section_subtitle')}</p>
        </div>
        {todayPlant ? <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">{t('plant_section_generated_badge')}</span> : null}
      </div>

      <div className="mt-3">
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

      {renderedSegments.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-stone-200 bg-gradient-to-br from-stone-50 to-stone-100/80 px-3 py-3 text-xs text-stone-600">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-10 w-10 shrink-0 rounded-lg border border-stone-200/80 bg-white/80 p-2">
              <div className="h-full w-full rounded-md bg-gradient-to-b from-stone-200/70 via-stone-300/65 to-stone-400/60" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-stone-700">{t('report_root_empty_title')}</p>
              <p className="mt-1 leading-5 text-stone-600">{t('report_root_empty')}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generateUi.disabled}
          className="w-full min-h-11 rounded-xl bg-stone-800 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t(generateUi.buttonKey)}
        </button>
        <p className="text-xs text-stone-500">
          {statusHint ?? t(generateUi.hintKey)}
        </p>
      </div>
    </section>
  );
};
