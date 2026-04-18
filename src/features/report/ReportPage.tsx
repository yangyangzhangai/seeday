import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { format, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { zhCN, enUS, it } from 'date-fns/locale';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { X } from 'lucide-react';
import { useReportStore } from '../../store/useReportStore';
import { useChatStore } from '../../store/useChatStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useMoodStore } from '../../store/useMoodStore';
import { useAuthStore } from '../../store/useAuthStore';
import { usePlantStore } from '../../store/usePlantStore';
import type { DailyPlantRecord } from '../../types/plant';
import { callPlantGenerateAPI } from '../../api/client';
import { cn } from '../../lib/utils';
import {
  APP_MODAL_CARD_CLASS,
  APP_MODAL_CLOSE_CLASS,
  APP_MODAL_OVERLAY_CLASS,
  APP_MODAL_PRIMARY_BUTTON_CLASS,
} from '../../lib/modalTheme';
import { ReportDetailModal } from './ReportDetailModal';
import { TaskListModal } from './TaskListModal';
import { DiaryBookShelf } from './DiaryBookShelf';
import { UpgradeModal } from './UpgradeModal';
import { PlantCardModal } from './PlantCardModal';
import { getDailyMoodDistribution, getMessagesForReport } from './reportPageHelpers';
import { PlantRootSection } from './plant/PlantRootSection';
import { buildPlantGenerateUiState } from './plant/plantGenerateUi';
import { playLoopSound, stopSound } from '../../services/sound/soundService';

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

export const ReportPage = () => {
  const [date, setDate] = useState<Value>(new Date());
  const { reports, generateReport, generateAIDiary, updateReport } = useReportStore();
  const { todos } = useTodoStore();
  const { t, i18n } = useTranslation();
  const chatMessages = useChatStore((state) => state.messages);
  const dateCache = useChatStore((state) => state.dateCache);
  const loadMessagesForDateRange = useChatStore((state) => state.loadMessagesForDateRange);
  const activityMood = useMoodStore((state) => state.activityMood);
  const isPlus = useAuthStore((state) => state.isPlus);
  const user = useAuthStore((state) => state.user);
  const todayPlant = usePlantStore((state) => state.todayPlant);
  const isPlantGenerating = usePlantStore((state) => state.isGenerating);
  const generatePlant = usePlantStore((state) => state.generatePlant);

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showTaskList, setShowTaskList] = useState<'completed' | 'total' | null>(null);
  const [showEarlyTip, setShowEarlyTip] = useState(false);
  const [showDiaryBook, setShowDiaryBook] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [diaryInitialPage, setDiaryInitialPage] = useState<0 | 1 | undefined>(undefined);
  const [openedFromDiaryBook, setOpenedFromDiaryBook] = useState(false);
  const [savedDiaryBookMonth, setSavedDiaryBookMonth] = useState<Date | undefined>(undefined);
  const [savedDiaryBookFlippedCount, setSavedDiaryBookFlippedCount] = useState<number | undefined>(undefined);
  const [diaryNavDate, setDiaryNavDate] = useState<Date | null>(null);
  const [plantStatusHint, setPlantStatusHint] = useState<string | null>(null);
  const [todayDiaryDraft, setTodayDiaryDraft] = useState('');
  const [openedPlantCard, setOpenedPlantCard] = useState<DailyPlantRecord | null>(null);
  const plantActionsRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const currentLang = i18n.language?.split('-')[0] || 'en';

  const selectedReport = reports.find((report) => report.id === selectedReportId) || null;

  useEffect(() => {
    if (!selectedReport || isPlus) return;
    if (selectedReport.teaserText?.trim()) return;
    if (selectedReport.analysisStatus === 'generating') return;
    void generateAIDiary(selectedReport.id);
  }, [selectedReport?.id, selectedReport?.analysisStatus, selectedReport?.teaserText, isPlus, generateAIDiary]);

  const reportMessages = useMemo(
    () => getMessagesForReport(chatMessages, dateCache, selectedReport),
    [chatMessages, dateCache, selectedReport]
  );

  const dailyMoodDistribution = useMemo(
    () => getDailyMoodDistribution(reportMessages, activityMood, selectedReport),
    [reportMessages, activityMood, selectedReport]
  );

  const handleDateClick = async (value: Date) => {
    const existingReport = reports.find(
      (report) => report.type === 'daily' && isSameDay(new Date(report.date), value)
    );

    // Today: calendar cannot view or generate — use "生成日记" button instead
    if (isSameDay(value, today)) return;

    // Best-effort: load messages so ActivityRecordsView & mood chart work.
    // Network errors are swallowed — they must not block opening the diary.
    try {
      await loadMessagesForDateRange(startOfDay(value), endOfDay(value));
    } catch {
      // ignore — diary still opens without message data
    }

    // Historical dates: generate only if no report exists yet, never overwrite
    try {
      if (existingReport) {
        setSelectedReportId(existingReport.id);
      } else {
        const reportId = await generateReport('daily', value.getTime());
        setSelectedReportId(reportId);
      }
    } catch {
      // ignore — avoid silent swallow at call site
    }
  };

  const handleGenerateDiary = async () => {
    const now = new Date();
    if (now.getHours() < 20) {
      setShowEarlyTip(true);
      return;
    }
    const todayReport = reports.find(
      (report) => report.type === 'daily' && isSameDay(new Date(report.date), now)
    );
    setDiaryInitialPage(1);
    let reportId: string;
    if (todayReport) {
      reportId = todayReport.id;
    } else {
      reportId = await generateReport('daily', now.getTime());
    }

    // Keep page-2 "我的日记" synced with the latest draft from root page before opening.
    const latest = useReportStore.getState().reports.find(r => r.id === reportId);
    if ((latest?.userNote ?? '') !== todayDiaryDraft) {
      updateReport(reportId, { userNote: todayDiaryDraft });
    }

    setSelectedReportId(reportId);

    // Auto-trigger diary generation (full AI for plus, teaser for free)
    const report = useReportStore.getState().reports.find(r => r.id === reportId);
    const needsGeneration = report && (
      report.analysisStatus === 'idle' ||
      (!report.analysisStatus && !report.aiAnalysis && !report.teaserText)
    );
    if (needsGeneration) generateAIDiary(reportId);
  };

  const plantIsTooEarly = new Date().getHours() < 20;
  const plantGenerateUi = buildPlantGenerateUiState({
    hasTodayPlant: Boolean(todayPlant),
    isGenerating: isPlantGenerating,
    isTooEarly: plantIsTooEarly,
  });

  const handleGeneratePlant = useCallback(async () => {
    if (plantIsTooEarly) {
      setPlantStatusHint((prev) => (
        prev
          ? null
          : (
              currentLang === 'zh'
                ? '20:00后尝试'
                : (currentLang === 'en' ? t('plant_generate_try_after_20') : t('plant_generate_locked_with_diary_hint'))
            )
      ));
      return;
    }
    if (!window.confirm(t('plant_generate_confirm'))) {
      return;
    }
    playLoopSound('plantGrow');
    try {
      const response = await generatePlant();
      stopSound('plantGrow');
      if (response.status === 'generated') {
        setPlantStatusHint(t('plant_generate_success'));
        return;
      }
      if (response.status === 'already_generated') {
        setPlantStatusHint(t('plant_generate_already'));
        return;
      }
      if (response.status === 'empty_day') {
        setPlantStatusHint(t('plant_generate_empty_day_fallback'));
        return;
      }
      if (response.status === 'monthly_exhausted') {
        setPlantStatusHint(t('plant_generate_monthly_exhausted'));
        return;
      }
      setPlantStatusHint(response.message ?? t('plant_generate_locked_hint'));
    } catch {
      stopSound('plantGrow');
      setPlantStatusHint(t('plant_generate_failed'));
    }
  }, [currentLang, generatePlant, plantIsTooEarly, t]);

  useEffect(() => {
    if (!plantStatusHint) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (plantActionsRef.current?.contains(target)) return;
      setPlantStatusHint(null);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [plantStatusHint]);

  // Keep a ref so the midnight timer can read latest reports without re-scheduling
  const reportsRef = useRef(reports);
  reportsRef.current = reports;

  // Auto-generate today's diary at midnight if the user hasn't done it manually
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
      timer = setTimeout(async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const existingYesterday = reportsRef.current.find(
          r => r.type === 'daily' && isSameDay(new Date(r.date), yesterday)
        );
        if (!existingYesterday) {
          await generateReport('daily', yesterday.getTime());
        }
        try {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
          const langRaw = i18n.language?.toLowerCase() ?? 'en';
          const plantLang: 'zh' | 'en' | 'it' = langRaw.startsWith('zh')
            ? 'zh'
            : langRaw.startsWith('it')
              ? 'it'
              : 'en';
          await callPlantGenerateAPI({
            date: format(yesterday, 'yyyy-MM-dd'),
            timezone,
            lang: plantLang,
          });
        } catch {
          // best-effort auto generation, ignore network failures
        }
        schedule(); // reschedule for next midnight
      }, midnight.getTime() - now.getTime());
    };
    schedule();
    return () => clearTimeout(timer);
  }, [generateReport, i18n.language]);

  const handleOpenDiaryPage = useCallback(async (date: Date, subPage: 0 | 1, flippedCount: number) => {
    // Keep book open during async loading — close it only after modal is ready
    setSavedDiaryBookMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setSavedDiaryBookFlippedCount(flippedCount);
    await loadMessagesForDateRange(startOfDay(date), endOfDay(date));
    const existingReport = reports.find(
      r => r.type === 'daily' && isSameDay(new Date(r.date), date)
    );
    const reportId = existingReport?.id ?? await generateReport('daily', date.getTime());
    // All four updates batch into one render: modal appears, book disappears simultaneously
    setDiaryInitialPage(subPage);
    setOpenedFromDiaryBook(true);
    setSelectedReportId(reportId);
    setShowDiaryBook(false);
  }, [reports, generateReport, loadMessagesForDateRange]);

  const openDiaryForDate = useCallback(async (targetDate: Date) => {
    try {
      await loadMessagesForDateRange(startOfDay(targetDate), endOfDay(targetDate));
    } catch { /* ignore */ }
    const existingReport = reports.find(r => r.type === 'daily' && isSameDay(new Date(r.date), targetDate));
    const reportId = existingReport?.id ?? await generateReport('daily', targetDate.getTime());
    setDiaryNavDate(new Date(targetDate));
    setDiaryInitialPage(undefined);
    setOpenedFromDiaryBook(false);
    setSelectedReportId(reportId);
  }, [reports, generateReport, loadMessagesForDateRange]);

  const handleOpenDiaryBook = useCallback(() => {
    const open = async () => {
      const dayKey = (value: Date) => (
        `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
      );
      const startOfLocalDay = (value: Date) => (
        new Date(value.getFullYear(), value.getMonth(), value.getDate())
      );
      const now = new Date();
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yesterdayKey = dayKey(yesterday);
      const createdAtSource = user?.created_at ? new Date(user.created_at) : null;
      const createdAtDay = createdAtSource && !Number.isNaN(createdAtSource.getTime())
        ? startOfLocalDay(createdAtSource)
        : null;
      const backfillStart = createdAtDay && createdAtDay.getTime() <= yesterday.getTime()
        ? createdAtDay
        : yesterday;

      const dailyReports = useReportStore.getState().reports.filter((report) => report.type === 'daily');
      const existingKeys = new Set(
        dailyReports
          .map((report) => startOfLocalDay(new Date(report.date)))
          .filter((date) => dayKey(date) <= yesterdayKey)
          .map(dayKey),
      );

      let cursor = new Date(backfillStart);
      while (dayKey(cursor) <= yesterdayKey) {
        const key = dayKey(cursor);
        if (!existingKeys.has(key)) {
          await generateReport('daily', cursor.getTime());
          existingKeys.add(key);
        }
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      }

      setSavedDiaryBookMonth(new Date(yesterday.getFullYear(), yesterday.getMonth(), 1));
      setSavedDiaryBookFlippedCount(yesterday.getDate());
      setShowDiaryBook(true);
    };
    void open();
  }, [generateReport, user?.created_at]);

  const handleDiaryNavPrev = useCallback(async () => {
    const base = diaryNavDate ?? new Date();
    const prev = new Date(base);
    prev.setDate(prev.getDate() - 1);
    await openDiaryForDate(prev);
  }, [diaryNavDate, openDiaryForDate]);

  const handleDiaryNavNext = useCallback(async () => {
    if (!diaryNavDate) return;
    const next = new Date(diaryNavDate);
    next.setDate(next.getDate() + 1);
    await openDiaryForDate(next);
  }, [diaryNavDate, openDiaryForDate]);

  const today = new Date();
  const calendarLocale = currentLang === 'zh' ? zhCN : currentLang === 'it' ? it : enUS;

  return (
    <div className="flex h-full items-center justify-center bg-transparent px-0 md:px-8">
      <div className="app-mobile-page-frame relative flex h-full w-full max-w-[430px] flex-col overflow-hidden text-slate-900 [box-shadow:0_0_0_1px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.1)] md:h-[calc(100%-24px)] md:max-w-[980px] md:rounded-[30px] md:border md:border-white/70 md:bg-[#fcfaf7]/85 md:[box-shadow:0_0_0_1px_rgba(255,255,255,0.45),0_24px_64px_rgba(15,23,42,0.12)]">
      <header
        className="app-mobile-page-header relative sticky top-0 z-10 px-4 pb-3 pt-11"
        style={{
          background: 'rgba(252,250,247,0.38)',
          backdropFilter: 'blur(14px) saturate(150%)',
          WebkitBackdropFilter: 'blur(14px) saturate(150%)',
        }}
      >
        <div className="grid grid-cols-[1fr_auto] items-start gap-x-3">
          <h1 className="text-2xl font-extrabold leading-none" style={{ color: '#1e293b', letterSpacing: '-0.02em' }}>{t('report_title')}</h1>
          <div ref={plantActionsRef} className="relative mt-[1px] flex flex-col items-end gap-1.5 flex-shrink-0">
            <button
              onClick={handleOpenDiaryBook}
              className="rounded-full px-2 py-1 active:opacity-70 transition whitespace-nowrap"
              style={{ width: 'clamp(100px, 28vw, 116px)', fontSize: 'clamp(11px, 2.9vw, 13px)', fontWeight: 500, background: 'rgba(144.67, 212.06, 122.21, 0.2)', color: '#5F7A63', border: 'none', boxShadow: '0px 2px 2px #C8C8C8', lineHeight: '1.2rem' }}
            >
              {t('report_view_diary_book')}
            </button>
            <div className="flex flex-col items-center" style={{ width: 'clamp(100px, 28vw, 116px)' }}>
              <button
                onClick={handleGeneratePlant}
                disabled={plantGenerateUi.disabled}
                className="rounded-full px-2 py-1 transition whitespace-nowrap disabled:opacity-55 disabled:cursor-not-allowed active:opacity-70"
                style={{ width: '100%', fontSize: 'clamp(11px, 2.9vw, 13px)', fontWeight: 500, background: 'rgba(144.67, 212.06, 122.21, 0.2)', color: '#5F7A63', border: 'none', boxShadow: '0px 2px 2px #C8C8C8', lineHeight: '1.2rem' }}
              >
                {t(plantGenerateUi.buttonKey)}
              </button>
              {plantStatusHint ? (
                <p className="pointer-events-none mt-0.5 w-full text-center text-[10px] font-medium whitespace-nowrap" style={{ color: '#5f6f65' }}>
                  {plantStatusHint}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowCalendarModal(true)}
          className="mt-2 text-left font-medium transition active:opacity-70"
          style={{ fontSize: '14px', color: '#000000' }}
        >
          {format(today, currentLang === 'zh' ? 'yyyy年M月d日 EEEE' : 'EEEE, MMMM d, yyyy', { locale: calendarLocale })}
        </button>
      </header>

      <div className="flex-1 relative overflow-hidden">
        <PlantRootSection
          onGenerateDiary={handleGenerateDiary}
          onDiaryDraftChange={setTodayDiaryDraft}
        />
      </div>

      {showEarlyTip && (
        <div className={cn('fixed inset-0 z-50 flex items-center justify-center p-6', APP_MODAL_OVERLAY_CLASS)} onClick={() => setShowEarlyTip(false)}>
          <div className={cn(APP_MODAL_CARD_CLASS, 'w-full max-w-xs rounded-3xl p-6 text-center animate-in fade-in zoom-in-95')} onClick={e => e.stopPropagation()}>
            <p className="text-sm text-slate-700 leading-relaxed">{t('report_early_tip')}</p>
            <button onClick={() => setShowEarlyTip(false)} className={cn(APP_MODAL_PRIMARY_BUTTON_CLASS, 'mt-4 text-xs px-4 py-1.5 rounded-full active:opacity-70')}>
              {t('report_early_tip_ok')}
            </button>
          </div>
        </div>
      )}

      {showCalendarModal && (
        <div className={cn('fixed inset-0 z-50 flex items-center justify-center p-6', APP_MODAL_OVERLAY_CLASS)} onClick={() => setShowCalendarModal(false)}>
          <div className={cn(APP_MODAL_CARD_CLASS, 'w-full max-w-xs rounded-3xl p-4 animate-in fade-in zoom-in-95')} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-slate-700">{t('report_calendar_view')}</span>
              <button onClick={() => setShowCalendarModal(false)} className={cn(APP_MODAL_CLOSE_CLASS, 'p-1')}>
                <X size={24} strokeWidth={1.5} />
              </button>
            </div>
            <div className="calendar-wrapper flex justify-center">
              <Calendar
                onChange={setDate}
                value={date}
                onClickDay={(value) => { handleDateClick(value); setShowCalendarModal(false); }}
                locale={i18n.language}
                className="w-full border-none text-xs"
                showNeighboringMonth={false}
                formatDay={(_, calendarDate) => String(calendarDate.getDate())}
                formatShortWeekday={(_, calendarDate) => {
                  return format(calendarDate, 'EEEEE', { locale: calendarLocale });
                }}
              />
            </div>
          </div>
        </div>
      )}

      <ReportDetailModal
        selectedReport={selectedReport}
        isPlus={isPlus}
        onUpgradeClick={() => navigate('/upgrade')}
        dailyMoodDistribution={dailyMoodDistribution}
        onClose={() => { setSelectedReportId(null); setOpenedFromDiaryBook(false); setDiaryInitialPage(undefined); setDiaryNavDate(null); }}
        onBack={openedFromDiaryBook ? () => {
          setSelectedReportId(null);
          setOpenedFromDiaryBook(false);
          setDiaryInitialPage(undefined);
          setDiaryNavDate(null);
          setShowDiaryBook(true); // reopen diary book
        } : undefined}
        onOpenPlantCard={(plant) => setOpenedPlantCard(plant)}
        onShowTaskList={setShowTaskList}
        generateAIDiary={generateAIDiary}
        initialPage={diaryInitialPage}
        readOnly={(() => {
          if (!selectedReport) return false;
          const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          return new Date(selectedReport.date) < todayStart;
        })()}
        onNavigatePrev={diaryNavDate ? handleDiaryNavPrev : undefined}
        onNavigateNext={diaryNavDate ? handleDiaryNavNext : undefined}
        canNavigateNext={diaryNavDate ? diaryNavDate.toDateString() !== today.toDateString() : false}
      />

      <TaskListModal
        showTaskList={showTaskList}
        selectedReport={selectedReport}
        todos={todos}
        onClose={() => setShowTaskList(null)}
      />

      {showDiaryBook && (
        <DiaryBookShelf
          onClose={() => { setShowDiaryBook(false); setSavedDiaryBookMonth(undefined); setSavedDiaryBookFlippedCount(undefined); }}
          reports={reports}
          onOpenDiaryPage={handleOpenDiaryPage}
          initialOpenMonth={savedDiaryBookMonth}
          initialOpenFlippedCount={savedDiaryBookFlippedCount}
        />
      )}

      {showUpgrade && (
        <UpgradeModal onClose={() => setShowUpgrade(false)} />
      )}

      {openedPlantCard && (
        <PlantCardModal
          plant={openedPlantCard}
          onClose={() => setOpenedPlantCard(null)}
          onGenerateDiary={handleGenerateDiary}
        />
      )}
      </div>
    </div>
  );
};
