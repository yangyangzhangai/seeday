import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Sparkles, ChevronLeft, ChevronRight, PenLine } from 'lucide-react';
import type { Report } from '../../store/useReportStore';
import { useReportStore } from '../../store/useReportStore';
import type { MoodDistributionItem } from './reportPageHelpers';
import { ActivityRecordsView } from './ActivityRecordsView';
import { MoodPieChart } from './MoodPieChart';
import { ReportStatsView } from './ReportStatsView';

interface ReportDetailModalProps {
  selectedReport: Report | null;
  dailyMoodDistribution: MoodDistributionItem[];
  onClose: () => void;
  onBack?: () => void;
  onShowTaskList: (type: 'completed' | 'total') => void;
  generateTimeshineDiary: (reportId: string) => Promise<void>;
  initialPage?: 0 | 1;
  readOnly?: boolean;
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  selectedReport,
  dailyMoodDistribution,
  onClose,
  onBack,
  onShowTaskList,
  generateTimeshineDiary,
  initialPage,
  readOnly,
}) => {
  const { t } = useTranslation();
  const { updateReport } = useReportStore();
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [noteValue, setNoteValue] = useState('');

  useEffect(() => {
    setNoteValue(selectedReport?.userNote ?? '');
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

  const saveNote = useCallback(() => {
    if (!selectedReport) return;
    updateReport(selectedReport.id, { userNote: noteValue });
  }, [selectedReport, noteValue, updateReport]);

  const getReportDisplayTitle = (report: Report): string => {
    if (report.type === 'daily') return format(report.date, 'yyyy年MM月dd日');
    if (report.type === 'weekly') {
      const start = report.startDate ? new Date(report.startDate) : new Date(report.date);
      const end = report.endDate ? new Date(report.endDate) : new Date(report.date);
      return `${format(start, 'MM-dd')} ~ ${format(end, 'MM-dd')} ${t('report_weekly')}`;
    }
    if (report.type === 'monthly') return format(report.date, 'yyyy年MM月');
    if (report.type === 'custom') {
      const start = report.startDate ? new Date(report.startDate) : new Date(report.date);
      const end = report.endDate ? new Date(report.endDate) : new Date(report.date);
      return `${format(start, 'yyyy-MM-dd')} ~ ${format(end, 'yyyy-MM-dd')}`;
    }
    return report.title;
  };

  if (!selectedReport) return null;

  return (
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
          <span className="text-sm">{onBack ? '日记本' : '日记'}</span>
        </button>
        <div className="flex-1 text-center">
          <h2 className="text-base font-bold font-siyuan" style={{ color: '#4a3a2a' }}>{getReportDisplayTitle(selectedReport)}</h2>
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
        {/* ── Page 1: 日报统计 ── */}
        <div
          style={{ flexShrink: 0, width: '100%', scrollSnapAlign: 'start', overflowY: 'auto', background: '#ffffff' }}
          className="[&::-webkit-scrollbar]:hidden px-4 py-4 space-y-5 pb-safe"
        >
          {/* 生成植物占位 */}
          <button
            disabled
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm opacity-50 cursor-not-allowed"
            style={{ background: 'linear-gradient(175deg, #eef4eb 0%, #d6eccc 100%)', color: '#4a6a3a', border: '1px solid rgba(74,106,58,0.25)' }}
          >
            <span>🌱</span>
            <span>生成植物</span>
          </button>

          <ActivityRecordsView report={selectedReport} />

          {dailyMoodDistribution.length > 0 && (
            <div>
              <h3 className="font-bold mb-3 text-sm" style={{ color: '#4a3a2a' }}>{t('report_today_mood_spectrum')}</h3>
              <div className="rounded-lg p-3" style={{ background: '#faf7f2', border: '1px solid rgba(107,90,62,0.12)' }}>
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
            <div className="text-center py-10 text-sm" style={{ color: '#9a8878' }}>{t('no_data')}</div>
          )}

          <div className="flex items-center justify-center gap-1 text-xs pt-1 pb-4" style={{ color: 'rgba(107,90,62,0.35)' }}>
            <span>← 左滑查看 AI 日记 &amp; 手写日记</span>
          </div>
        </div>

        {/* ── Page 2: AI日记 + 手写日记 ── */}
        <div
          style={{ flexShrink: 0, width: '100%', scrollSnapAlign: 'start', overflowY: 'auto', background: '#ffffff' }}
          className="[&::-webkit-scrollbar]:hidden px-4 py-4 space-y-5 pb-safe"
        >
          {/* AI 观察日记 */}
          <div>
            <h3 className="font-bold flex items-center gap-2 mb-2 text-sm" style={{ color: '#333' }}>
              <Sparkles size={15} /> {t('report_observer_analysis')}
            </h3>

            {selectedReport.analysisStatus === 'idle' || (!selectedReport.analysisStatus && !selectedReport.aiAnalysis) ? (
              <div className="text-center py-2">
                <p className="text-sm mb-3 text-gray-500">{t('report_observer_waiting')}</p>
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

          {/* 手写日记 */}
          <div>
            <h3 className="font-bold flex items-center gap-2 mb-3 text-sm" style={{ color: '#333' }}>
              <PenLine size={15} /> 我的日记
            </h3>
            {readOnly ? (
              <p
                className="w-full text-sm leading-relaxed min-h-[9rem]"
                style={{
                  color: noteValue ? '#333' : 'rgba(0,0,0,0.25)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {noteValue || '未留下文字…'}
              </p>
            ) : (
              <>
                <textarea
                  value={noteValue}
                  onChange={e => setNoteValue(e.target.value)}
                  onBlur={saveNote}
                  placeholder="写下今天的心情与感受…"
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
                    保存
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
