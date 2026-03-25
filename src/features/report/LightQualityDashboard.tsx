// DOC-DEPS: src/features/report/README.md -> src/lib/report-calculator/types.ts
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { LightQuality } from '../../lib/report-calculator/types';

interface LightQualityDashboardProps {
  lightQuality: LightQuality;
}

interface BarRowProps {
  leftLabel: string;
  rightLabel: string;
  leftRatio: number;
  leftColor: string;
  leftPct: string;
  rightPct: string;
}

const BarRow: React.FC<BarRowProps> = ({ leftLabel, rightLabel, leftRatio, leftColor, leftPct, rightPct }) => (
  <div>
    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
      <span style={{ color: leftColor }} className="font-medium">{leftLabel} {leftPct}</span>
      <span className="text-gray-400">{rightLabel} {rightPct}</span>
    </div>
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${leftRatio * 100}%`, background: leftColor }}
      />
    </div>
  </div>
);

export const LightQualityDashboard: React.FC<LightQualityDashboardProps> = ({ lightQuality: lq }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <BarRow
        leftLabel={t('lq_focus', '专注聚光')}
        rightLabel={t('lq_scatter', '碎片散光')}
        leftRatio={lq.focus_ratio}
        leftColor="#6366f1"
        leftPct={lq.focus_pct}
        rightPct={lq.scatter_pct}
      />
      <BarRow
        leftLabel={t('lq_active', '主动燃烧')}
        rightLabel={t('lq_passive', '被动响应')}
        leftRatio={lq.active_ratio}
        leftColor="#10b981"
        leftPct={lq.active_pct}
        rightPct={lq.passive_pct}
      />
      {lq.todo_ratio !== null && (
        <BarRow
          leftLabel={t('lq_todo_done', '待办着陆')}
          rightLabel={t('lq_todo_total', '总计')}
          leftRatio={lq.todo_ratio}
          leftColor="#f59e0b"
          leftPct={lq.todo_str}
          rightPct={`${lq.todo_total}`}
        />
      )}
    </div>
  );
};
