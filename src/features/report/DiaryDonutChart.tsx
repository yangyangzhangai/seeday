// DOC-DEPS: src/features/report/README.md
// Shared donut chart used by ReportDetailModal and DayEcoSphere.
import React from 'react';

export type DataItem = { name: string; value: number; color: string };

export const ACTIVITY_I18N_KEYS: Record<string, string> = {
  study: 'category_study',
  work: 'category_work',
  social: 'category_social',
  life: 'category_life',
  entertainment: 'category_entertainment',
  health: 'category_health',
};

export const ACTIVITY_UI_COLORS = ['#D5E8CE', '#AACBA4', '#85AD80', '#6A9464', '#4E7549'];
export const MOOD_UI_COLORS = ['#F8D0DC', '#F0AABE', '#DE8BA2', '#C46E86'];

export function lightenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + Math.round(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function DonutChart({
  data,
  maxIndex,
  chartId,
  labelColor,
  size = 110,
  innerRadius = 20,
  outerRadius = 44,
}: {
  data: DataItem[];
  maxIndex: number;
  chartId: string;
  labelColor: string;
  size?: number;
  innerRadius?: number;
  outerRadius?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const halfSize = size / 2;
  const maxOuter = outerRadius + 10;
  const innerRatio = `${((innerRadius / halfSize) * 100).toFixed(1)}%`;
  const outerRatio = `${((maxOuter / halfSize) * 100).toFixed(1)}%`;

  const polar = (r: number, deg: number) => ({
    x: cx + r * Math.cos((deg * Math.PI) / 180),
    y: cy + r * Math.sin((deg * Math.PI) / 180),
  });

  let current = -90;
  const segments = data.map((item, index) => {
    const start = current;
    const sweep = (item.value / total) * 360;
    current += sweep;
    const end = current;
    const mid = (start + end) / 2;
    const isMax = index === maxIndex;
    const adjustOuter = isMax ? outerRadius + 6 : outerRadius;
    const midRad = (mid * Math.PI) / 180;
    const offsetX = isMax ? Math.cos(midRad) * 3 : 0;
    const offsetY = isMax ? Math.sin(midRad) * 3 : 0;
    const largeArc = sweep > 180 ? 1 : 0;
    const o1 = polar(adjustOuter, start);
    const o2 = polar(adjustOuter, end);
    const i1 = polar(innerRadius, end);
    const i2 = polar(innerRadius, start);
    const pathD = [
      `M ${o1.x + offsetX} ${o1.y + offsetY}`,
      `A ${adjustOuter} ${adjustOuter} 0 ${largeArc} 1 ${o2.x + offsetX} ${o2.y + offsetY}`,
      `L ${i1.x + offsetX} ${i1.y + offsetY}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${i2.x + offsetX} ${i2.y + offsetY}`,
      'Z',
    ].join(' ');
    const midR = (innerRadius + adjustOuter) / 2;
    return {
      ...item,
      pathD,
      textX: cx + offsetX + midR * Math.cos(midRad),
      textY: cy + offsetY + midR * Math.sin(midRad),
      sweep,
      isMax,
    };
  });

  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      <defs>
        {segments.map((segment, index) => (
          <radialGradient key={index} id={`${chartId}-rg-${index}`}
            cx="50%" cy="50%" r={outerRatio} fx="50%" fy="50%" gradientUnits="objectBoundingBox">
            <stop offset={innerRatio} stopColor={segment.color} stopOpacity="1" />
            <stop offset="100%" stopColor={lightenHex(segment.color, 0.18)} stopOpacity="1" />
          </radialGradient>
        ))}
      </defs>
      {segments.map((segment, index) => (
        <path key={index} d={segment.pathD}
          fill={`url(#${chartId}-rg-${index})`}
          stroke={segment.isMax ? 'white' : 'none'}
          strokeWidth={segment.isMax ? 1.5 : 0} />
      ))}
      {segments.map((segment, index) => (segment.sweep < 25 ? null : (
        <text key={index} x={segment.textX} y={segment.textY}
          textAnchor="middle" fill={labelColor}
          style={{ fontSize: '8px', fontWeight: 700, pointerEvents: 'none' }}>
          <tspan x={segment.textX} dy="-0.55em">{segment.name}</tspan>
          <tspan x={segment.textX} dy="1.2em">{segment.value}%</tspan>
        </text>
      )))}
    </svg>
  );
}
