import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, isSameDay, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { zhCN, enUS, it } from 'date-fns/locale';
import { useReportStore } from '../../store/useReportStore';
import { useChatStore } from '../../store/useChatStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useMoodStore } from '../../store/useMoodStore';
import { useAuthStore } from '../../store/useAuthStore';
import { usePlantStore } from '../../store/usePlantStore';
import type { DailyPlantRecord } from '../../types/plant';
import { cn } from '../../lib/utils';
import {
  APP_GLASS_BUTTON_BASE_STYLE,
  APP_GREEN_GLASS_BUTTON_STYLE,
  APP_GREEN_GLASS_TEXT,
  APP_MODAL_CARD_CLASS,
  APP_MODAL_OVERLAY_CLASS,
  APP_MODAL_PRIMARY_BUTTON_CLASS,
} from '../../lib/modalTheme';
import { ReportDetailModal } from './ReportDetailModal';
import { TaskListModal } from './TaskListModal';
import { DiaryBookShelf } from './DiaryBookShelf';
import { UpgradeModal } from './UpgradeModal';
import { PlantCardModal } from './PlantCardModal';
import { ReportCalendarModal, type ReportCalendarValue } from './ReportCalendarModal';
import {
  getDailyMoodDistribution,
  getMessagesForReport,
  findDailyReportForDate,
  findTodayDailyReport,
  isFutureDiaryDate,
  reportHasGeneratedDiary,
  resolveDiaryBookInitialTarget,
} from './reportPageHelpers';
import { PlantRootSection } from './plant/PlantRootSection';

