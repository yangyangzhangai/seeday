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
import { MoodPieChart } from '../MoodPieChart';
import { ActivityCategoryDonut } from '../ActivityCategoryDonut';
import type { ActivityRecordType } from '../../../lib/activityType';

type ActiveBubble = 'mood' | 'activity' | null;

interface DayEcoSphereProps {
  onOpenTodayDiary?: () => void;
}

/** Build a smooth Catmull-Rom bezier path through pts */
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

// ── Mood Energy Line SVG ──
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
      {/* subtle grid */}
      {[1, 3, 5].map(e => (
        <line key={e} x1={5} y1={toY(e)} x2={195} y2={toY(e)}
          stroke="rgba(150,110,70,0.07)" strokeWidth={0.5} />
      ))}
      {/* gradient fill under curve */}
      {fillPath && <path d={fillPath} fill="url(#eco-curve-fill)" />}
      {/* smooth curve line */}
      {curvePath && (
        <path d={curvePath} fill="none" stroke="#b08060"
          strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {/* time labels */}
      {[6, 12, 18].map(h => (
        <text key={h} x={toX(dayStart + h * 3600_000)} y={67}
          textAnchor="middle" fontSize={7} fill="rgba(120,90,60,0.42)">
          {`${h}:00`}
        </text>
      ))}
    </svg>
  );
}

// ── Diary Book SVG (matches iOS 📔 style, renders identically on all platforms) ──
function DiaryBookIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Book cover */}
      <rect x="12" y="6" width="40" height="52" rx="3" fill="#b5894e" />
      {/* Pages (cream interior) */}
      <rect x="18" y="8" width="32" height="48" rx="2" fill="#faf3e0" />
      {/* Spine binding */}
      <rect x="12" y="6" width="8" height="52" rx="3" fill="#8b6530" />
      <rect x="14" y="6" width="2" height="52" fill="#a07840" opacity="0.5" />
      {/* Page lines */}
      <line x1="24" y1="20" x2="44" y2="20" stroke="#d4c4a0" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="24" y1="27" x2="44" y2="27" stroke="#d4c4a0" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="24" y1="34" x2="44" y2="34" stroke="#d4c4a0" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="24" y1="41" x2="38" y2="41" stroke="#d4c4a0" strokeWidth="1.2" strokeLinecap="round" />
      {/* Elastic band / bookmark */}
      <rect x="46" y="6" width="2.5" height="52" rx="1.25" fill="#c8a260" opacity="0.7" />
    </svg>
  );
}

// ── Glass Bubble ──
interface BubbleProps {
  label: string;
  icon: React.ReactNode;
  color: string;
  active: boolean;
  onClick: () => void;
  hasData: boolean;
  disabled?: boolean;
}

