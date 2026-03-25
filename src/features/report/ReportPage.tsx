import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { zhCN, enUS, it } from 'date-fns/locale';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { X } from 'lucide-react';
import { useReportStore } from '../../store/useReportStore';
import { useChatStore } from '../../store/useChatStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useMoodStore } from '../../store/useMoodStore';
import { ReportDetailModal } from './ReportDetailModal';
import { TaskListModal } from './TaskListModal';
import { DiaryBookShelf } from './DiaryBookShelf';
import { getDailyMoodDistribution } from './reportPageHelpers';
import { PlantRootSection } from './plant/PlantRootSection';

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

export const ReportPage = () => {
  const [date, setDate] = useState<Value>(new Date());
  const { reports, generateReport, generateTimeshineDiary } = useReportStore();
  const { todos } = useTodoStore();
  const { t, i18n } = useTranslation();
  const chatMessages = useChatStore((state) => state.messages);
  const loadMessagesForDateRange = useChatStore((state) => state.loadMessagesForDateRange);
  const activityMood = useMoodStore((state) => state.activityMood);

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showTaskList, setShowTaskList] = useState<'completed' | 'total' | null>(null);
  const [showEarlyTip, setShowEarlyTip] = useState(false);
  const [showDiaryBook, setShowDiaryBook] = useState(false);
  const [diaryInitialPage, setDiaryInitialPage] = useState<0 | 1 | undefined>(undefined);
  const [openedFromDiaryBook, setOpenedFromDiaryBook] = useState(false);
  const [savedDiaryBookMonth, setSavedDiaryBookMonth] = useState<Date | undefined>(undefined);
  const [savedDiaryBookFlippedCount, setSavedDiaryBookFlippedCount] = useState<number | undefined>(undefined);

  const selectedReport = reports.find((report) => report.id === selectedReportId) || null;

  const dailyMoodDistribution = useMemo(
    () => getDailyMoodDistribution(chatMessages, activityMood, selectedReport),
    [chatMessages, activityMood, selectedReport]
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
    if (todayReport) {
      setSelectedReportId(todayReport.id);
    } else {
      const reportId = await generateReport('daily', now.getTime());
      setSelectedReportId(reportId);
    }
  };

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
        const todayNow = new Date();
        const existing = reportsRef.current.find(
          r => r.type === 'daily' && isSameDay(new Date(r.date), todayNow)
        );
        if (!existing) {
          await generateReport('daily', todayNow.getTime());
        }
        schedule(); // reschedule for next midnight
      }, midnight.getTime() - now.getTime());
    };
    schedule();
    return () => clearTimeout(timer);
  }, [generateReport]);

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

  const today = new Date();
  const currentLang = i18n.language?.split('-')[0] || 'en';
  const calendarLocale = currentLang === 'zh' ? zhCN : currentLang === 'it' ? it : enUS;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-y-auto pb-safe" style={{ background: '#ffffff' }}>
      <header className="p-4 sticky top-0 z-10 relative" style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <h1 className="text-lg font-bold text-center" style={{ color: '#4a3a2a' }}>日记</h1>
        <button
          onClick={() => setShowCalendarModal(true)}
          className="mt-1 w-full text-center text-sm active:opacity-70 transition"
          style={{ color: '#7a6a5a' }}
        >
          {format(today, currentLang === 'zh' ? 'yyyy年M月d日 EEEE' : 'EEEE, MMMM d, yyyy', { locale: calendarLocale })}
        </button>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-end gap-1.5">
          <button
            onClick={() => setShowDiaryBook(true)}
            className="rounded-full px-2 py-0.5 active:opacity-70 transition whitespace-nowrap"
            style={{ fontSize: 'clamp(9px, 2.5vw, 11px)', background: 'rgba(107,90,62,0.08)', color: '#6b5a3e', border: '1px solid rgba(107,90,62,0.2)' }}
          >
            查看日记本
          </button>
          <button
            onClick={handleGenerateDiary}
            className="rounded-full px-2 py-0.5 active:opacity-70 transition whitespace-nowrap"
            style={{ fontSize: 'clamp(9px, 2.5vw, 11px)', background: 'rgba(107,90,62,0.08)', color: '#6b5a3e', border: '1px solid rgba(107,90,62,0.2)' }}
          >
            生成日记
          </button>
        </div>
      </header>

      <div className="p-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] space-y-6">
        <PlantRootSection />
      </div>

      {showEarlyTip && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setShowEarlyTip(false)}>
          <div className="bg-white w-full max-w-xs rounded-2xl p-6 text-center animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <p className="text-sm text-gray-700 leading-relaxed">日记只可生成一次，可以在 20:00 之后再来看看哦～</p>
            <button onClick={() => setShowEarlyTip(false)} className="mt-4 text-xs text-amber-600 border border-amber-200 rounded-full px-4 py-1.5 bg-amber-50 active:opacity-70 transition">
              知道了
            </button>
          </div>
        </div>
      )}

      {showCalendarModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setShowCalendarModal(false)}>
          <div className="bg-white w-full max-w-xs rounded-2xl p-4 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-gray-700">{t('report_calendar_view')}</span>
              <button onClick={() => setShowCalendarModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
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
        dailyMoodDistribution={dailyMoodDistribution}
        onClose={() => { setSelectedReportId(null); setOpenedFromDiaryBook(false); setDiaryInitialPage(undefined); }}
        onBack={openedFromDiaryBook ? () => {
          setSelectedReportId(null);
          setOpenedFromDiaryBook(false);
          setDiaryInitialPage(undefined);
          setShowDiaryBook(true); // reopen diary book
        } : undefined}
        onShowTaskList={setShowTaskList}
        generateTimeshineDiary={generateTimeshineDiary}
        initialPage={diaryInitialPage}
        readOnly={(() => {
          if (!selectedReport) return false;
          const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          return new Date(selectedReport.date) < todayStart;
        })()}
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
    </div>
  );
};
