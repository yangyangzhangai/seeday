import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, isSameDay } from 'date-fns';
import { Sparkles, ChevronLeft, ChevronRight, PenLine, X, GripVertical } from 'lucide-react';
import type { Report, StickerItem } from '../../store/useReportStore';
import { useReportStore } from '../../store/useReportStore';
import { useChatStore } from '../../store/useChatStore';
import { useMoodStore } from '../../store/useMoodStore';
import { usePlantStore } from '../../store/usePlantStore';
import type { MoodDistributionItem, ActivityDistributionItem } from './reportPageHelpers';
import { getDailyActivityDistribution, getDailyMoodDistribution, getMessagesForReport } from './reportPageHelpers';
import { MoodPieChart } from './MoodPieChart';
import { ActivityCategoryDonut } from './ActivityCategoryDonut';
import { useAuthStore } from '../../store/useAuthStore';
import { callShortInsightAPI } from '../../api/client';
import { PlantCardModal } from './PlantCardModal';
import { PlantImage } from './plant/PlantImage';
import { UpgradeModal } from './UpgradeModal';
import { reportTelemetryEvent } from '../../services/input/reportTelemetryEvent';

interface ReportDetailModalProps {
  selectedReport: Report | null;
  dailyMoodDistribution: MoodDistributionItem[];
  onClose: () => void;
  onBack?: () => void;
  onShowTaskList: (type: 'completed' | 'total') => void;
  generateTimeshineDiary: (reportId: string) => Promise<void>;
  initialPage?: 0 | 1;
  readOnly?: boolean;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  canNavigateNext?: boolean;
}

function buildActivitySummary(dist: ActivityDistributionItem[]): string {
  return dist.map(d => `${d.type}${Math.round(d.minutes)}min`).join('、');
}

function buildMoodSummary(dist: MoodDistributionItem[]): string {
  return dist.map(d => `${d.mood}${Math.round(d.minutes)}min`).join('、');
}

/* ── Default sticker layout ── */
function getDefaultStickers(): StickerItem[] {
  return [
    { id: 'activity', visible: true, x: 0, y: 0 },
    { id: 'mood', visible: true, x: 0, y: 0 },
  ];
}

