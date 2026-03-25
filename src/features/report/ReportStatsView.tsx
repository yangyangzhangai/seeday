import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ReportStats } from '../../store/useReportStore';
import { cn } from '../../lib/utils';

interface ReportStatsViewProps {
  stats: ReportStats;
  type: string;
  onShowTasks: (type: 'completed' | 'total') => void;
}

const PRIORITY_CONFIG = {
  high:   { bar: 'bg-red-400',    bg: 'bg-red-50',    text: 'text-red-500' },
  medium: { bar: 'bg-orange-400', bg: 'bg-orange-50', text: 'text-orange-500' },
  low:    { bar: 'bg-green-400',  bg: 'bg-green-50',  text: 'text-green-500' },
} as const;

export const ReportStatsView: React.FC<ReportStatsViewProps> = ({ stats, type, onShowTasks }) => {
  const { t } = useTranslation();
  const isDaily = type === 'daily';

  return (
    <div className="space-y-5">

      {/* ── 总览卡 ── */}
      <div className="grid grid-cols-3 gap-3 text-center">
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

      {/* ── 日报专属区块 ── */}
      {isDaily && (
        <>
          {/* 习惯打卡 */}
          {stats.habitCheckin && stats.habitCheckin.length > 0 && (
            <div>
              <h3 className="font-bold mb-2 text-sm text-gray-700">{t('report_habit_checkin')}</h3>
              <div className="space-y-1.5">
                {stats.habitCheckin.map((item) => (
                  <div key={item.bottleId} className="flex items-center justify-between bg-white border border-gray-100 px-3 py-2 rounded-lg">
                    <span className="text-sm text-gray-700 truncate flex-1">{item.name}</span>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2',
                      item.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                    )}>
                      {item.done ? `✓ ${t('report_checked')}` : `✗ ${t('report_unchecked')}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 目标进展 */}
          {stats.goalProgress && stats.goalProgress.length > 0 && (
            <div>
              <h3 className="font-bold mb-2 text-sm text-gray-700">{t('report_goal_progress')}</h3>
              <div className="space-y-1.5">
                {stats.goalProgress.map((item) => (
                  <div key={item.bottleId} className="flex items-center justify-between bg-white border border-gray-100 px-3 py-2 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-700 truncate block">{item.bottleName}</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full"
                            style={{ width: `${(item.currentStars / 21) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{item.currentStars}/21⭐</span>
                      </div>
                    </div>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-3',
                      item.doneToday ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'
                    )}>
                      {item.doneToday ? t('report_goal_done_today') : t('report_goal_not_today')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 独立重复任务 */}
          {stats.independentRecurring && stats.independentRecurring.total > 0 && (
            <div className="flex items-center justify-between bg-white border border-gray-100 px-3 py-2.5 rounded-lg">
              <span className="text-sm text-gray-600">{t('report_recurring_tasks')}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full"
                    style={{ width: `${stats.independentRecurring.total > 0 ? (stats.independentRecurring.completed / stats.independentRecurring.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-10 text-right">
                  {stats.independentRecurring.completed}/{stats.independentRecurring.total}
                </span>
              </div>
            </div>
          )}

          {/* 一次性任务·优先级分布 */}
          {stats.oneTimeTasks && (stats.oneTimeTasks.high.total + stats.oneTimeTasks.medium.total + stats.oneTimeTasks.low.total) > 0 && (
            <div>
              <h3 className="font-bold mb-2 text-sm text-gray-700">{t('report_task_priority')}</h3>
              <div className="space-y-1.5">
                {(['high', 'medium', 'low'] as const).map((p) => {
                  const data = stats.oneTimeTasks![p];
                  if (data.total === 0) return null;
                  const cfg = PRIORITY_CONFIG[p];
                  return (
                    <div key={p} className="flex items-center gap-2 text-xs">
                      <span className={cn('w-8 text-center py-0.5 rounded text-[10px] font-medium flex-shrink-0', cfg.bg, cfg.text)}>
                        {t(`growth_todo_priority_${p}`)}
                      </span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', cfg.bar)}
                          style={{ width: `${data.total > 0 ? (data.completed / data.total) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-gray-400 w-10 text-right flex-shrink-0">{data.completed}/{data.total}</span>
                    </div>
                  );
                })}
              </div>
              {stats.oneTimeTasks.completedTitles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {stats.oneTimeTasks.completedTitles.map((title, i) => (
                    <span key={i} className="text-[10px] bg-gray-50 text-gray-500 border border-gray-100 rounded-full px-2 py-0.5">
                      {title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── 周/月报：习惯追踪 + 完成趋势 ── */}
      {!isDaily && stats.recurringStats && stats.recurringStats.length > 0 && (
        <div>
          <h3 className="font-bold mb-2 text-sm text-gray-700">{t('report_habit_tracking')}</h3>
          <div className="space-y-2">
            {stats.recurringStats.map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-white border border-gray-100 p-3 rounded-lg">
                <span className="text-sm font-medium">{item.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${(item.rate || 0) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-500">{item.count}/{item.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isDaily && stats.dailyCompletion && (
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
