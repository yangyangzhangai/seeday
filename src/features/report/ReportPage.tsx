import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { zhCN, enUS, it } from 'date-fns/locale';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { FileText, Sparkles, X } from 'lucide-react';
import { useReportStore } from '../../store/useReportStore';
import { useChatStore } from '../../store/useChatStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useMoodStore } from '../../store/useMoodStore';
import { ReportDetailModal } from './ReportDetailModal';
import { TaskListModal } from './TaskListModal';
import { getDailyMoodDistribution } from './reportPageHelpers';

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
  const [showReportList, setShowReportList] = useState<'weekly' | 'monthly' | 'custom' | null>(null);
  const [showTaskList, setShowTaskList] = useState<'completed' | 'total' | null>(null);

  const selectedReport = reports.find((report) => report.id === selectedReportId) || null;

  const dailyMoodDistribution = useMemo(
    () => getDailyMoodDistribution(chatMessages, activityMood, selectedReport),
    [chatMessages, activityMood, selectedReport]
  );

  const handleDateClick = (value: Date) => {
    const existingReport = reports.find(
      (report) => report.type === 'daily' && new Date(report.date).toDateString() === value.toDateString()
    );

    const needRegenerate = !existingReport || !existingReport.stats?.moodDistribution;

    if (needRegenerate) {
      generateReport('daily', value.getTime());
      setTimeout(() => {
        const newReport = useReportStore
          .getState()
          .reports.find(
            (report) => report.type === 'daily' && new Date(report.date).toDateString() === value.toDateString()
          );
        if (newReport) setSelectedReportId(newReport.id);
      }, 50);
    } else if (existingReport) {
      setSelectedReportId(existingReport.id);
    }
  };

  const openReportList = (type: 'weekly' | 'monthly' | 'custom') => {
    setShowReportList(type);
  };

  const currentLang = i18n.language?.split('-')[0] || 'en';
  const calendarLocale = currentLang === 'zh' ? zhCN : currentLang === 'it' ? it : enUS;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50 overflow-y-auto">
      <header className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-center">{t('report_title')}</h1>
      </header>

      <div className="p-4 pb-24 space-y-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-3">{t('report_calendar_view')}</h2>
          <div className="calendar-wrapper flex justify-center">
            <Calendar
              onChange={setDate}
              value={date}
              onClickDay={handleDateClick}
              locale={i18n.language}
              className="w-full border-none text-sm"
              showNeighboringMonth={false}
              formatDay={(_, calendarDate) => String(calendarDate.getDate())}
              formatShortWeekday={(_, calendarDate) => {
                return format(calendarDate, 'EEEEE', { locale: calendarLocale });
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => openReportList('weekly')}
            className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-blue-50 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-2">
              <FileText size={20} />
            </div>
            <span className="text-xs font-medium">{t('report_weekly')}</span>
          </button>

          <button
            onClick={() => openReportList('monthly')}
            className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-purple-50 transition-colors"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 mb-2">
              <FileText size={20} />
            </div>
            <span className="text-xs font-medium">{t('report_monthly')}</span>
          </button>

          <button
            onClick={() => openReportList('custom')}
            className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-orange-50 transition-colors"
          >
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mb-2">
              <Sparkles size={20} />
            </div>
            <span className="text-xs font-medium">{t('report_custom')}</span>
          </button>
        </div>
      </div>

      {showReportList && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 h-[60vh] flex flex-col animate-in slide-in-from-bottom-10 fade-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">
                {showReportList === 'weekly'
                  ? t('report_weekly')
                  : showReportList === 'monthly'
                    ? t('report_monthly')
                    : t('report_custom')}
              </h2>
              <button onClick={() => setShowReportList(null)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <FileText size={32} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">{t('report_coming_soon')}</h3>
              <p className="text-sm text-gray-500 max-w-xs">
                {showReportList === 'weekly'
                  ? t('report_weekly_coming_soon')
                  : showReportList === 'monthly'
                    ? t('report_monthly_coming_soon')
                    : t('report_custom_coming_soon')}
              </p>
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
    </div>
  );
};