export const ReportPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [date, setDate] = useState<ReportCalendarValue>(new Date());
  const { reports, generateReport, generateAIDiary, updateReport } = useReportStore();
  const { todos } = useTodoStore();
  const { t, i18n } = useTranslation();
  const chatMessages = useChatStore((state) => state.messages);
  const dateCache = useChatStore((state) => state.dateCache);
  const loadMessagesForDateRange = useChatStore((state) => state.loadMessagesForDateRange);
  const activityMood = useMoodStore((state) => state.activityMood);
  const customMoodLabel = useMoodStore((state) => state.customMoodLabel);
  const customMoodApplied = useMoodStore((state) => state.customMoodApplied);
  const isPlus = useAuthStore((state) => state.isPlus);
  const user = useAuthStore((state) => state.user);
  const loadPlantHistory = usePlantStore((state) => state.loadPlantHistory);
  const today = new Date();
  const todayDailyReport = findTodayDailyReport(reports, today);
  const shouldOpenTodayDiaryOnMount = reportHasGeneratedDiary(todayDailyReport)
    || searchParams.get('action') === 'open-today-diary';

  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    () => shouldOpenTodayDiaryOnMount ? todayDailyReport?.id ?? null : null,
  );
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showTaskList, setShowTaskList] = useState<'completed' | 'total' | null>(null);
  const [showEarlyTip, setShowEarlyTip] = useState(false);
  const [showDiaryBook, setShowDiaryBook] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [calendarDevNotice, setCalendarDevNotice] = useState<string | null>(null);
  const [diaryInitialPage, setDiaryInitialPage] = useState<0 | 1 | undefined>(
    () => shouldOpenTodayDiaryOnMount ? 0 : undefined,
  );
  const [openedFromDiaryBook, setOpenedFromDiaryBook] = useState(false);
  const [savedDiaryBookMonth, setSavedDiaryBookMonth] = useState<Date | undefined>(undefined);
  const [savedDiaryBookFlippedCount, setSavedDiaryBookFlippedCount] = useState<number | undefined>(undefined);
  const [diaryNavDate, setDiaryNavDate] = useState<Date | null>(null);
  const [isTodayDiaryHome, setIsTodayDiaryHome] = useState(shouldOpenTodayDiaryOnMount);
  const [todayDiaryDraft, setTodayDiaryDraft] = useState('');
  const [openedPlantCard, setOpenedPlantCard] = useState<DailyPlantRecord | null>(null);
  const [autoGeneratePlantToken, setAutoGeneratePlantToken] = useState(0);
  const navigate = useNavigate();
  const currentLang = i18n.language?.split('-')[0] || 'en';

  const selectedReport = reports.find((report) => report.id === selectedReportId) || null;
  const isPrimaryTodayDiary = Boolean(
    isTodayDiaryHome
    && selectedReport
    && todayDailyReport
    && selectedReport.id === todayDailyReport.id
    && !openedFromDiaryBook
    && !diaryNavDate,
  );

  useEffect(() => {
    if (!todayDailyReport || !reportHasGeneratedDiary(todayDailyReport)) return;
    if (openedFromDiaryBook || diaryNavDate || showDiaryBook) return;
    setIsTodayDiaryHome(true);
    setSelectedReportId(todayDailyReport.id);
    setDiaryInitialPage(current => current ?? 0);
  }, [
    diaryNavDate,
    openedFromDiaryBook,
    showDiaryBook,
    todayDailyReport?.aiAnalysis,
    todayDailyReport?.id,
    todayDailyReport?.teaserText,
  ]);

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
    () => getDailyMoodDistribution(reportMessages, { activityMood, customMoodLabel, customMoodApplied }, selectedReport),
    [reportMessages, activityMood, customMoodLabel, customMoodApplied, selectedReport]
  );

  const handleDateClick = async (value: Date) => {
    const existingReport = findDailyReportForDate(reports, value);

    // Today and future days: calendar cannot view or generate.
    if (isSameDay(value, today) || isFutureDiaryDate(value, today)) return;

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

  const handleGenerateDiary = useCallback(async () => {
    const now = new Date();
    if (now.getHours() < 20) {
      setShowEarlyTip(true);
      return;
    }
    const todayReport = findDailyReportForDate(reports, now);
    setDiaryInitialPage(1);
    setIsTodayDiaryHome(true);
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
    setOpenedFromDiaryBook(false);
    setDiaryNavDate(null);

    // Auto-trigger diary generation (full AI for plus, teaser for free)
    const report = useReportStore.getState().reports.find(r => r.id === reportId);
    const needsGeneration = report && (
      report.analysisStatus === 'idle' ||
      (!report.analysisStatus && !report.aiAnalysis && !report.teaserText)
    );
    if (needsGeneration) generateAIDiary(reportId);
  }, [generateAIDiary, generateReport, reports, todayDiaryDraft, updateReport]);

  const openTodayDiaryDetail = useCallback(async (options?: { initialPage?: 0 | 1 }) => {
    const now = new Date();
    setIsTodayDiaryHome(true);
    let reportId = findDailyReportForDate(reports, now)?.id;

    if (!reportId) {
      reportId = await generateReport('daily', now.getTime());
    }

    setSelectedReportId(reportId);
    setDiaryInitialPage(options?.initialPage);
    setOpenedFromDiaryBook(false);
    setDiaryNavDate(null);
  }, [generateReport, reports]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (!action) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('action');
    setSearchParams(nextParams, { replace: true });

    if (action === 'generate-plant') {
      setAutoGeneratePlantToken((prev) => prev + 1);
      return;
    }
    if (action === 'generate-diary') {
      void handleGenerateDiary();
      return;
    }
    if (action === 'open-today-diary') {
      void openTodayDiaryDetail({ initialPage: 0 });
    }
  }, [handleGenerateDiary, openTodayDiaryDetail, searchParams, setSearchParams]);

  const handleOpenDiaryPage = useCallback(async (date: Date, subPage: 0 | 1, flippedCount: number) => {
    // Keep book open during async loading — close it only after modal is ready
    setSavedDiaryBookMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setSavedDiaryBookFlippedCount(flippedCount);
    await loadMessagesForDateRange(startOfDay(date), endOfDay(date));
    const existingReport = findDailyReportForDate(reports, date);
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
    const existingReport = findDailyReportForDate(reports, targetDate);
    const reportId = existingReport?.id ?? await generateReport('daily', targetDate.getTime());
    setDiaryNavDate(new Date(targetDate));
    setDiaryInitialPage(undefined);
    setOpenedFromDiaryBook(false);
    setSelectedReportId(reportId);
  }, [reports, generateReport, loadMessagesForDateRange]);

  const handleOpenDiaryBook = useCallback(() => {
    const open = async () => {
      const startOfLocalDay = (value: Date) => (
        new Date(value.getFullYear(), value.getMonth(), value.getDate())
      );
      const now = new Date();

      let dailyReports = useReportStore.getState().reports.filter((report) => report.type === 'daily');

      // If user has no diary book yet, create the first one based on
      // the first event/mood card date.
      if (dailyReports.length === 0) {
        const createdAtSource = user?.created_at ? new Date(user.created_at) : null;
        const rangeStart = createdAtSource && !Number.isNaN(createdAtSource.getTime())
          ? startOfLocalDay(createdAtSource)
          : startOfLocalDay(now);
        const historyMessages = await useChatStore.getState().getMessagesForDateRange(rangeStart, now);
        const firstRecord = historyMessages
          .filter((message) => message.mode === 'record')
          .sort((left, right) => left.timestamp - right.timestamp)[0];

        if (firstRecord) {
          const firstRecordDay = startOfLocalDay(new Date(firstRecord.timestamp));
          await generateReport('daily', firstRecordDay.getTime());
          dailyReports = useReportStore.getState().reports.filter((report) => report.type === 'daily');
        }
      }

      if (dailyReports.length > 0) {
        const initialDiaryDate = resolveDiaryBookInitialTarget(dailyReports, now);
        if (initialDiaryDate) {
          const initialMonth = startOfMonth(initialDiaryDate);
          await loadPlantHistory(
            format(initialMonth, 'yyyy-MM-dd'),
            format(endOfMonth(initialMonth), 'yyyy-MM-dd'),
          );
          setSavedDiaryBookMonth(initialMonth);
          setSavedDiaryBookFlippedCount(initialDiaryDate.getDate());
        } else {
          setSavedDiaryBookMonth(undefined);
          setSavedDiaryBookFlippedCount(undefined);
        }
      } else {
        setSavedDiaryBookMonth(undefined);
        setSavedDiaryBookFlippedCount(undefined);
      }
      setShowDiaryBook(true);
    };
    void open();
  }, [generateReport, loadPlantHistory, user?.created_at]);

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

  const calendarLocale = currentLang === 'zh' ? zhCN : currentLang === 'it' ? it : enUS;
  const isZh = currentLang === 'zh';
  const showCalendarFeatureNotice = useCallback((kind: 'weekly' | 'monthly' | 'custom') => {
    if (kind === 'weekly') {
      setCalendarDevNotice(t('report_weekly_coming_soon'));
    } else if (kind === 'monthly') {
      setCalendarDevNotice(t('report_monthly_coming_soon'));
    } else {
      setCalendarDevNotice(t('report_custom_coming_soon'));
    }
    window.setTimeout(() => setCalendarDevNotice(null), 1800);
  }, [t]);

  const handleOpenCalendar = useCallback(() => {
    setDate(new Date());
    setCalendarDevNotice(null);
    setShowCalendarModal(true);
  }, []);

  const handleCloseCalendar = useCallback(() => {
    setShowCalendarModal(false);
    setCalendarDevNotice(null);
  }, []);

  const restoreTodayDiaryHome = useCallback(() => {
    setSelectedReportId(isTodayDiaryHome ? todayDailyReport?.id ?? null : null);
    setOpenedFromDiaryBook(false);
    setDiaryInitialPage(isTodayDiaryHome ? 0 : undefined);
    setDiaryNavDate(null);
  }, [isTodayDiaryHome, todayDailyReport?.id]);

  const handleCloseReportDetail = useCallback(() => {
    if (isPrimaryTodayDiary) return;
    restoreTodayDiaryHome();
  }, [isPrimaryTodayDiary, restoreTodayDiaryHome]);

  const handleBackToDiaryBook = useCallback(() => {
    restoreTodayDiaryHome();
    setShowDiaryBook(true);
  }, [restoreTodayDiaryHome]);

  const handleCloseDiaryBook = useCallback(() => {
    setShowDiaryBook(false);
    setSavedDiaryBookMonth(undefined);
    setSavedDiaryBookFlippedCount(undefined);
  }, []);

  return (
    <div className="flex h-full items-center justify-center bg-transparent px-0 md:px-8">
      <div className="app-mobile-page-frame relative flex h-full w-full max-w-[430px] flex-col overflow-hidden text-slate-900 [box-shadow:0_0_0_1px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.1)] md:h-[calc(100%-24px)] md:max-w-[980px] md:rounded-[30px] md:border md:border-white/70 md:bg-[#fcfaf7]/85 md:[box-shadow:0_0_0_1px_rgba(255,255,255,0.45),0_24px_64px_rgba(15,23,42,0.12)]">
      {!isTodayDiaryHome ? (
        <>
      <header
        className="app-mobile-page-header relative sticky top-0 z-10 px-4 pb-3 pt-11"
        style={{
          background: 'rgba(252,250,247,0.38)',
          backdropFilter: 'blur(14px) saturate(150%)',
          WebkitBackdropFilter: 'blur(14px) saturate(150%)',
        }}
      >
        <div className="grid grid-cols-[1fr_auto] items-start gap-x-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold leading-none" style={{ color: '#1e293b', letterSpacing: '-0.02em' }}>{t('report_title')}</h1>
            <div className="mt-2">
              <p className="text-[13px] font-medium leading-none text-[#4a5d4c]">
                {format(today, isZh ? 'yyyy年M月d日' : 'PPP', { locale: calendarLocale })}
              </p>
              <p className="mt-1 text-[10px] font-medium leading-none text-[#4a5d4c]">
                {format(today, 'EEEE', { locale: calendarLocale })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-self-end">
            <button
              onClick={handleOpenCalendar}
              aria-label={t('report_calendar_view')}
              title={t('report_calendar_view')}
              className="w-11 h-11 flex items-center justify-center rounded-2xl cursor-pointer transition-all hover:scale-105 active:scale-95 group"
              style={{
                ...APP_GREEN_GLASS_BUTTON_STYLE,
              }}
            >
              <span
                className="material-symbols-outlined group-hover:text-[#426D56] transition-colors"
                style={{ fontSize: 24, color: APP_GREEN_GLASS_TEXT }}
              >
                calendar_month
              </span>
            </button>
            <button
              onClick={handleOpenDiaryBook}
              aria-label={t('report_view_diary_book')}
              title={t('report_view_diary_book')}
              className="w-11 h-11 flex items-center justify-center rounded-2xl cursor-pointer transition-all hover:scale-105 active:scale-95"
              style={{
                ...APP_GREEN_GLASS_BUTTON_STYLE,
                color: APP_GREEN_GLASS_TEXT,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>book_5</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden">
        <PlantRootSection
          autoGeneratePlantToken={autoGeneratePlantToken}
          onDiaryDraftChange={setTodayDiaryDraft}
          onOpenTodayDiary={handleGenerateDiary}
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

        </>
      ) : (
        <div className="h-full w-full bg-white" aria-hidden="true" />
      )}

      {showCalendarModal ? (
        <ReportCalendarModal
          value={date}
          today={today}
          locale={i18n.language}
          dateLocale={calendarLocale}
          notice={calendarDevNotice}
          onChange={setDate}
          onClickDay={(value) => {
            handleDateClick(value);
            handleCloseCalendar();
          }}
          onClose={handleCloseCalendar}
          onFeatureNotice={showCalendarFeatureNotice}
        />
      ) : null}

      <ReportDetailModal
        selectedReport={selectedReport}
        isPlus={isPlus}
        onUpgradeClick={() => navigate('/upgrade')}
        dailyMoodDistribution={dailyMoodDistribution}
        onClose={handleCloseReportDetail}
        onBack={openedFromDiaryBook ? handleBackToDiaryBook : undefined}
        onOpenPlantCard={(plant) => setOpenedPlantCard(plant)}
        onShowTaskList={setShowTaskList}
        generateAIDiary={generateAIDiary}
        initialPage={diaryInitialPage}
        presentation={isPrimaryTodayDiary ? 'page' : 'modal'}
        onOpenCalendar={isPrimaryTodayDiary ? handleOpenCalendar : undefined}
        onOpenDiaryBook={isPrimaryTodayDiary ? handleOpenDiaryBook : undefined}
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
          onClose={handleCloseDiaryBook}
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
        />
      )}
      </div>
    </div>
  );
};
