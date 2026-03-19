import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Play } from 'lucide-react';
import { useFocusStore } from '../../store/useFocusStore';
import { useChatStore } from '../../store/useChatStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useGrowthStore } from '../../store/useGrowthStore';
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
    const msgId = await sendMessage(todo.title, now, 'record');
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

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-blue-900 to-blue-950 flex flex-col items-center justify-center">
      {/* Close button */}
      <button
        onClick={() => { if (isRunning) setShowConfirmEnd(true); else onClose(); }}
        className="absolute top-6 right-6 text-white/60 hover:text-white"
      >
        <X size={24} />
      </button>

      {/* Task name */}
      <h2 className="text-white/80 text-lg mb-8 px-6 text-center">{todo.title}</h2>

      {summary ? (
        /* Summary view */
        <div className="flex flex-col items-center">
          <div className="text-6xl mb-6">🎉</div>
          <p className="text-white text-xl font-medium mb-8">{summary}</p>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-white text-blue-900 rounded-full text-lg font-medium"
          >
            {t('close')}
          </button>
        </div>
      ) : isRunning ? (
        /* Timer running */
        <>
          <FocusTimer
            setDuration={currentSession!.setDuration}
            startedAt={currentSession!.startedAt}
            onEnd={handleEnd}
            onAutoComplete={finishFocus}
          />
          {/* Confirm end dialog */}
          {showConfirmEnd && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
              <div className="bg-white rounded-2xl p-6 mx-8 max-w-sm w-full">
                <p className="text-gray-800 text-center mb-4">{t('growth_focus_end_confirm')}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirmEnd(false)}
                    className="flex-1 py-2 bg-gray-100 rounded-xl text-gray-700 font-medium"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleConfirmEnd}
                    className="flex-1 py-2 bg-red-500 rounded-xl text-white font-medium"
                  >
                    {t('growth_focus_end')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Duration picker */
        <div className="flex flex-col items-center">
          {/* Circular duration selector — drag the ring to set time */}
          <div className="relative w-64 h-64 mb-8 cursor-pointer select-none">
            <svg
              ref={svgRef}
              className="w-full h-full -rotate-90"
              viewBox="0 0 260 260"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStartRing}
              onTouchMove={handleTouchMoveRing}
              onTouchEnd={handleTouchEndRing}
            >
              {/* Wide invisible hit area on the ring */}
              <circle cx="130" cy="130" r="120" fill="none" stroke="transparent" strokeWidth="40" />
              {/* Background ring */}
              <circle cx="130" cy="130" r="120" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              {/* Progress arc */}
              <circle
                cx="130" cy="130" r="120"
                fill="none" stroke="#3B82F6" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 120}
                strokeDashoffset={2 * Math.PI * 120 * (1 - durationMinutes / 60)}
              />
              {/* Drag handle dot */}
              {(() => {
                const angle = (durationMinutes / 60) * 2 * Math.PI - Math.PI / 2;
                const hx = 130 + 120 * Math.cos(angle);
                const hy = 130 + 120 * Math.sin(angle);
                return <circle cx={hx} cy={hy} r="10" fill="#3B82F6" stroke="white" strokeWidth="2" />;
              })()}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-5xl font-mono font-bold text-white tabular-nums">
                {String(durationMinutes).padStart(2, '0')}:00
              </span>
              <span className="text-white/50 text-xs mt-1">{t('growth_focus_set_duration')}</span>
            </div>
          </div>

          <div className="flex gap-4">
            {/* Start countdown */}
            <button
              onClick={() => handleStart(false)}
              className="px-6 py-3 bg-blue-500 text-white rounded-full text-lg font-medium hover:bg-blue-600 flex items-center gap-2 shadow-lg"
            >
              <Play size={20} />
              {t('growth_focus_start')}
            </button>
            {/* Start count-up */}
            <button
              onClick={() => handleStart(true)}
              className="px-6 py-3 bg-white/10 text-white rounded-full text-sm font-medium hover:bg-white/20 border border-white/20"
            >
              {t('growth_focus_counting_up')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
