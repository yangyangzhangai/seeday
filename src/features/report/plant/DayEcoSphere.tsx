// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { useEffect, useMemo, useState } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../../store/useChatStore';
import { useMoodStore } from '../../../store/useMoodStore';
import {
  computeMoodDistribution,
  computeActivityDistribution,
} from '../reportPageHelpers';
import {
  DonutChart, type DataItem,
  ACTIVITY_I18N_KEYS, ACTIVITY_UI_COLORS, MOOD_UI_COLORS,
} from '../DiaryDonutChart';
import { getMoodDisplayLabel } from '../../../lib/moodOptions';
import { useBubbleMotionController } from './useBubbleMotionController';

// ── helpers ──
function normalizeChartPercents(items: DataItem[]): DataItem[] {
  const sum = items.reduce((s, d) => s + d.value, 0);
  if (sum !== 100 && items.length > 0) items[0].value += (100 - sum);
  return items;
}

// ── Floating DonutChart card ──
interface FloatingChartProps {
  data: DataItem[];
  chartId: string;
  labelColor: string;
  isEmpty: boolean;
}

function FloatingChart({ data, chartId, labelColor, isEmpty }: FloatingChartProps) {
  const maxIndex = data.reduce((m, c, i, arr) => (c.value > arr[m].value ? i : m), 0);
  return (
    <div data-eco-bubble="true" style={{ WebkitTapHighlightColor: 'transparent' }}>
      {isEmpty ? (
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: [
            'radial-gradient(circle at 34% 28%, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.0) 36%)',
            'radial-gradient(circle at 65% 75%, rgba(210,240,255,0.22) 0%, rgba(255,255,255,0.0) 38%)',
            'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.0) 0%, rgba(200,230,255,0.08) 60%, rgba(180,220,200,0.10) 100%)',
          ].join(', '),
          boxShadow: [
            '0 4px 20px rgba(160,200,230,0.12)',
            'inset 0 2px 5px rgba(255,255,255,0.45)',
            'inset 0 -2px 5px rgba(160,210,240,0.15)',
            'inset 3px 0 5px rgba(255,190,220,0.10)',
            'inset -3px 0 5px rgba(190,240,220,0.10)',
          ].join(', '),
          border: '1px solid rgba(255,255,255,0.22)',
        }} />
      ) : (
        <DonutChart
          data={data}
          maxIndex={maxIndex}
          chartId={chartId}
          labelColor={labelColor}
          size={100}
          innerRadius={18}
          outerRadius={38}
          fontSize={7}
        />
      )}
    </div>
  );
}

// ── Main Component ──
export const DayEcoSphere: React.FC = () => {
  const { t } = useTranslation();
  const { containerRef, setBubbleRef } = useBubbleMotionController();
  const [timeTick, setTimeTick] = useState(() => Date.now());
  const messages = useChatStore(state => state.messages);
  const activityMood = useMoodStore(state => state.activityMood);

  useEffect(() => {
    const id = window.setInterval(() => setTimeTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const dayBounds = useMemo(() => ({
    start: startOfDay(new Date()).getTime(),
    end: endOfDay(new Date()).getTime(),
  }), []);

  const todayMessages = useMemo(
    () => messages.filter(m => m.timestamp >= dayBounds.start && m.timestamp <= dayBounds.end),
    [messages, dayBounds],
  );

  const moodDist = useMemo(
    () => computeMoodDistribution(todayMessages, activityMood),
    [todayMessages, activityMood],
  );
  const activityRaw = useMemo(
    () => computeActivityDistribution(todayMessages, timeTick),
    [todayMessages, timeTick],
  );

  // Build DataItem[] in the same format as the diary page DonutChart
  const moodChartData = useMemo<DataItem[]>(() => {
    if (moodDist.length === 0) return [{ name: t('no_data'), value: 100, color: '#E5E7EB' }];
    const top = moodDist.slice(0, 4);
    const total = top.reduce((s, d) => s + d.minutes, 0) || 1;
    const items = top.map((item, i) => ({
      name: getMoodDisplayLabel(item.mood, t).toLowerCase(),
      value: Math.max(1, Math.round((item.minutes / total) * 100)),
      color: MOOD_UI_COLORS[i] ?? MOOD_UI_COLORS[MOOD_UI_COLORS.length - 1],
    }));
    return normalizeChartPercents(items);
  }, [moodDist, t]);

  const activityChartData = useMemo<DataItem[]>(() => {
    if (activityRaw.length === 0) return [{ name: t('no_data'), value: 100, color: '#E5E7EB' }];
    const top = activityRaw.slice(0, 5);
    const total = top.reduce((s, d) => s + d.minutes, 0) || 1;
    const items = top.map((item, i) => ({
      name: t(ACTIVITY_I18N_KEYS[item.type] ?? item.type).toLowerCase(),
      value: Math.max(1, Math.round((item.minutes / total) * 100)),
      color: ACTIVITY_UI_COLORS[i] ?? ACTIVITY_UI_COLORS[ACTIVITY_UI_COLORS.length - 1],
    }));
    return normalizeChartPercents(items);
  }, [activityRaw, t]);

  const isNight = new Date().getHours() >= 20;

  return (
    <div className="pointer-events-none">
      <div ref={containerRef} className="pointer-events-auto relative overflow-hidden" style={{ height: 190 }}>
        <div ref={setBubbleRef(0)} style={{ position: 'absolute', left: 0, top: 0, transform: 'translate3d(28px,16px,0)', willChange: 'transform' }}>
          <FloatingChart
            data={moodChartData}
            chartId="eco-mood"
            labelColor="#A0304A"
            isEmpty={moodDist.length === 0}
          />
        </div>

        <div ref={setBubbleRef(1)} style={{ position: 'absolute', left: 0, top: 0, transform: 'translate3d(170px,72px,0)', willChange: 'transform' }}>
          <FloatingChart
            data={activityChartData}
            chartId="eco-activity"
            labelColor="#2D5A30"
            isEmpty={activityRaw.length === 0}
          />
        </div>
      </div>

      {isNight && (
        <p className="pointer-events-none text-center px-6 pb-1 text-xs"
          style={{ color: 'rgba(245,235,210,0.75)' }}>
          {t('eco_sphere_night_hint')}
        </p>
      )}
    </div>
  );
};
