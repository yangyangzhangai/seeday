// DOC-DEPS: src/features/report/README.md -> src/lib/report-calculator/types.ts
import React from 'react';
import type { SpectrumItem } from '../../lib/report-calculator/types';

interface SpectrumBarChartProps {
  spectrum: SpectrumItem[];
}

const CATEGORY_COLORS: Record<string, string> = {
  study:         '#6366f1',
  work:          '#3b82f6',
  social:        '#ec4899',
  life:          '#f59e0b',
  entertainment: '#10b981',
  health:        '#ef4444',
};

export const SpectrumBarChart: React.FC<SpectrumBarChartProps> = ({ spectrum }) => {
  if (!spectrum || spectrum.length === 0) return null;

  const visible = spectrum.filter((s) => s.duration_min > 0);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((item) => (
        <div key={item.category} className="flex items-center gap-2">
          <span className="text-base w-5 flex-shrink-0">{item.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span
                className="text-xs font-medium truncate"
                style={{ color: item.is_anomaly ? '#ef4444' : '#4a3a2a' }}
              >
                {item.label}
              </span>
              <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{item.percent_str}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${item.ratio * 100}%`,
                  background: CATEGORY_COLORS[item.category] ?? '#9ca3af',
                }}
              />
            </div>
            {item.top_item && (
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                {item.top_item.name} · {item.top_item.duration_str}
              </p>
            )}
          </div>
          <span className="text-[10px] text-gray-500 flex-shrink-0 w-10 text-right">{item.duration_str}</span>
        </div>
      ))}
    </div>
  );
};
