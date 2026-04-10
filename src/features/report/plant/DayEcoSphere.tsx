// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { useEffect, useMemo, useState } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../../store/useChatStore';
import { useMoodStore } from '../../../store/useMoodStore';
import {
  computeMoodDistribution,
  computeMoodEnergyTimeline,
  computeActivityDistribution,
} from '../reportPageHelpers';
import type { MoodEnergyPoint } from '../reportPageHelpers';
import {
  DonutChart, type DataItem,
  ACTIVITY_I18N_KEYS, ACTIVITY_UI_COLORS, MOOD_UI_COLORS,
} from '../DiaryDonutChart';
import { getMoodDisplayLabel } from '../../../lib/moodOptions';

type ActiveChart = 'mood' | 'activity' | null;

// ── helpers ──
function normalizeChartPercents(items: DataItem[]): DataItem[] {
  const sum = items.reduce((s, d) => s + d.value, 0);
  if (sum !== 100 && items.length > 0) items[0].value += (100 - sum);
  return items;
}

// ── Mood Energy Line SVG ──
function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  const t = 0.35;
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) * t;
    const cp1y = p1.y + (p2.y - p0.y) * t;
    const cp2x = p2.x - (p3.x - p1.x) * t;
    const cp2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function MoodEnergyLine({ points }: { points: MoodEnergyPoint[] }) {
  if (points.length === 0) return null;
  const dayStart = startOfDay(new Date()).getTime();
  const dayEnd = endOfDay(new Date()).getTime();
  const range = dayEnd - dayStart;
  const toX = (ts: number) => ((ts - dayStart) / range) * 186 + 7;
  const toY = (e: number) => 52 - ((e - 1) / 4) * 44;
  const pts = points.map(p => ({ x: toX(p.timestamp), y: toY(p.energy) }));
  const curvePath = buildSmoothPath(pts);
  const baseline = 54;
  const fillPath = curvePath
    ? `${curvePath} L ${pts[pts.length - 1].x.toFixed(1)},${baseline} L ${pts[0].x.toFixed(1)},${baseline} Z`
    : '';
  return (
    <svg viewBox="0 0 200 70" className="w-full" style={{ height: 68 }}>
      <defs>
        <linearGradient id="eco-curve-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b08060" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#b08060" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {[1, 3, 5].map(e => (
        <line key={e} x1={5} y1={toY(e)} x2={195} y2={toY(e)}
          stroke="rgba(150,110,70,0.07)" strokeWidth={0.5} />
      ))}
      {fillPath && <path d={fillPath} fill="url(#eco-curve-fill)" />}
      {curvePath && (
        <path d={curvePath} fill="none" stroke="#b08060"
          strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {[6, 12, 18].map(h => (
        <text key={h} x={toX(dayStart + h * 3600_000)} y={67}
          textAnchor="middle" fontSize={7} fill="rgba(120,90,60,0.42)">
          {`${h}:00`}
        </text>
      ))}
    </svg>
  );
}

// ── Floating DonutChart card ──
interface FloatingChartProps {
  data: DataItem[];
  chartId: string;
  labelColor: string;
  active: boolean;
  onClick: () => void;
  isEmpty: boolean;
}

function FloatingChart({ data, chartId, labelColor, active, onClick, isEmpty }: FloatingChartProps) {
  const maxIndex = data.reduce((m, c, i, arr) => (c.value > arr[m].value ? i : m), 0);
  return (
    <button
      data-eco-bubble="true"
      onClick={onClick}
      className="active:scale-95 transition-transform"
      style={{ WebkitTapHighlightColor: 'transparent', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
    >
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
          fontSize={6}
        />
      )}
    </button>
  );
}

// ── Main Component ──
export const DayEcoSphere: React.FC = () => {
  const { t } = useTranslation();
  const [active, setActive] = useState<ActiveChart>(null);
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
  const moodTimeline = useMemo(
    () => computeMoodEnergyTimeline(todayMessages, activityMood),
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
  const toggle = (b: ActiveChart) => setActive(prev => prev === b ? null : b);

  useEffect(() => {
    if (!active) return;
    const handle = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (!el) return;
      if (el.closest('[data-eco-bubble="true"]')) return;
      if (el.closest('[data-eco-panel="true"]')) return;
      setActive(null);
    };
    document.addEventListener('pointerdown', handle, true);
    return () => document.removeEventListener('pointerdown', handle, true);
  }, [active]);

  const glassPanel: React.CSSProperties = {
    background: 'rgba(248,242,229,0.94)',
    border: '1px solid rgba(195,168,120,0.38)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: '0 6px 20px rgba(90,60,20,0.12), 0 1px 0 rgba(255,255,255,0.7) inset',
  };

  return (
    <div className="pointer-events-none">
      <div className="pointer-events-auto relative" style={{ height: 190 }}>
        <style>{`
          @keyframes eco-float-a{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
          @keyframes eco-float-b{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
        `}</style>

        {/* Top — mood donut chart */}
        <div style={{ position: 'absolute', left: '14%', top: 14,
          animation: 'eco-float-a 3.4s ease-in-out infinite' }}>
          <FloatingChart
            data={moodChartData}
            chartId="eco-mood"
            labelColor="#A0304A"
            active={active === 'mood'}
            isEmpty={moodDist.length === 0}
            onClick={() => toggle('mood')}
          />
        </div>

        {/* Bottom — activity donut chart */}
        <div style={{ position: 'absolute', left: '58%', top: 68,
          animation: 'eco-float-b 3.8s ease-in-out infinite 0.65s' }}>
          <FloatingChart
            data={activityChartData}
            chartId="eco-activity"
            labelColor="#2D5A30"
            active={active === 'activity'}
            isEmpty={activityRaw.length === 0}
            onClick={() => toggle('activity')}
          />
        </div>
      </div>

      {isNight && (
        <p className="pointer-events-none text-center px-6 pb-1"
          style={{ fontSize: 10, color: 'rgba(245,235,210,0.75)' }}>
          {t('eco_sphere_night_hint')}
        </p>
      )}

      {/* Mood expanded panel — energy timeline */}
      {active === 'mood' && moodTimeline.length > 0 && (
        <div data-eco-panel="true"
          className="pointer-events-auto mx-3 mb-2 rounded-2xl p-4 space-y-2"
          style={glassPanel}>
          <p className="text-xs font-semibold" style={{ color: '#5a4028' }}>
            {t('eco_sphere_mood_energy_title')}
          </p>
          <MoodEnergyLine points={moodTimeline} />
        </div>
      )}
    </div>
  );
};
