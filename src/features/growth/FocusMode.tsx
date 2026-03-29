import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Play } from 'lucide-react';
import { useFocusStore } from '../../store/useFocusStore';
import { useChatStore } from '../../store/useChatStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useGrowthStore } from '../../store/useGrowthStore';
import { normalizeTodoCategory } from '../../lib/activityType';
import { FocusTimer } from './FocusTimer';
import { type GrowthTodo } from './GrowthTodoCard';

interface Props {
  todo: GrowthTodo;
  onClose: () => void;
}

export const FocusMode = ({ todo, onClose }: Props) => {
  const { t } = useTranslation();
  const { currentSession, activeMessageId, startFocus, setActiveMessageId, endFocus } = useFocusStore();
  const sendMessage = useChatStore((s) => s.sendMessage);
  const endActivity = useChatStore((s) => s.endActivity);
  const toggleTodo = useTodoStore((s) => s.toggleTodo);
  const incrementBottleStar = useGrowthStore((s) => s.incrementBottleStar);
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const isRunning = currentSession !== null;
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);
  const TICKS = 60;
  const SVG_CENTER = 130;
  const RING_RADIUS = 120;

  // Convert pointer position to minutes (1–60) based on angle around circle center
  const pointerToMinutes = useCallback((clientX: number, clientY: number): number => {
    const svg = svgRef.current;
    if (!svg) return durationMinutes;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    // Angle from 12 o'clock, clockwise (0° = top)
    let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    return Math.max(1, Math.min(60, Math.round((angle / 360) * 60) || 1));
  }, [durationMinutes]);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    isDragging.current = true;
    setDurationMinutes(pointerToMinutes(e.clientX, e.clientY));
  };
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging.current) return;
    setDurationMinutes(pointerToMinutes(e.clientX, e.clientY));
  };
  const handleMouseUp = () => { isDragging.current = false; };

  const handleTouchStartRing = (e: React.TouchEvent<SVGSVGElement>) => {
    isDragging.current = true;
    const t = e.touches[0];
    setDurationMinutes(pointerToMinutes(t.clientX, t.clientY));
  };
  const handleTouchMoveRing = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const t = e.touches[0];
    setDurationMinutes(pointerToMinutes(t.clientX, t.clientY));
  };
  const handleTouchEndRing = () => { isDragging.current = false; };

  const handleStart = async (countUp: boolean) => {
    startFocus(todo.id, countUp ? 0 : durationMinutes * 60);
    // Create record page activity
    const now = Date.now();
    const msgId = await sendMessage(todo.title, now, {
      activityTypeOverride: normalizeTodoCategory(todo.category, todo.title),
    });
    if (msgId) {
      setActiveMessageId(msgId);
    }
  };

  const finishFocus = useCallback(async () => {
    // End record page activity (duration = focus session duration)
    if (activeMessageId) {
      // skipBottleStar: star will be awarded below via incrementBottleStar
      await endActivity(activeMessageId, { skipBottleStar: !!todo.bottleId });
    }
    const session = endFocus();
    // Auto-complete the todo and award bottle star
    if (!todo.completed) {
      toggleTodo(todo.id);
      if (todo.bottleId) incrementBottleStar(todo.bottleId);
    }
    if (session?.actualDuration) {
      const mins = Math.floor(session.actualDuration / 60);
      const secs = session.actualDuration % 60;
      const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      setSummary(t('growth_focus_summary', { duration: durStr }));
    }
    setShowConfirmEnd(false);
  }, [activeMessageId, endActivity, endFocus, todo, toggleTodo, incrementBottleStar, t]);

  const handleEnd = useCallback(() => {
    if (!showConfirmEnd && isRunning) {
      setShowConfirmEnd(true);
      return;
    }
    finishFocus();
  }, [showConfirmEnd, isRunning, finishFocus]);

  const handleConfirmEnd = () => {
    finishFocus();
  };

  const selectedTicks = Math.max(1, Math.round((durationMinutes / 60) * TICKS));
  const progressCircumference = 2 * Math.PI * RING_RADIUS;
  const progressDash = progressCircumference * (durationMinutes / 60);
  const handleAngle = (durationMinutes / 60) * 2 * Math.PI - Math.PI / 2;
  const handleX = SVG_CENTER + RING_RADIUS * Math.cos(handleAngle);
  const handleY = SVG_CENTER + RING_RADIUS * Math.sin(handleAngle);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[rgba(10,18,36,0.92)] backdrop-blur-[20px]">
      <button
        onClick={() => { if (isRunning) setShowConfirmEnd(true); else onClose(); }}
        className="absolute right-6 top-6 text-white/60 transition hover:text-white"
      >
        <X size={24} />
      </button>

      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-300/70">
        {isRunning ? t('growth_focus_start') : t('growth_focus_set_duration')}
      </p>
      <h2 className="mb-5 px-6 text-center text-lg font-semibold text-white/85">{todo.title}</h2>

      {summary ? (
        <div className="flex flex-col items-center">
          <div className="text-6xl mb-6">🎉</div>
          <p className="text-white text-xl font-medium mb-8">{summary}</p>
          <button
            onClick={onClose}
            className="rounded-full bg-white px-8 py-3 text-lg font-medium text-slate-900"
          >
            {t('close')}
          </button>
        </div>
      ) : isRunning ? (
        <>
          <FocusTimer
            setDuration={currentSession!.setDuration}
            startedAt={currentSession!.startedAt}
            onEnd={handleEnd}
            onAutoComplete={finishFocus}
          />
          {showConfirmEnd && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55">
              <div className="mx-8 w-full max-w-sm rounded-3xl bg-[#F7F9F8] p-6 shadow-2xl">
                <p className="mb-4 text-center text-sm font-semibold text-slate-700">{t('growth_focus_end_confirm')}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirmEnd(false)}
                    className="flex-1 rounded-xl bg-slate-100 py-2 font-medium text-slate-700"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleConfirmEnd}
                    className="flex-1 rounded-xl bg-rose-500 py-2 font-medium text-white"
                  >
                    {t('growth_focus_end')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center">
          <div className="relative mb-7 h-[260px] w-[260px] cursor-pointer select-none sm:h-[290px] sm:w-[290px]">
            <svg
              ref={svgRef}
              className="h-full w-full -rotate-90"
              viewBox="0 0 260 260"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStartRing}
              onTouchMove={handleTouchMoveRing}
              onTouchEnd={handleTouchEndRing}
            >
              <circle cx="130" cy="130" r="120" fill="none" stroke="transparent" strokeWidth="40" />

              {Array.from({ length: TICKS }, (_, i) => {
                const deg = i * 6;
                const rad = (deg - 90) * (Math.PI / 180);
                const active = i < selectedTicks;
                const tickLen = i % 5 === 0 ? 12 : 7;
                const x1 = SVG_CENTER + Math.cos(rad) * 101;
                const y1 = SVG_CENTER + Math.sin(rad) * 101;
                const x2 = SVG_CENTER + Math.cos(rad) * (101 + tickLen);
                const y2 = SVG_CENTER + Math.sin(rad) * (101 + tickLen);

                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={active ? 'rgba(125,211,252,0.92)' : 'rgba(255,255,255,0.18)'}
                    strokeWidth={i % 5 === 0 ? 2.2 : 1.4}
                    strokeLinecap="round"
                  />
                );
              })}

              <circle
                cx="130" cy="130" r="120"
                fill="none"
                stroke="rgba(125,211,252,0.58)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${progressDash} ${progressCircumference}`}
                strokeDashoffset={progressCircumference / 4}
                style={{ filter: 'drop-shadow(0 0 8px rgba(125,211,252,0.55))' }}
              />

              <circle
                cx={handleX}
                cy={handleY}
                r="10"
                fill="rgba(125,211,252,0.94)"
                stroke="rgba(255,255,255,0.92)"
                strokeWidth="2.2"
                style={{ filter: 'drop-shadow(0 0 10px rgba(125,211,252,0.72))' }}
              />
            </svg>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-5xl font-bold tabular-nums text-white [text-shadow:0_0_24px_rgba(125,211,252,0.55)]">
                {String(durationMinutes).padStart(2, '0')}:00
              </span>
              <span className="mt-1 text-[11px] tracking-[0.08em] text-sky-200/55">{t('growth_focus_set_duration')}</span>
            </div>
          </div>

          <div className="mb-3 flex gap-2">
            {[5, 10, 25, 45].map((preset) => {
              const selected = durationMinutes === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDurationMinutes(preset)}
                  className="rounded-full border px-3 py-1 text-xs font-semibold transition"
                  style={{
                    borderColor: selected ? 'rgba(125,211,252,0.55)' : 'rgba(255,255,255,0.16)',
                    background: selected ? 'rgba(125,211,252,0.28)' : 'rgba(255,255,255,0.08)',
                    color: selected ? '#7dd3fc' : 'rgba(255,255,255,0.55)',
                  }}
                >
                  {preset}m
                </button>
              );
            })}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => handleStart(false)}
              className="flex items-center gap-2 rounded-full px-6 py-3 text-lg font-semibold text-slate-900 shadow-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(125,211,252,0.95) 0%, rgba(56,189,248,0.88) 100%)',
                boxShadow: '0 4px 22px rgba(125,211,252,0.36), inset 0 2px 7px rgba(255,255,255,0.28)',
              }}
            >
              <Play size={20} />
              {t('growth_focus_start')}
            </button>
            <button
              onClick={() => handleStart(true)}
              className="rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/20"
            >
              {t('growth_focus_counting_up')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
