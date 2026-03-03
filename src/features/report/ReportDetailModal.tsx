import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Sparkles, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Report } from '../../store/useReportStore';
import type { MoodDistributionItem } from './reportPageHelpers';
import { ActivityRecordsView } from './ActivityRecordsView';
import { MoodPieChart } from './MoodPieChart';
import { ReportStatsView } from './ReportStatsView';

interface ReportDetailModalProps {
  selectedReport: Report | null;
  dailyMoodDistribution: MoodDistributionItem[];
  onClose: () => void;
  onShowTaskList: (type: 'completed' | 'total') => void;
  generateTimeshineDiary: (reportId: string) => Promise<void>;
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  selectedReport,
  dailyMoodDistribution,
  onClose,
  onShowTaskList,
  generateTimeshineDiary,
}) => {
  const { t } = useTranslation();
  const reportScrollRef = useRef<HTMLDivElement | null>(null);
  const reportHeaderRef = useRef<HTMLDivElement | null>(null);
  const [showFloatingClose, setShowFloatingClose] = useState(false);

  useEffect(() => {
    if (!selectedReport) {
      setShowFloatingClose(false);
      return;
    }

    const headerEl = reportHeaderRef.current;
    const scrollEl = reportScrollRef.current;
    if (!headerEl || !scrollEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloatingClose(!entry.isIntersecting);
      },
      {
        root: scrollEl,
        threshold: 0.1,
      }
    );

    observer.observe(headerEl);
    return () => observer.disconnect();
  }, [selectedReport]);

  const getReportDisplayTitle = (report: Report): string => {
    if (report.type === 'daily') {
      return `${format(report.date, 'yyyy-MM-dd')} ${t('report_daily')}`;
    }

    if (report.type === 'weekly') {
      const start = report.startDate ? new Date(report.startDate) : new Date(report.date);
      const end = report.endDate ? new Date(report.endDate) : new Date(report.date);
      return `${format(start, 'MM-dd')} ~ ${format(end, 'MM-dd')} ${t('report_weekly')}`;
    }

    if (report.type === 'monthly') {
      return `${format(report.date, 'yyyy-MM')} ${t('report_monthly')}`;
    }

    if (report.type === 'custom') {
      const start = report.startDate ? new Date(report.startDate) : new Date(report.date);
      const end = report.endDate ? new Date(report.endDate) : new Date(report.date);
      return `${format(start, 'yyyy-MM-dd')} ~ ${format(end, 'yyyy-MM-dd')} ${t('report_custom')}`;
    }

    return report.title;
  };

  if (!selectedReport) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white w-full max-w-xl rounded-2xl max-h-[80vh] overflow-y-auto scrollbar-none animate-in zoom-in-95 fade-in relative group/report pt-2 pb-4"
        ref={reportScrollRef}
      >
        <div className="sticky top-0 z-10 flex justify-end pointer-events-none">
          <button
            onClick={onClose}
            className={cn(
              'mt-1 mr-1 text-gray-300 hover:text-gray-500 transition-opacity pointer-events-auto',
              showFloatingClose ? 'opacity-0 group-hover/report:opacity-100' : 'opacity-0'
            )}
            aria-label={t('report_close_detail')}
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-w-lg mx-auto pt-2 pb-4">
          <div className="flex justify-between items-start mb-4" ref={reportHeaderRef}>
            <div>
              <h2 className="text-xl font-bold font-siyuan">{getReportDisplayTitle(selectedReport)}</h2>
              <p className="text-sm text-gray-500 font-siyuan">{format(selectedReport.date, 'yyyy-MM-dd HH:mm')}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg text-blue-800">
              <h3 className="font-bold flex items-center gap-2 mb-2 text-sm">
                <Sparkles size={16} /> {t('report_observer_analysis')}
              </h3>

              {selectedReport.analysisStatus === 'idle' || (!selectedReport.analysisStatus && !selectedReport.aiAnalysis) ? (
                <div className="text-center py-2">
                  <p className="text-sm opacity-80 mb-3">{t('report_observer_waiting')}</p>
                  <button
                    onClick={() => {
                      if (window.confirm(t('report_generate_confirm'))) {
                        generateTimeshineDiary(selectedReport.id);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    {t('report_generate_diary')}
                  </button>
                </div>
              ) : selectedReport.analysisStatus === 'generating' ? (
                <div className="flex flex-col items-center justify-center py-4 space-y-2">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-medium text-blue-800 tracking-wide mt-2">{t('report_generating')}</p>
                  <p className="text-xs text-blue-500 opacity-80 mt-1">{t('report_generating_patience')}</p>
                </div>
              ) : selectedReport.analysisStatus === 'error' ? (
                <div className="bg-red-50 p-3 rounded border border-red-100">
                  <p className="text-sm text-red-600 mb-2">{selectedReport.errorMessage}</p>
                  <button
                    onClick={() => generateTimeshineDiary(selectedReport.id)}
                    className="text-xs bg-white border border-red-200 text-red-600 px-3 py-1 rounded hover:bg-red-50"
                  >
                    {t('retry')}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-200/50">
                    <Sparkles size={14} className="text-blue-600" />
                    <span className="text-xs font-medium text-blue-700">{t('report_from_prism')}</span>
                  </div>
                  <p className="text-sm opacity-80 whitespace-pre-wrap">{selectedReport.aiAnalysis}</p>
                </div>
              )}
            </div>

            <ActivityRecordsView report={selectedReport} />

            {dailyMoodDistribution.length > 0 && (
              <div>
                <h3 className="font-bold mb-3 text-sm text-gray-700">{t('report_today_mood_spectrum')}</h3>
                <div className="bg-white border border-gray-100 rounded-lg p-3">
                  <MoodPieChart distribution={dailyMoodDistribution} />
                </div>
              </div>
            )}

            {selectedReport.stats ? (
              <ReportStatsView
                stats={selectedReport.stats}
                type={selectedReport.type}
                onShowTasks={onShowTaskList}
              />
            ) : (
              <div className="text-gray-500 text-center py-10">{t('no_data')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
