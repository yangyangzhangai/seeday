// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { buildRootSegments, renderRootSegments } from '../../../lib/rootRenderer';
import { mapSourcesToPlantActivities, toPlantCategoryKey } from '../../../lib/plantActivityMapper';
import { useChatStore } from '../../../store/useChatStore';
import { useReportStore } from '../../../store/useReportStore';
import { usePlantStore, resolvePlantDurationForMessage } from '../../../store/usePlantStore';
import type { PlantCategoryKey } from '../../../types/plant';
import { PlantFlipCard } from './PlantFlipCard';
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
  onDiaryDraftChange?: (text: string) => void;
}

export const PlantRootSection: React.FC<PlantRootSectionProps> = ({ onGenerateDiary, onDiaryDraftChange }) => {
  const { t } = useTranslation();
  const reports = useReportStore(state => state.reports);
  const updateReport = useReportStore(state => state.updateReport);
  const generateReport = useReportStore(state => state.generateReport);
  const todaySegments = usePlantStore(state => state.todaySegments);
  const todayPlant = usePlantStore(state => state.todayPlant);
  const selectedRootId = usePlantStore(state => state.selectedRootId);
  const directionOrder = usePlantStore(state => state.directionOrder);
  const loadTodayData = usePlantStore(state => state.loadTodayData);
  const refreshTodaySegments = usePlantStore(state => state.refreshTodaySegments);
  const startActivitySync = usePlantStore(state => state.startActivitySync);
  const stopActivitySync = usePlantStore(state => state.stopActivitySync);
  const setSelectedRootId = usePlantStore(state => state.setSelectedRootId);
  const messages = useChatStore(state => state.messages);
  const loadMessagesForDateRange = useChatStore(state => state.loadMessagesForDateRange);
  const [myDiaryText, setMyDiaryText] = useState('');
  const [isDiaryEditing, setIsDiaryEditing] = useState(false);
  const [isDiarySaving, setIsDiarySaving] = useState(false);
  const activeDiaryReportIdRef = useRef<string | null>(null);
  const pendingDiaryReportIdRef = useRef<string | null>(null);

  const todayDailyReport = useMemo(
    () => reports.find((report) => report.type === 'daily' && isSameDay(new Date(report.date), new Date())) ?? null,
    [reports],
  );

  useEffect(() => {
    const reportId = todayDailyReport?.id ?? null;
    if (activeDiaryReportIdRef.current === reportId) return;
    activeDiaryReportIdRef.current = reportId;
    if (reportId) pendingDiaryReportIdRef.current = reportId;
    const reportNote = todayDailyReport?.userNote ?? '';
    setMyDiaryText((prev) => {
      if (prev.trim().length > 0 && reportNote.trim().length === 0) return prev;
      return reportNote;
    });
    setIsDiaryEditing(false);
    setIsDiarySaving(false);
  }, [todayDailyReport?.id, todayDailyReport?.userNote]);

  useEffect(() => {
    onDiaryDraftChange?.(myDiaryText);
  }, [myDiaryText, onDiaryDraftChange]);

  const persistDiaryNote = useCallback(async () => {
    const nextNote = myDiaryText;
    const nextTrimmed = nextNote.trim();
    let reportId = todayDailyReport?.id ?? pendingDiaryReportIdRef.current;

    if (!reportId) {
      if (!nextTrimmed) return;
      reportId = await generateReport('daily', Date.now());
      pendingDiaryReportIdRef.current = reportId;
    }

    const latest = useReportStore.getState().reports.find(report => report.id === reportId);
    if ((latest?.userNote ?? '') === nextNote) return;
    await updateReport(reportId, { userNote: nextNote });
  }, [generateReport, myDiaryText, todayDailyReport?.id, updateReport]);

  useEffect(() => {
    if (!isDiaryEditing) return;
    const timerId = window.setTimeout(() => {
      void persistDiaryNote();
    }, 600);

    return () => window.clearTimeout(timerId);
  }, [isDiaryEditing, persistDiaryNote]);

  const handleDiarySave = useCallback(async () => {
    setIsDiarySaving(true);
    try {
      await persistDiaryNote();
    } finally {
      setIsDiarySaving(false);
      setIsDiaryEditing(false);
    }
  }, [persistDiaryNote]);

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
    /* Keep root visualization full-size; diary area is reachable by scrolling down. */
    <div className="app-scroll-container h-full relative">

      {/* ── Large canvas area; diary sits right below with a small gap ── */}
      <div className="relative h-[max(460px,62vh)] overflow-hidden">
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

      <div className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+92px)] pt-2">
        <h3 className="text-sm font-bold" style={{ color: '#334155' }}>{t('report_my_diary')}</h3>
        <div className="relative mt-2">
          {isDiaryEditing ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { void handleDiarySave(); }}
              disabled={isDiarySaving}
              className="absolute bottom-2 right-0 z-10 rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-70"
              style={{ color: '#4E7549', background: 'rgba(144, 212, 122, 0.24)' }}
            >
              {isDiarySaving ? `${t('report_save')}...` : t('report_save')}
            </button>
          ) : null}
          <textarea
            value={myDiaryText}
            onChange={(event) => setMyDiaryText(event.target.value)}
            onFocus={() => setIsDiaryEditing(true)}
            onBlur={() => {
              if (!isDiaryEditing) return;
              void persistDiaryNote();
              setIsDiaryEditing(false);
            }}
            placeholder={t('report_diary_placeholder')}
            className="w-full resize-none border-0 border-b border-slate-300/60 bg-transparent px-0 py-1 pr-16 text-sm leading-6 outline-none transition focus:border-[#8FAF92]"
            style={{ minHeight: 128, color: '#334155' }}
          />
        </div>
      </div>
    </div>
  );
};
