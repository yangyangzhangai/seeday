import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Play, SkipForward } from 'lucide-react';
import { useFocusStore } from '../../store/useFocusStore';
import { useChatStore } from '../../store/useChatStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useGrowthStore } from '../../store/useGrowthStore';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import { normalizeTodoCategory } from '../../lib/activityType';
import { buildTodoCompletionAnnotationPayload } from '../../lib/todoCompletionAnnotation';
import { FocusTimer } from './FocusTimer';
import { type GrowthTodo } from './GrowthTodoCard';

interface Props {
  todo: GrowthTodo;
  /** When provided, FocusMode runs in queue mode — todo is the first item */
  queueTodos?: GrowthTodo[];
  onClose: () => void;
}

export const FocusMode = ({ todo, queueTodos, onClose }: Props) => {
  const { t } = useTranslation();
  const { currentSession, activeMessageId, startFocus, startFocusQueue, advanceQueue, clearQueue, queueIndex, queue, setActiveMessageId, endFocus } = useFocusStore();
  const sendMessage = useChatStore((s) => s.sendMessage);
  const endActivity = useChatStore((s) => s.endActivity);
  const toggleTodo = useTodoStore((s) => s.toggleTodo);
  const todos = useTodoStore((s) => s.todos);
  const incrementBottleStars = useGrowthStore((s) => s.incrementBottleStars);
  const bottles = useGrowthStore((s) => s.bottles);
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isResting, setIsResting] = useState(false);
  const [restCountdown, setRestCountdown] = useState(0);
  const restTimerRef = useRef<number | null>(null);

  const isQueueMode = queueTodos !== undefined && queueTodos.length > 0;
  // Current todo in queue mode is resolved from the store queue
  const currentQueueTodo = isQueueMode && queueIndex >= 0 && queue[queueIndex]
    ? todos.find((t) => t.id === queue[queueIndex].todoId) ?? todo
    : todo;
  const activeTodo = isQueueMode ? currentQueueTodo : todo;

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

  const handleHandleMouseDown = (e: React.MouseEvent<SVGCircleElement>) => {
    e.stopPropagation();
    isDragging.current = true;
  };
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging.current) return;
    setDurationMinutes(pointerToMinutes(e.clientX, e.clientY));
  };
  const handleMouseUp = () => { isDragging.current = false; };

  const handleHandleTouchStart = (e: React.TouchEvent<SVGCircleElement>) => {
    e.stopPropagation();
    isDragging.current = true;
    const touch = e.touches[0];
    setDurationMinutes(pointerToMinutes(touch.clientX, touch.clientY));
  };
  const handleTouchMoveRing = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    setDurationMinutes(pointerToMinutes(touch.clientX, touch.clientY));
  };
  const handleTouchEndRing = () => { isDragging.current = false; };

  const handleStart = async (countUp: boolean) => {
    if (isQueueMode && queueTodos) {
      startFocusQueue(queueTodos.map((qt) => ({
        todoId: qt.id,
        durationSeconds: (qt.suggestedDuration ?? 25) * 60,
      })));
    } else {
      startFocus(todo.id, countUp ? 0 : durationMinutes * 60);
    }
    const targetTodo = isQueueMode ? queueTodos![0] : todo;
    const now = Date.now();
    const msgId = await sendMessage(targetTodo.title, now, {
      skipAnnotation: true,
      activityTypeOverride: normalizeTodoCategory(targetTodo.category, targetTodo.title),
    });
    if (msgId) setActiveMessageId(msgId);
  };

  const completeTodoAndEndActivity = useCallback(async (targetTodo: GrowthTodo) => {
    if (activeMessageId) {
      await endActivity(activeMessageId, { skipBottleStar: !!targetTodo.bottleId });
    }
    const session = endFocus();
    if (!targetTodo.completed) {
      toggleTodo(targetTodo.id);
      const linkedBottle = targetTodo.bottleId ? bottles.find((b) => b.id === targetTodo.bottleId) : null;
      const payload = buildTodoCompletionAnnotationPayload({
        todo: targetTodo,
        allTodos: todos,
        now: Date.now(),
        bottleName: linkedBottle?.name,
      });
      useAnnotationStore.getState().triggerAnnotation({
        type: 'activity_completed',
        timestamp: Date.now(),
        data: {
          content: targetTodo.title,
          summary: payload.summary,
          todoCompletionContext: payload.context,
        },
      }).catch(console.error);
      if (targetTodo.bottleId) {
        const stars = useAnnotationStore.getState().consumeRecoveryBonusForCompletion({
          todoId: targetTodo.id,
          bottleId: targetTodo.bottleId,
        });
        incrementBottleStars(targetTodo.bottleId, stars);
      }
    }
    return session;
  }, [activeMessageId, endActivity, endFocus, toggleTodo, incrementBottleStars, bottles, todos]);

  const startRestThenAdvance = useCallback(() => {
    const REST_SECS = 5 * 60; // 5 min rest
    setIsResting(true);
    setRestCountdown(REST_SECS);
    let remaining = REST_SECS;
    restTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      setRestCountdown(remaining);
      if (remaining <= 0) {
        window.clearInterval(restTimerRef.current!);
        restTimerRef.current = null;
        setIsResting(false);
        const hasNext = advanceQueue();
        if (!hasNext) {
          setSummary(t('growth_focus_summary', { duration: '' }));
        }
      }
    }, 1000);
  }, [advanceQueue, t]);

  const finishFocus = useCallback(async () => {
    const session = await completeTodoAndEndActivity(activeTodo);
    setShowConfirmEnd(false);

    if (isQueueMode) {
      // Start rest period, then advance to next step
      startRestThenAdvance();
      return;
    }

    if (session?.actualDuration) {
      const mins = Math.floor(session.actualDuration / 60);
      const secs = session.actualDuration % 60;
      const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      setSummary(t('growth_focus_summary', { duration: durStr }));
    }
  }, [completeTodoAndEndActivity, activeTodo, isQueueMode, startRestThenAdvance, t]);

  const skipRest = () => {
    if (restTimerRef.current) {
      window.clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }
    setIsResting(false);
    const hasNext = advanceQueue();
    if (!hasNext) setSummary(t('growth_focus_summary', { duration: '' }));
  };

  const handleEnd = useCallback(() => {
    if (!showConfirmEnd && isRunning) {
      setShowConfirmEnd(true);
      return;
    }
    void finishFocus();
  }, [showConfirmEnd, isRunning, finishFocus]);

  const handleConfirmEnd = () => {
    if (isResting) {
      if (restTimerRef.current) {
        window.clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
      setIsResting(false);
      setShowConfirmEnd(false);
      clearQueue();
      onClose();
      return;
    }
    void finishFocus();
  };

  const handleClose = () => {
    if (restTimerRef.current) window.clearInterval(restTimerRef.current);
    clearQueue();
    onClose();
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
        onClick={() => { if (isRunning || isResting) setShowConfirmEnd(true); else handleClose(); }}
        className="absolute right-6 top-6 text-white/60 transition hover:text-white"
      >
        <X size={24} />
      </button>

      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-300/70">
        {isRunning ? t('growth_focus_start') : t('growth_focus_set_duration')}
      </p>
      <h2 className="mb-5 px-6 text-center text-lg font-semibold text-white/85">{activeTodo.title}</h2>

      {/* Queue progress track */}
      {isQueueMode && queueTodos && queueTodos.length > 0 && (
        <div className="mb-4 flex items-center gap-1.5 px-6">
          {queueTodos.map((qt, i) => (
            <div key={qt.id} className="flex flex-col items-center gap-1">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: 32,
                  background: i < queueIndex
                    ? 'rgba(125,211,252,0.90)'
                    : i === queueIndex
                      ? 'rgba(125,211,252,0.60)'
                      : 'rgba(255,255,255,0.18)',
                }}
              />
              <span className="text-[9px] text-white/40 truncate max-w-[40px] text-center leading-tight">
                {qt.title.slice(0, 4)}
              </span>
            </div>
          ))}
        </div>
      )}

      {summary ? (
        <div className="flex flex-col items-center">
          <div className="text-6xl mb-6">🎉</div>
          <p className="text-white text-xl font-medium mb-8">{t('growth_focus_summary', { duration: '' }).replace('：', '')}</p>
          <button
            onClick={handleClose}
            className="rounded-full bg-white px-8 py-3 text-lg font-medium text-slate-900"
          >
            {t('close')}
          </button>
        </div>
      ) : isResting ? (
        <div className="flex flex-col items-center gap-6">
          <p className="text-sky-200/80 text-sm font-medium tracking-wide">{t('growth_focus_resting')}</p>
          <div className="font-mono text-5xl font-bold tabular-nums text-white [text-shadow:0_0_24px_rgba(125,211,252,0.55)]">
            {String(Math.floor(restCountdown / 60)).padStart(2, '0')}:{String(restCountdown % 60).padStart(2, '0')}
          </div>
          <button
            onClick={skipRest}
            className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
          >
            <SkipForward size={15} />
            {t('growth_focus_skip_rest')}
          </button>
        </div>
      ) : isRunning ? (
        <>
          <FocusTimer
              setDuration={currentSession!.setDuration}
              startedAt={currentSession!.startedAt}
              onEnd={handleEnd}
              onAutoComplete={() => void finishFocus()}
            />
        </>
      ) : (
        <div className="flex flex-col items-center">
          <div className="relative mb-7 h-[260px] w-[260px] select-none sm:h-[290px] sm:w-[290px]">
            <svg
              ref={svgRef}
              className="h-full w-full -rotate-90"
              viewBox="0 0 260 260"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
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
                style={{ filter: 'drop-shadow(0 0 10px rgba(125,211,252,0.72))', cursor: 'grab' }}
                onMouseDown={handleHandleMouseDown}
                onTouchStart={handleHandleTouchStart}
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
              onClick={() => void handleStart(false)}
              className="flex items-center gap-2 rounded-full px-6 py-3 text-lg font-semibold text-slate-900 shadow-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(125,211,252,0.95) 0%, rgba(56,189,248,0.88) 100%)',
                boxShadow: '0 4px 22px rgba(125,211,252,0.36), inset 0 2px 7px rgba(255,255,255,0.28)',
              }}
            >
              <Play size={20} />
              {isQueueMode ? t('todo_sequential_focus') : t('growth_focus_start')}
            </button>
            {!isQueueMode && (
              <button
                onClick={() => void handleStart(true)}
                className="rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/20"
              >
                {t('growth_focus_counting_up')}
              </button>
            )}
          </div>
        </div>
      )}

      {showConfirmEnd && (isRunning || isResting) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55">
          <div className="mx-8 w-full max-w-sm rounded-3xl bg-[#F7F9F8] p-6 shadow-2xl">
            <p className="mb-4 text-center text-sm font-semibold text-slate-700">
              {t('growth_focus_end_confirm')}
            </p>
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
    </div>
  );
};
