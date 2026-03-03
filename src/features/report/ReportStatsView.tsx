import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ReportStats } from '../../store/useReportStore';
import { cn } from '../../lib/utils';

interface ReportStatsViewProps {
  stats: ReportStats;
  type: string;
  onShowTasks: (type: 'completed' | 'total') => void;
}

export const ReportStatsView: React.FC<ReportStatsViewProps> = ({ stats, type, onShowTasks }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div
          className="bg-blue-50 p-3 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => onShowTasks('completed')}
        >
          <div className="text-2xl font-bold text-blue-600">{stats.completedTodos}</div>
          <div className="text-xs text-blue-400">{t('report_completed')}</div>
        </div>
        <div
          className="bg-gray-50 p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
          onClick={() => onShowTasks('total')}
        >
          <div className="text-2xl font-bold text-gray-600">{stats.totalTodos}</div>
          <div className="text-xs text-gray-400">{t('report_total_tasks')}</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{(stats.completionRate * 100).toFixed(0)}%</div>
          <div className="text-xs text-green-400">{t('report_completion_rate')}</div>
        </div>
      </div>

      {stats.recurringStats && stats.recurringStats.length > 0 && (
        <div>
          <h3 className="font-bold mb-3 text-sm text-gray-700">{t('report_habit_tracking')}</h3>
          <div className="space-y-2">
            {stats.recurringStats.map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-white border border-gray-100 p-3 rounded-lg">
                <span className="text-sm font-medium">{item.name}</span>
                {type === 'daily' ? (
                  <span className={cn('px-2 py-1 rounded text-xs', item.completed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                    {item.completed ? t('report_checked') : t('report_unchecked')}
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${(item.rate || 0) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{item.count}/{item.total}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="font-bold mb-3 text-sm text-gray-700">{t('report_quadrant_distribution')}</h3>
        <div className="space-y-2">
          {stats.priorityStats?.map((p) => (
            <div key={p.priority} className="flex items-center text-xs">
              <span className="w-24 text-gray-500">
                {p.priority === 'urgent-important'
                  ? t('priority_urgent_important')
                  : p.priority === 'urgent-not-important'
                    ? t('priority_urgent_not_important')
                    : p.priority === 'important-not-urgent'
                      ? t('priority_important_not_urgent')
                      : t('priority_not_important_not_urgent')}
              </span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden mx-2">
                <div
                  className={cn('h-full', p.priority.includes('urgent') ? 'bg-red-400' : 'bg-blue-400')}
                  style={{ width: `${p.count > 0 ? (p.completed / p.count) * 100 : 0}%` }}
                />
              </div>
              <span className="text-gray-400 w-10 text-right">{p.completed}/{p.count}</span>
            </div>
          ))}
        </div>
      </div>

      {type !== 'daily' && stats.dailyCompletion && (
        <div>
          <h3 className="font-bold mb-3 text-sm text-gray-700">{t('report_completion_trend')}</h3>
          <div className="flex items-end justify-between h-24 gap-1 pt-4 border-t border-gray-100">
            {stats.dailyCompletion.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-blue-100 rounded-t-sm relative group" style={{ height: `${Math.max(day.rate * 100, 5)}%` }}>
                  <div className="absolute bottom-full mb-1 hidden group-hover:block bg-black text-white text-[10px] p-1 rounded whitespace-nowrap z-10">
                    {day.completed}/{day.total}
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 transform -rotate-45 origin-top-left translate-y-4">{day.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
