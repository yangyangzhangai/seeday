// DOC-DEPS: src/features/report/README.md -> src/store/reportHelpers.ts
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ActivityRecordType } from '../../lib/activityType';

interface CategoryEntry {
  category: ActivityRecordType;
  minutes: number;
  percent: number;
}

interface ActivityCategoryDonutProps {
  data: CategoryEntry[];
}

const CATEGORY_COLORS: Record<ActivityRecordType, string> = {
  study:         '#6366f1',
  work:          '#3b82f6',
  social:        '#ec4899',
  life:          '#f59e0b',
  entertainment: '#10b981',
  health:        '#ef4444',
};

const CATEGORY_KEYS: Record<ActivityRecordType, string> = {
  study:         'category_study',
  work:          'category_work',
  social:        'category_social',
  life:          'category_life',
  entertainment: 'category_entertainment',
  health:        'category_health',
};

function buildArcs(data: CategoryEntry[], r: number, gap: number): { d: string; color: string }[] {
  const cx = 60;
  const cy = 60;
  const total = data.reduce((s, e) => s + e.minutes, 0);
  if (total === 0) return [];

  const arcs: { d: string; color: string }[] = [];
  let startAngle = -Math.PI / 2;

  data.forEach((entry) => {
    const sweep = (entry.minutes / total) * (2 * Math.PI) - gap;
    if (sweep <= 0) return;
    const endAngle = startAngle + sweep;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = sweep > Math.PI ? 1 : 0;
    arcs.push({
      d: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      color: CATEGORY_COLORS[entry.category],
    });
    startAngle = endAngle + gap;
  });

  return arcs;
}

export const ActivityCategoryDonut: React.FC<ActivityCategoryDonutProps> = ({ data }) => {
  const { t } = useTranslation();
  if (!data || data.length === 0) return null;

  const totalMinutes = data.reduce((s, e) => s + e.minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const arcs = buildArcs(data, 44, 0.04);
  const sorted = [...data].sort((a, b) => b.minutes - a.minutes);

  return (
    <div className="flex items-center gap-4">
      <svg width={120} height={120} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
        {arcs.map((arc, i) => (
          <path key={i} d={arc.d} fill="none" stroke={arc.color} strokeWidth={14} strokeLinecap="round" />
        ))}
        <text x={60} y={57} textAnchor="middle" fontSize={16} fontWeight="bold" fill="#4a3a2a">{totalHours}</text>
        <text x={60} y={70} textAnchor="middle" fontSize={9} fill="#9a8878">hrs</text>
      </svg>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {sorted.map((entry) => (
          <div key={entry.category} className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: CATEGORY_COLORS[entry.category] }}
            />
            <span className="text-gray-600 truncate flex-1">
              {t(CATEGORY_KEYS[entry.category], entry.category)}
            </span>
            <span className="text-gray-400 flex-shrink-0">
              {Math.round(entry.percent * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
