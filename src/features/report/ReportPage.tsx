import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, isSameDay } from 'date-fns';
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
import { DiaryBookViewer } from './DiaryBookViewer';
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
  const activityMood = useMoodStore((state) => state.activityMood);

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showTaskList, setShowTaskList] = useState<'completed' | 'total' | null>(null);
  const [showEarlyTip, setShowEarlyTip] = useState(false);
  const [showDiaryBook, setShowDiaryBook] = useState(false);

  const selectedReport = reports.find((report) => report.id === selectedReportId) || null;

  const dailyMoodDistribution = useMemo(
    () => getDailyMoodDistribution(chatMessages, activityMood, selectedReport),
    [chatMessages, activityMood, selectedReport]
  );

  const handleDateClick = async (value: Date) => {
    const existingReport = reports.find(
      (report) => report.type === 'daily' && isSameDay(new Date(report.date), value)
    );

    const needRegenerate = !existingReport || !existingReport.stats?.moodDistribution;

    if (needRegenerate) {
      const reportId = await generateReport('daily', value.getTime());
      setSelectedReportId(reportId);
    } else if (existingReport) {
      setSelectedReportId(existingReport.id);
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
    if (todayReport) {
      setSelectedReportId(todayReport.id);
    } else {
      const reportId = await generateReport('daily', now.getTime());
      setSelectedReportId(reportId);
    }
  };

  const today = new Date();
  const currentLang = i18n.language?.split('-')[0] || 'en';
  const calendarLocale = currentLang === 'zh' ? zhCN : currentLang === 'it' ? it : enUS;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50 overflow-y-auto pb-safe">
      <header className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10 relative">
        <h1 className="text-lg font-bold text-center">{t('report_title')}</h1>
        <button
          onClick={() => setShowCalendarModal(true)}
          className="mt-1 w-full text-center text-sm text-gray-500 hover:text-gray-700 active:opacity-70 transition"
        >
          {format(today, currentLang === 'zh' ? 'yyyy年M月d日 EEEE' : 'EEEE, MMMM d, yyyy', { locale: calendarLocale })}
        </button>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-end gap-1.5">
          <button
            onClick={() => setShowDiaryBook(true)}
            className="text-xs bg-indigo-50 text-indigo-500 border border-indigo-200 rounded-full px-3 py-1 active:opacity-70 transition whitespace-nowrap"
          >
            查看日记本
          </button>
          <button
            onClick={handleGenerateDiary}
            className="text-xs bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-3 py-1 active:opacity-70 transition whitespace-nowrap"
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
        onClose={() => setSelectedReportId(null)}
        onShowTaskList={setShowTaskList}
        generateTimeshineDiary={generateTimeshineDiary}
      />

      <TaskListModal
        showTaskList={showTaskList}
        selectedReport={selectedReport}
        todos={todos}
        onClose={() => setShowTaskList(null)}
      />

      {showDiaryBook && (
        <DiaryBookViewer
          onClose={() => setShowDiaryBook(false)}
          reports={reports}
        />
      )}
    </div>
  );
};
