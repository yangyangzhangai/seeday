import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MoodDistributionItem } from './reportPageHelpers';

const moodColors: Record<string, string> = {
  开心: '#F9A8D4',
  平静: '#93C5FD',
  专注: '#86EFAC',
  满足: '#FDE68A',
  疲惫: '#9CA3AF',
  无聊: '#C7D2FE',
  低落: '#60A5FA',
};

interface MoodPieChartProps {
  distribution: MoodDistributionItem[];
}

export const MoodPieChart: React.FC<MoodPieChartProps> = ({ distribution }) => {
  const { t } = useTranslation();
  const totalMinutes = distribution.reduce((sum, d) => sum + d.minutes, 0);
  if (totalMinutes === 0) return null;

  const getTranslatedMood = (mood: string) => {
    const keyMap: Record<string, string> = {
      开心: 'mood_happy',
      平静: 'mood_calm',
      专注: 'mood_focused',
      满足: 'mood_satisfied',
      疲惫: 'mood_tired',
      焦虑: 'mood_anxious',
      无聊: 'mood_bored',
      低落: 'mood_down',
    };
    const key = keyMap[mood];
    return key ? t(key) : mood;
  };

  const dayMinutes = 24 * 60;
  const pieData = [...distribution];
  const remainingMinutes = Math.max(dayMinutes - totalMinutes, 0);

  if (remainingMinutes > 0) {
    pieData.push({ mood: '__other', minutes: remainingMinutes });
  }

  let current = 0;
  const slices = pieData.map((d) => {
    const fraction = d.minutes / dayMinutes;
    const slice = {
      mood: d.mood,
      fraction,
      start: current,
      end: current + fraction,
    };
    current += fraction;
    return slice;
  });

  const centerX = 16;
  const centerY = 16;
  const radius = 14;

  return (
    <div className="flex items-center justify-center gap-4">
      <svg viewBox="0 0 32 32" className="w-24 h-24">
        <defs>
          <pattern id="anxiousPattern" x="0" y="0" width="2" height="2" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="2" height="2" fill="#E5E7EB" />
            <rect x="0" y="0" width="1" height="1" fill="#9CA3AF" />
            <rect x="1" y="1" width="1" height="1" fill="#6B7280" />
          </pattern>
        </defs>
        {slices.map((s) => {
          const startAngle = 2 * Math.PI * s.start - Math.PI / 2;
          const endAngle = 2 * Math.PI * s.end - Math.PI / 2;
          const x1 = centerX + radius * Math.cos(startAngle);
          const y1 = centerY + radius * Math.sin(startAngle);
          const x2 = centerX + radius * Math.cos(endAngle);
          const y2 = centerY + radius * Math.sin(endAngle);
          const largeArcFlag = s.fraction > 0.5 ? 1 : 0;
          const pathData = [
            `M ${centerX} ${centerY}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            'Z',
          ].join(' ');

          const fill =
            s.mood === '__other'
              ? '#F3F4F6'
              : s.mood === '焦虑'
                ? 'url(#anxiousPattern)'
                : moodColors[s.mood] || '#93C5FD';

          return <path key={`${s.mood}-${s.start}`} d={pathData} fill={fill} />;
        })}
      </svg>
      <div className="space-y-1">
        {distribution.map((d) => (
          <div key={d.mood} className="flex items-center gap-2 text-xs text-gray-600">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{
                background:
                  d.mood === '焦虑'
                    ? 'repeating-linear-gradient(45deg,#E5E7EB 0,#E5E7EB 1px,#9CA3AF 1px,#9CA3AF 2px,#6B7280 2px,#6B7280 3px)'
                    : moodColors[d.mood] || '#93C5FD',
              }}
            />
            <span>{getTranslatedMood(d.mood)}</span>
            <span className="text-gray-400">
              {t('duration_minutes', { mins: d.minutes })} · {Math.round((d.minutes / dayMinutes) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
