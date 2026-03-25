import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ActivityDistributionItem } from './reportPageHelpers';

export const ACTIVITY_COLORS: Record<string, string> = {
  study: '#A78BFA',
  work: '#60A5FA',
  social: '#F97316',
  life: '#34D399',
  entertainment: '#F472B6',
  health: '#FBBF24',
};

const ACTIVITY_I18N_KEYS: Record<string, string> = {
  study: 'category_study',
  work: 'category_work',
  social: 'category_social',
  life: 'category_life',
  entertainment: 'category_entertainment',
  health: 'category_health',
};

interface ActivityPieChartProps {
  distribution: ActivityDistributionItem[];
}

export const ActivityPieChart: React.FC<ActivityPieChartProps> = ({ distribution }) => {
  const { t } = useTranslation();
  const dayMinutes = 24 * 60;
  const totalMinutes = distribution.reduce((sum, d) => sum + d.minutes, 0);
  if (totalMinutes === 0) return null;

  type PieSlice = { type: string; minutes: number };
  const pieData: PieSlice[] = [...distribution];
  const remaining = Math.max(dayMinutes - totalMinutes, 0);
  if (remaining > 0) pieData.push({ type: '__other', minutes: remaining });

  let current = 0;
  const slices = pieData.map((d) => {
    const fraction = d.minutes / dayMinutes;
    const slice = { type: d.type, fraction, start: current, end: current + fraction };
    current += fraction;
    return slice;
  });

  const cx = 16, cy = 16, r = 14;

  return (
    <div className="flex items-center justify-center gap-4">
      <svg viewBox="0 0 32 32" className="w-24 h-24">
        {slices.map((s) => {
          const startAngle = 2 * Math.PI * s.start - Math.PI / 2;
          const endAngle = 2 * Math.PI * s.end - Math.PI / 2;
          const x1 = cx + r * Math.cos(startAngle);
          const y1 = cy + r * Math.sin(startAngle);
          const x2 = cx + r * Math.cos(endAngle);
          const y2 = cy + r * Math.sin(endAngle);
          const largeArcFlag = s.fraction > 0.5 ? 1 : 0;
          const pathData = [
            `M ${cx} ${cy}`,
            `L ${x1} ${y1}`,
            `A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            'Z',
          ].join(' ');
          const fill = s.type === '__other' ? '#F3F4F6' : ACTIVITY_COLORS[s.type] || '#9CA3AF';
          return <path key={`${s.type}-${s.start}`} d={pathData} fill={fill} />;
        })}
      </svg>
      <div className="space-y-1">
        {distribution.map((d) => (
          <div key={d.type} className="flex items-center gap-2 text-xs text-gray-600">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: ACTIVITY_COLORS[d.type] || '#9CA3AF' }} />
            <span>{t(ACTIVITY_I18N_KEYS[d.type] || d.type)}</span>
            <span className="text-gray-400">
              {Math.round(d.minutes)}m · {Math.round((d.minutes / dayMinutes) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
