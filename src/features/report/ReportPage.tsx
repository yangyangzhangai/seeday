import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, isSameDay, startOfDay, endOfDay, startOfMonth, isSunday, endOfMonth } from 'date-fns';
import { zhCN, enUS, it } from 'date-fns/locale';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { X } from 'lucide-react';
import { useReportStore } from '../../store/useReportStore';
import { useChatStore } from '../../store/useChatStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useMoodStore } from '../../store/useMoodStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { DailyPlantRecord } from '../../types/plant';
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

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

export const ReportPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [date, setDate] = useState<Value>(new Date());
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

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showTaskList, setShowTaskList] = useState<'completed' | 'total' | null>(null);
  const [showEarlyTip, setShowEarlyTip] = useState(false);
  const [showDiaryBook, setShowDiaryBook] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [calendarDevNotice, setCalendarDevNotice] = useState<string | null>(null);
  const [diaryInitialPage, setDiaryInitialPage] = useState<0 | 1 | undefined>(undefined);
  const [openedFromDiaryBook, setOpenedFromDiaryBook] = useState(false);
  const [savedDiaryBookMonth, setSavedDiaryBookMonth] = useState<Date | undefined>(undefined);
  const [savedDiaryBookFlippedCount, setSavedDiaryBookFlippedCount] = useState<number | undefined>(undefined);
  const [diaryNavDate, setDiaryNavDate] = useState<Date | null>(null);
  const [todayDiaryDraft, setTodayDiaryDraft] = useState('');
  const [openedPlantCard, setOpenedPlantCard] = useState<DailyPlantRecord | null>(null);
  const [autoGeneratePlantToken, setAutoGeneratePlantToken] = useState(0);
  const navigate = useNavigate();
  const currentLang = i18n.language?.split('-')[0] || 'en';
  const today = new Date();

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
    () => getDailyMoodDistribution(reportMessages, { activityMood, customMoodLabel, customMoodApplied }, selectedReport),
    [reportMessages, activityMood, customMoodLabel, customMoodApplied, selectedReport]
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

  const handleGenerateDiary = useCallback(async () => {
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
  }, [generateAIDiary, generateReport, reports, todayDiaryDraft, updateReport]);

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
    }
  }, [handleGenerateDiary, searchParams, setSearchParams]);

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
        const latestDailyDate = new Date(Math.max(...dailyReports.map((report) => report.date)));
        setSavedDiaryBookMonth(startOfMonth(latestDailyDate));
        setSavedDiaryBookFlippedCount(latestDailyDate.getDate());
      } else {
        setSavedDiaryBookMonth(undefined);
        setSavedDiaryBookFlippedCount(undefined);
      }
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
              onClick={() => {
                setDate(new Date());
                setCalendarDevNotice(null);
                setShowCalendarModal(true);
              }}
              aria-label={t('report_calendar_view')}
              title={t('report_calendar_view')}
              className="w-11 h-11 flex items-center justify-center bg-white/80 backdrop-blur-xl rounded-2xl border border-[#8fae9130] shadow-[0_8px_20px_rgba(143,174,145,0.12)] cursor-pointer transition-all hover:scale-105 active:scale-95 group"
            >
              <span
                className="material-symbols-outlined text-[#5F7A63] group-hover:text-[#5F7A63] transition-colors"
                style={{ fontSize: 24 }}
              >
                calendar_month
              </span>
            </button>
            <button
              onClick={handleOpenDiaryBook}
              className="h-11 flex items-center gap-2 px-5 rounded-2xl cursor-pointer transition-all hover:scale-105 active:scale-95"
              style={{ background: 'rgba(144, 212, 122, 0.2)', color: '#5F7A63', boxShadow: '0px 2px 2px #C8C8C8', border: 'none' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>book_5</span>
              <span className="text-[13px] font-bold">{t('report_view_diary_book')}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden">
        <PlantRootSection
          autoGeneratePlantToken={autoGeneratePlantToken}
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
        <div className={cn('fixed inset-0 z-50 flex items-center justify-center p-6', APP_MODAL_OVERLAY_CLASS)} onClick={() => { setShowCalendarModal(false); setCalendarDevNotice(null); }}>
          <div
            className={cn(APP_MODAL_CARD_CLASS, 'w-full max-w-xs rounded-[34px] p-4 animate-in fade-in zoom-in-95')}
            style={{
              background: 'rgba(255,255,255,0.72)',
              border: '1px solid rgba(255,255,255,0.82)',
              boxShadow: '0 24px 54px rgba(40,56,44,0.18), inset 0 1px 0 rgba(255,255,255,0.8)',
              backdropFilter: 'blur(18px) saturate(130%)',
              WebkitBackdropFilter: 'blur(18px) saturate(130%)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-slate-700">{t('report_calendar_view')}</span>
              <button onClick={() => { setShowCalendarModal(false); setCalendarDevNotice(null); }} className={cn(APP_MODAL_CLOSE_CLASS, 'p-1')}>
                <X size={24} strokeWidth={1.5} />
              </button>
            </div>
            <div className="calendar-wrapper report-calendar-frost relative flex justify-center">
              {calendarDevNotice ? (
                <div className="pointer-events-none absolute left-1/2 -top-7 z-10 -translate-x-1/2 px-1 py-0.5 text-center text-[12px] font-medium text-[#4a5d4c]">
                  {calendarDevNotice}
                </div>
              ) : null}
              <Calendar
                onChange={setDate}
                value={date}
                onClickDay={(value) => { handleDateClick(value); setShowCalendarModal(false); }}
                locale={i18n.language}
                className="w-full border-none text-[13px] font-medium"
                showNeighboringMonth={false}
                formatDay={(_, calendarDate) => String(calendarDate.getDate())}
                formatShortWeekday={(_, calendarDate) => {
                  return format(calendarDate, 'EEEEE', { locale: calendarLocale });
                }}
                tileContent={({ date: calendarDate, view }) => {
                  if (view !== 'month') return null;
                  const sunday = isSunday(calendarDate);
                  const monthEnd = calendarDate.getDate() === endOfMonth(calendarDate).getDate();
                  if (!sunday && !monthEnd) return null;
                  return (
                    <div className="pointer-events-auto absolute inset-x-0 bottom-[1px] flex items-center justify-center gap-1">
                      {sunday ? (
                        <button
                          type="button"
                          onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            showCalendarFeatureNotice('weekly');
                          }}
                          className="calendar-tag-hit calendar-tag-hit--weekly"
                           aria-label={t('report_weekly_coming_soon')}
                           title={t('report_weekly_coming_soon')}
                        />
                      ) : null}
                      {monthEnd ? (
                        <button
                          type="button"
                          onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            showCalendarFeatureNotice('monthly');
                          }}
                          className="calendar-tag-hit calendar-tag-hit--monthly"
                           aria-label={t('report_monthly_coming_soon')}
                           title={t('report_monthly_coming_soon')}
                        />
                      ) : null}
                    </div>
                  );
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-center gap-4 text-[11px] font-medium text-[#4a5d4c]">
              <button
                type="button"
                className="flex items-center gap-1.5"
                onClick={() => showCalendarFeatureNotice('weekly')}
              >
                <span className="calendar-tag-dot calendar-tag-dot--weekly" />
                <span>{t('report_weekly')}</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5"
                onClick={() => showCalendarFeatureNotice('monthly')}
              >
                <span className="calendar-tag-dot calendar-tag-dot--monthly" />
                <span>{t('report_monthly')}</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5"
                onClick={() => showCalendarFeatureNotice('custom')}
              >
                <span className="calendar-tag-dot calendar-tag-dot--custom" />
                <span>{t('report_custom')}</span>
              </button>
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
        />
      )}
      </div>
    </div>
  );
};