function GlassBubble({ label, icon, color, active, onClick, hasData, disabled }: BubbleProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
      style={{ flex: 1, opacity: disabled ? 0.4 : 1 }}
    >
      <div style={{
        width: 74, height: 74, borderRadius: '50%',
        background: active
          ? `radial-gradient(circle at 35% 32%, ${color}55, ${color}22)`
          : 'radial-gradient(circle at 35% 32%, rgba(255,255,255,0.72), rgba(230,235,255,0.28))',
        border: active ? `2px solid ${color}90` : '1.5px solid rgba(255,255,255,0.78)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        boxShadow: active
          ? `0 0 0 4px ${color}1a, 0 6px 18px ${color}28`
          : '0 2px 10px rgba(0,0,0,0.07), inset 0 1.5px 0 rgba(255,255,255,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', transition: 'all 0.22s ease',
      }}>
        <span style={{ fontSize: 30, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
        {hasData && (
          <span style={{
            position: 'absolute', bottom: 7, right: 7,
            width: 8, height: 8, borderRadius: '50%',
            background: color, border: '1.5px solid white',
          }} />
        )}
      </div>
      <span style={{ fontSize: 10, color: '#9a8878' }}>{label}</span>
    </button>
  );
}

// ── Main Component ──
export const DayEcoSphere: React.FC<DayEcoSphereProps> = ({ onOpenTodayDiary }) => {
  const { t } = useTranslation();
  const [active, setActive] = useState<ActiveBubble>(null);
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
  const activityData = useMemo(() => {
    const total = activityRaw.reduce((s, d) => s + d.minutes, 0);
    return activityRaw.map(d => ({
      category: d.type as ActivityRecordType,
      minutes: d.minutes,
      percent: total > 0 ? d.minutes / total : 0,
    }));
  }, [activityRaw]);

  const isNight = new Date().getHours() >= 20;
  const toggle = (b: ActiveBubble) => setActive(prev => prev === b ? null : b);

  const glassPanel: React.CSSProperties = {
    background: 'rgba(248, 242, 229, 0.94)',
    border: '1px solid rgba(195, 168, 120, 0.38)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: '0 6px 20px rgba(90, 60, 20, 0.12), 0 1px 0 rgba(255,255,255,0.7) inset',
  };

  return (
    <div className="pointer-events-none">
      {/* Arc + float layout — center bubble is the apex */}
      <div className="pointer-events-auto relative" style={{ height: 130 }}>
        <style>{`
          @keyframes eco-float-a{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
          @keyframes eco-float-b{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
          @keyframes eco-float-c{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        `}</style>
        {/* Left — mood */}
        <div style={{ position: 'absolute', left: '8%', top: 30, animation: 'eco-float-a 3.4s ease-in-out infinite' }}>
          <GlassBubble
            label={t('eco_sphere_mood_label')} icon="🌙" color="#c084fc"
            active={active === 'mood'} onClick={() => toggle('mood')}
            hasData={moodDist.length > 0}
          />
        </div>
        {/* Center — activity (arc apex, sits highest) */}
        <div style={{ position: 'absolute', left: '50%', marginLeft: -37, top: 10, animation: 'eco-float-b 3.8s ease-in-out infinite 0.65s' }}>
          <GlassBubble
            label={t('eco_sphere_activity_label')} icon="🌿" color="#34d399"
            active={active === 'activity'} onClick={() => toggle('activity')}
            hasData={activityData.length > 0}
          />
        </div>
        {/* Right — diary (SVG icon for cross-platform consistency) */}
        <div style={{ position: 'absolute', right: '8%', top: 30, animation: 'eco-float-c 3.2s ease-in-out infinite 1.3s' }}>
          <GlassBubble
            label={t('eco_sphere_diary_label')}
            icon={<DiaryBookIcon />}
            color="#a78b6e"
            active={false} onClick={() => onOpenTodayDiary?.()} hasData={false}
          />
        </div>
      </div>

      {isNight && (
        <p className="pointer-events-none text-center px-6 pb-1" style={{ fontSize: 10, color: 'rgba(245,235,210,0.75)' }}>
          {t('eco_sphere_night_hint')}
        </p>
      )}

      {active === 'mood' && (
        <div className="pointer-events-auto mx-3 mb-2 rounded-2xl p-4 space-y-3" style={glassPanel}>
          {/* 心情分布（饼图 + 图例）*/}
          {moodDist.length > 0 ? (
            <>
              <p className="text-xs font-semibold" style={{ color: '#5a4028' }}>
                {t('report_today_mood_spectrum')}
              </p>
              <MoodPieChart distribution={moodDist} />
            </>
          ) : (
            <p className="text-xs text-center py-1" style={{ color: '#8a7060' }}>
              {t('eco_sphere_no_mood_data')}
            </p>
          )}
          {/* 能量曲线（分隔线后）*/}
          {moodTimeline.length > 0 && (
            <>
              <div style={{ height: 1, background: 'rgba(180,150,110,0.20)', margin: '0 -4px' }} />
              <p className="text-xs font-semibold" style={{ color: '#5a4028' }}>
                {t('eco_sphere_mood_energy_title')}
              </p>
              <MoodEnergyLine points={moodTimeline} />
            </>
          )}
        </div>
      )}

      {active === 'activity' && (
        <div className="pointer-events-auto mx-3 mb-2 rounded-2xl p-4" style={glassPanel}>
          <p className="text-xs font-semibold mb-2" style={{ color: '#5a4028' }}>
            {t('report_activity_category')}
          </p>
          {activityData.length > 0
            ? <ActivityCategoryDonut data={activityData} />
            : <p className="text-xs text-center py-3" style={{ color: '#8a7060' }}>
                {t('eco_sphere_no_activity_data')}
              </p>
          }
        </div>
      )}
    </div>
  );
};
