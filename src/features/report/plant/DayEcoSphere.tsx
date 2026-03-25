// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { useMemo, useState } from 'react';
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
import { normalizeMoodKey } from '../../../lib/moodOptions';
import type { ActivityRecordType } from '../../../lib/activityType';

const MOOD_DOT_COLORS: Record<string, string> = {
  happy: '#F9A8D4', calm: '#93C5FD', focused: '#86EFAC',
  satisfied: '#FDE68A', tired: '#9CA3AF', bored: '#C7D2FE',
  down: '#60A5FA', anxious: '#9CA3AF',
};

type ActiveBubble = 'mood' | 'activity' | null;

// ── Mood Energy Line SVG ──
function MoodEnergyLine({ points }: { points: MoodEnergyPoint[] }) {
  if (points.length === 0) return null;
  const dayStart = startOfDay(new Date()).getTime();
  const dayEnd = endOfDay(new Date()).getTime();
  const range = dayEnd - dayStart;
  const toX = (ts: number) => ((ts - dayStart) / range) * 186 + 7;
  const toY = (e: number) => 52 - ((e - 1) / 4) * 44;
  const polyPts = points
    .map(p => `${toX(p.timestamp).toFixed(1)},${toY(p.energy).toFixed(1)}`)
    .join(' ');

  return (
    <svg viewBox="0 0 200 70" className="w-full" style={{ height: 70 }}>
      {[1, 2, 3, 4, 5].map(e => (
        <line key={e} x1={5} y1={toY(e)} x2={195} y2={toY(e)}
          stroke="rgba(0,0,0,0.06)" strokeWidth={0.5} />
      ))}
      {points.length >= 2 && (
        <polyline points={polyPts} fill="none" stroke="#c084fc"
          strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {points.map((p, i) => (
        <circle key={i} cx={toX(p.timestamp)} cy={toY(p.energy)} r={3.5}
          fill={MOOD_DOT_COLORS[normalizeMoodKey(p.mood) ?? ''] ?? '#c084fc'}
          stroke="white" strokeWidth={0.8} />
      ))}
      {[6, 12, 18].map(h => (
        <text key={h}
          x={toX(dayStart + h * 3600000)} y={67}
          textAnchor="middle" fontSize={7} fill="rgba(0,0,0,0.28)">
          {`${h}:00`}
        </text>
      ))}
    </svg>
  );
}

// ── Glass Bubble ──
interface BubbleProps {
  label: string;
  icon: string;
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
        <span style={{ fontSize: 30, lineHeight: 1 }}>{icon}</span>
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
export const DayEcoSphere: React.FC = () => {
  const { t } = useTranslation();
  const [active, setActive] = useState<ActiveBubble>(null);
  const messages = useChatStore(state => state.messages);
  const activityMood = useMoodStore(state => state.activityMood);

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
    () => computeActivityDistribution(todayMessages),
    [todayMessages],
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

  return (
    <div className="mb-1">
      <div className="flex justify-around px-4 pt-2 pb-1">
        <GlassBubble
          label={t('eco_sphere_mood_label')} icon="🌙" color="#c084fc"
          active={active === 'mood'} onClick={() => toggle('mood')}
          hasData={moodDist.length > 0}
        />
        <GlassBubble
          label={t('eco_sphere_activity_label')} icon="🌿" color="#34d399"
          active={active === 'activity'} onClick={() => toggle('activity')}
          hasData={activityData.length > 0}
        />
        <GlassBubble
          label={t('eco_sphere_empty_label')} icon="✨" color="#94a3b8"
          active={false} onClick={() => {}} hasData={false} disabled
        />
      </div>

      {isNight && (
        <p className="text-center px-6 pb-1" style={{ fontSize: 10, color: 'rgba(154,136,120,0.65)' }}>
          {t('eco_sphere_night_hint')}
        </p>
      )}

      {active === 'mood' && (
        <div className="mx-3 mb-2 rounded-2xl p-3 space-y-3" style={{
          background: 'linear-gradient(135deg, rgba(192,132,252,0.07), rgba(255,255,255,0.96))',
          border: '1px solid rgba(192,132,252,0.18)',
        }}>
          <p className="text-xs font-semibold" style={{ color: '#6b5a3e' }}>
            {t('eco_sphere_mood_energy_title')}
          </p>
          {moodTimeline.length > 0
            ? <MoodEnergyLine points={moodTimeline} />
            : <p className="text-xs text-center py-3" style={{ color: '#9a8878' }}>
                {t('eco_sphere_no_mood_data')}
              </p>
          }
          {moodDist.length > 0 && (
            <>
              <p className="text-xs font-semibold pt-1" style={{ color: '#6b5a3e' }}>
                {t('report_today_mood_spectrum')}
              </p>
              <MoodPieChart distribution={moodDist} />
            </>
          )}
        </div>
      )}

      {active === 'activity' && (
        <div className="mx-3 mb-2 rounded-2xl p-3" style={{
          background: 'linear-gradient(135deg, rgba(52,211,153,0.07), rgba(255,255,255,0.96))',
          border: '1px solid rgba(52,211,153,0.18)',
        }}>
          <p className="text-xs font-semibold mb-2" style={{ color: '#6b5a3e' }}>
            {t('report_activity_category')}
          </p>
          {activityData.length > 0
            ? <ActivityCategoryDonut data={activityData} />
            : <p className="text-xs text-center py-3" style={{ color: '#9a8878' }}>
                {t('eco_sphere_no_activity_data')}
              </p>
          }
        </div>
      )}
    </div>
  );
};