/* ── Sticker wrapper — draggable card with X delete ── */
function StickerWrapper({
  title,
  children,
  onDelete,
  onDragStart,
  onDragEnd,
  translateY,
  isDragging,
}: {
  title: string;
  children: React.ReactNode;
  onDelete: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onDragEnd: () => void;
  translateY: number;
  isDragging: boolean;
}) {
  return (
    <div
      style={{
        transform: `translateY(${translateY}px)`,
        transition: isDragging ? 'none' : 'transform 0.2s ease',
        zIndex: isDragging ? 10 : 1,
        position: 'relative',
      }}
    >
      <div
        className="rounded-lg p-3"
        style={{
          background: '#faf7f2',
          border: isDragging ? '2px solid rgba(107,90,62,0.35)' : '1px solid rgba(107,90,62,0.12)',
          boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.12)' : 'none',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm" style={{ color: '#4a3a2a' }}>{title}</h3>
          <div className="flex items-center gap-1">
            {/* Drag handle */}
            <div
              onPointerDown={onDragStart}
              onPointerUp={onDragEnd}
              className="flex items-center justify-center w-7 h-7 rounded-full cursor-grab active:cursor-grabbing"
              style={{ color: '#8a7a6a', touchAction: 'none' }}
            >
              <GripVertical size={14} />
            </div>
            {/* Delete button */}
            <button
              onClick={onDelete}
              className="flex items-center justify-center w-7 h-7 rounded-full active:opacity-60 transition"
              style={{ background: 'rgba(180,60,60,0.08)', color: '#8a3a3a' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  selectedReport,
  dailyMoodDistribution,
  onClose,
  onBack,
  generateTimeshineDiary,
  initialPage,
  readOnly,
  onNavigatePrev,
  onNavigateNext,
  canNavigateNext,
}) => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.split('-')[0] || 'en';
  const { updateReport } = useReportStore();
  const chatMessages = useChatStore((state) => state.messages);
  const dateCache = useChatStore((state) => state.dateCache);
  const activityMood = useMoodStore((state) => state.activityMood);
  const todayPlant = usePlantStore((state) => state.todayPlant);
  const isPlus = useAuthStore((state) => state.isPlus);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [noteValue, setNoteValue] = useState('');
  const [activityInsight, setActivityInsight] = useState('');
  const [moodInsight, setMoodInsight] = useState('');
  const [showPlantCard, setShowPlantCard] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [stickers, setStickers] = useState<StickerItem[]>(() =>
    selectedReport?.stickerLayout ?? getDefaultStickers()
  );
  const [dragState, setDragState] = useState<{
    stickerId: string;
    startY: number;
    currentOffset: number;
  } | null>(null);
  const stickerContainerRef = useRef<HTMLDivElement | null>(null);

  const reportMessages = getMessagesForReport(chatMessages, dateCache, selectedReport);
  const activityDistribution = selectedReport
    ? getDailyActivityDistribution(reportMessages, selectedReport)
    : [];
  const moodDistribution = selectedReport
    ? getDailyMoodDistribution(reportMessages, activityMood, selectedReport)
    : dailyMoodDistribution;

  // Check if this report is for today and a plant has been generated
  const isToday = selectedReport ? isSameDay(new Date(selectedReport.date), new Date()) : false;
  const hasPlant = isToday && !!todayPlant;

  useEffect(() => {
    if (!selectedReport) return;
    setActivityInsight('');
    setMoodInsight('');
    const lang = (i18n.language?.split('-')[0] as 'zh' | 'en' | 'it') || 'zh';
    const actSummary = buildActivitySummary(activityDistribution);
    const moodSumm = buildMoodSummary(moodDistribution);
    if (actSummary) {
      callShortInsightAPI({ kind: 'activity', summary: actSummary, lang }).then(setActivityInsight);
    }
    if (moodSumm) {
      callShortInsightAPI({ kind: 'mood', summary: moodSumm, lang }).then(setMoodInsight);
    }
  }, [selectedReport?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setNoteValue(selectedReport?.userNote ?? '');
    setStickers(selectedReport?.stickerLayout ?? getDefaultStickers());
    const page = initialPage ?? 0;
    setActivePage(page);
    requestAnimationFrame(() => {
      if (pagesRef.current) {
        pagesRef.current.scrollLeft = page === 1 ? pagesRef.current.clientWidth : 0;
      }
    });
  }, [selectedReport?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = useCallback(() => {
    const el = pagesRef.current;
    if (!el) return;
    setActivePage(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      const el = pagesRef.current;
      if (!el) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        el.scrollTo({ left: el.clientWidth, behavior: 'smooth' });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        el.scrollTo({ left: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleGenerateDiaryFromPlant = useCallback(() => {
    setShowPlantCard(false);
    if (!selectedReport) return;

    // Switch to diary page
    const el = pagesRef.current;
    if (el) el.scrollTo({ left: el.clientWidth, behavior: 'smooth' });

    // Only generate if not already generated
    if (selectedReport.analysisStatus === 'idle' || (!selectedReport.analysisStatus && !selectedReport.aiAnalysis)) {
      generateTimeshineDiary(selectedReport.id);
    }
  }, [selectedReport, generateTimeshineDiary]);

  const saveNote = useCallback(() => {
    if (!selectedReport) return;
    updateReport(selectedReport.id, { userNote: noteValue });
  }, [selectedReport, noteValue, updateReport]);

  const saveStickers = useCallback((updated: StickerItem[]) => {
    setStickers(updated);
    if (selectedReport) {
      updateReport(selectedReport.id, { stickerLayout: updated });
    }
  }, [selectedReport, updateReport]);

  const handleDeleteSticker = useCallback((stickerId: string) => {
    const updated = stickers.map(s =>
      s.id === stickerId ? { ...s, visible: false } : s
    );
    saveStickers(updated);
    if (!selectedReport) return;
    void reportTelemetryEvent('diary_sticker_deleted', {
      stickerId,
      reportId: selectedReport.id,
      date: format(selectedReport.date, 'yyyy-MM-dd'),
      source: 'report_detail_modal',
    });
  }, [stickers, saveStickers, selectedReport]);

  const handleDragStart = useCallback((stickerId: string, e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragState({ stickerId, startY: e.clientY, currentOffset: 0 });
  }, []);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragState) return;
    setDragState(prev => prev ? { ...prev, currentOffset: e.clientY - prev.startY } : null);
  }, [dragState]);

  const handleDragEnd = useCallback(() => {
    if (!dragState) return;
    const visibleStickers = stickers.filter(s => s.visible);
    if (visibleStickers.length === 2 && Math.abs(dragState.currentOffset) > 40) {
      const swapped = stickers.map(s => {
        if (s.id === visibleStickers[0].id) return { ...s, y: visibleStickers[1].y };
        if (s.id === visibleStickers[1].id) return { ...s, y: visibleStickers[0].y };
        return s;
      });
      const reordered = [
        swapped.find(s => s.id === visibleStickers[1].id)!,
        swapped.find(s => s.id === visibleStickers[0].id)!,
        ...swapped.filter(s => !visibleStickers.some(v => v.id === s.id)),
      ];
      saveStickers(reordered);
      if (selectedReport) {
        void reportTelemetryEvent('diary_sticker_reordered', {
          newOrder: reordered.filter(s => s.visible).map(s => s.id),
          reportId: selectedReport.id,
          date: format(selectedReport.date, 'yyyy-MM-dd'),
          source: 'report_detail_modal',
        });
      }
    }
    setDragState(null);
  }, [dragState, stickers, saveStickers, selectedReport]);

  const getReportDisplayTitle = (report: Report): string => {
    if (report.type === 'daily') return format(report.date, currentLang === 'zh' ? 'yyyy年MM月dd日' : 'MMMM d, yyyy');
    if (report.type === 'weekly') {
      const start = report.startDate ? new Date(report.startDate) : new Date(report.date);
      const end = report.endDate ? new Date(report.endDate) : new Date(report.date);
      return `${format(start, 'MM-dd')} ~ ${format(end, 'MM-dd')} ${t('report_weekly')}`;
    }
    if (report.type === 'monthly') return format(report.date, currentLang === 'zh' ? 'yyyy年MM月' : 'MMMM yyyy');
    if (report.type === 'custom') {
      const start = report.startDate ? new Date(report.startDate) : new Date(report.date);
      const end = report.endDate ? new Date(report.endDate) : new Date(report.date);
      return `${format(start, 'yyyy-MM-dd')} ~ ${format(end, 'yyyy-MM-dd')}`;
    }
    return report.title;
  };

  if (!selectedReport) return null;

  const visibleStickers = stickers.filter(s => s.visible);
  const hasDayNav = !!(onNavigatePrev || onNavigateNext);

  return (
    <>
      <div className="fixed inset-0 z-[60] flex flex-col" style={{ top: 0, bottom: 0, background: '#ffffff' }}>
        {/* Header — parchment cover style */}
      <div
        className="flex items-center px-3"
        style={{
          minHeight: 52,
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)',
          background: '#ffffff',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        <button
          onClick={onBack ?? onClose}
          className="flex items-center gap-1 active:opacity-60 transition pr-3 py-3"
          style={{ color: '#6b5a3e' }}
        >
          <ChevronLeft size={22} />
          <span className="text-sm">{onBack ? t('report_back_diary_book') : t('report_title')}</span>
        </button>
        <div className="flex-1 text-center">
          <h2 className="text-base font-bold font-siyuan" style={{ color: '#4a3a2a' }}>{getReportDisplayTitle(selectedReport)}</h2>
          {hasDayNav && (
            <div className="flex items-center justify-center gap-3 mt-0.5">
              <button
                onClick={onNavigatePrev}
                aria-label={t('diary_nav_prev')}
                className="flex items-center gap-0.5 active:opacity-60 transition text-xs"
                style={{ color: '#8a7a6a' }}
              >
                <ChevronLeft size={13} />
                <span>{t('diary_nav_prev')}</span>
              </button>
              <button
                onClick={onNavigateNext}
                disabled={!canNavigateNext}
                aria-label={t('diary_nav_next')}
                className="flex items-center gap-0.5 active:opacity-60 transition text-xs disabled:opacity-30"
                style={{ color: '#8a7a6a' }}
              >
                <span>{t('diary_nav_next')}</span>
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
        {/* Page dots + flip button */}
        <div className="flex items-center gap-2 pl-3 py-3">
          <div className="flex items-center gap-1.5">
            {[0, 1].map(i => (
              <div
                key={i}
                className="rounded-full transition-all duration-200"
                style={{
                  width: activePage === i ? 14 : 5,
                  height: 5,
                  background: activePage === i ? '#6b5a3e' : 'rgba(107,90,62,0.25)',
                }}
              />
            ))}
          </div>
          <button
            onClick={() => {
              const el = pagesRef.current;
              if (!el) return;
              el.scrollTo({ left: activePage === 0 ? el.clientWidth : 0, behavior: 'smooth' });
            }}
            className="flex items-center justify-center w-7 h-7 rounded-full active:opacity-60 transition"
            style={{ background: 'rgba(107,90,62,0.12)', color: '#6b5a3e' }}
          >
            {activePage === 0 ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>

      {/* Two-page horizontal scroll */}
      <div
        ref={pagesRef}
        onScroll={onScroll}
        style={{
          display: 'flex',
          overflowX: 'scroll',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          flex: 1,
          minHeight: 0,
          background: '#ffffff',
        }}
        className="[&::-webkit-scrollbar]:hidden"
      >
        {/* ── Page 1: 植物 + AI观察日记 ── */}
        <div
          style={{ flexShrink: 0, width: '100%', scrollSnapAlign: 'start', overflowY: 'auto', background: '#ffffff' }}
          className="[&::-webkit-scrollbar]:hidden px-4 py-4 space-y-5 pb-safe"
        >
          {/* Plant: show inline card if plant exists, otherwise show generate button */}
          {hasPlant ? (
            <div
              className="cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => setShowPlantCard(true)}
            >
              <div style={{ height: '220px', overflow: 'hidden', filter: 'drop-shadow(0 2px 12px rgba(80,120,60,0.12))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PlantImage
                  plantId={todayPlant!.plantId}
                  rootType={todayPlant!.rootType}
                  plantStage={todayPlant!.plantStage}
                  imgClassName="h-full w-full object-contain"
                />
              </div>
              {todayPlant!.diaryText && (
                <p
                  className="px-1 pt-1 text-xs leading-relaxed"
                  style={{ color: '#5c4b37', fontFamily: '"LXGW WenKai", cursive', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}
                >
                  {todayPlant!.diaryText}
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowPlantCard(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all active:scale-95 shadow-sm"
              style={{ background: 'linear-gradient(175deg, #eef4eb 0%, #d6eccc 100%)', color: '#4a6a3a', border: '1px solid rgba(74,106,58,0.25)' }}
            >
              <span>🌱</span>
              <span>{t('report_generate_plant')}</span>
            </button>
          )}

          {/* AI 观察日记 — moved here below plant */}
          <div>
            <h3 className="font-bold flex items-center gap-2 mb-2 text-sm" style={{ color: '#333' }}>
              <Sparkles size={15} /> {t('report_observer_analysis')}
            </h3>

            {selectedReport.analysisStatus === 'idle' || (!selectedReport.analysisStatus && !selectedReport.aiAnalysis) ? (
              <div className="text-center py-2">
                <p className="text-sm mb-3 text-gray-500">{t('report_observer_waiting')}</p>
                {isPlus ? (
                  <button
                    onClick={() => {
                      if (window.confirm(t('report_generate_confirm'))) {
                        generateTimeshineDiary(selectedReport.id);
                      }
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
                    style={{ background: '#5a7a4a', color: '#ffffff' }}
                  >
                    {t('report_generate_diary')}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowUpgrade(true)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #f6c343 0%, #e6a817 100%)', color: '#ffffff' }}
                  >
                    {t('report_upgrade_title')}
                  </button>
                )}
              </div>
            ) : selectedReport.analysisStatus === 'generating' ? (
              <div className="flex flex-col items-center justify-center py-4 space-y-2">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin border-gray-400" />
                <p className="text-sm font-medium mt-2 text-gray-600">{t('report_generating')}</p>
                <p className="text-xs opacity-70 text-gray-500">{t('report_generating_patience')}</p>
              </div>
            ) : selectedReport.analysisStatus === 'error' ? (
              <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(180,60,60,0.2)' }}>
                <p className="text-sm mb-2" style={{ color: '#8a3a3a' }}>{selectedReport.errorMessage}</p>
                <button
                  onClick={() => generateTimeshineDiary(selectedReport.id)}
                  className="text-xs px-3 py-1 rounded"
                  style={{ background: 'white', border: '1px solid rgba(180,60,60,0.3)', color: '#8a3a3a' }}
                >
                  {t('retry')}
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                  <Sparkles size={13} style={{ color: '#888' }} />
                  <span className="text-xs font-medium text-gray-500">{t('report_from_prism')}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-700">{selectedReport.aiAnalysis}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-1 text-xs pt-1 pb-4" style={{ color: 'rgba(107,90,62,0.35)' }}>
            <span>{t('report_swipe_hint')}</span>
          </div>
        </div>

        {/* ── Page 2: 贴纸(活动/心情) + 手写日记 ── */}
        <div
          ref={stickerContainerRef}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          style={{ flexShrink: 0, width: '100%', scrollSnapAlign: 'start', overflowY: 'auto', background: '#ffffff', touchAction: dragState ? 'none' : 'auto' }}
          className="[&::-webkit-scrollbar]:hidden px-4 py-4 space-y-4 pb-safe"
        >
          {/* Sticker charts — draggable & deletable */}
          {visibleStickers.map(sticker => {
            const isDragging = dragState?.stickerId === sticker.id;
            const offset = isDragging ? dragState!.currentOffset : 0;

            if (sticker.id === 'activity' && activityDistribution.length > 0) {
              return (
                <StickerWrapper
                  key={sticker.id}
                  title={t('report_activity_category')}
                  onDelete={() => handleDeleteSticker(sticker.id)}
                  onDragStart={(e) => handleDragStart(sticker.id, e)}
                  onDragEnd={handleDragEnd}
                  translateY={offset}
                  isDragging={isDragging}
                >
                  {selectedReport.stats?.actionAnalysis && selectedReport.stats.actionAnalysis.length > 0 ? (
                    <ActivityCategoryDonut data={selectedReport.stats.actionAnalysis} />
                  ) : (
                    <ActivityCategoryDonut data={activityDistribution.map(d => ({ category: d.type, totalMinutes: d.minutes, percentage: 0, subActivities: [] }))} />
                  )}
                  {activityInsight && (
                    <p className="mt-2 text-xs text-center" style={{ color: '#6b5a3e' }}>{activityInsight}</p>
                  )}
                </StickerWrapper>
              );
            }
            if (sticker.id === 'mood' && moodDistribution.length > 0) {
              return (
                <StickerWrapper
                  key={sticker.id}
                  title={t('report_today_mood_spectrum')}
                  onDelete={() => handleDeleteSticker(sticker.id)}
                  onDragStart={(e) => handleDragStart(sticker.id, e)}
                  onDragEnd={handleDragEnd}
                  translateY={offset}
                  isDragging={isDragging}
                >
                  <MoodPieChart distribution={moodDistribution} />
                  {moodInsight && (
                    <p className="mt-2 text-xs text-center" style={{ color: '#6b5a3e' }}>{moodInsight}</p>
                  )}
                </StickerWrapper>
              );
            }
            return null;
          })}

          {/* 手写日记 */}
          <div>
            <h3 className="font-bold flex items-center gap-2 mb-3 text-sm" style={{ color: '#333' }}>
              <PenLine size={15} /> {t('report_my_diary')}
            </h3>
            {readOnly ? (
              <p
                className="w-full text-sm leading-relaxed min-h-[9rem]"
                style={{
                  color: noteValue ? '#333' : 'rgba(0,0,0,0.25)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {noteValue || t('report_diary_empty')}
              </p>
            ) : (
              <>
                <textarea
                  value={noteValue}
                  onChange={e => setNoteValue(e.target.value)}
                  onBlur={saveNote}
                  placeholder={t('report_diary_placeholder')}
                  rows={9}
                  className="w-full rounded-lg p-3 text-sm resize-none focus:outline-none leading-relaxed"
                  style={{
                    background: 'rgba(0,0,0,0.03)',
                    color: '#333',
                    fontFamily: 'inherit',
                    border: '1px solid rgba(0,0,0,0.08)',
                  }}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={saveNote}
                    className="text-xs rounded-full px-3 py-1 active:opacity-70 transition"
                    style={{ background: 'rgba(107,90,62,0.1)', color: '#6b5a3e', border: '1px solid rgba(107,90,62,0.25)' }}
                  >
                    {t('report_save')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>

    {showPlantCard && todayPlant && (
      <PlantCardModal
        plant={todayPlant}
        onClose={() => setShowPlantCard(false)}
        onGenerateDiary={handleGenerateDiaryFromPlant}
      />
    )}

    {showUpgrade && (
      <UpgradeModal onClose={() => setShowUpgrade(false)} />
    )}
    </>
  );
};
