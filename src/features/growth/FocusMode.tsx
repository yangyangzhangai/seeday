import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Play } from 'lucide-react';
import { useFocusStore } from '../../store/useFocusStore';
import { FocusTimer } from './FocusTimer';
import { type GrowthTodo } from './GrowthTodoCard';

interface Props {
  todo: GrowthTodo;
  onClose: () => void;
}

export const FocusMode = ({ todo, onClose }: Props) => {
  const { t } = useTranslation();
  const { currentSession, startFocus, endFocus } = useFocusStore();
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const isRunning = currentSession !== null;

  const handleStart = (countUp: boolean) => {
    startFocus(todo.id, countUp ? 0 : durationMinutes * 60);
  };

  const handleEnd = useCallback(() => {
    if (!showConfirmEnd && isRunning) {
      setShowConfirmEnd(true);
      return;
    }
    const session = endFocus();
    if (session?.actualDuration) {
      const mins = Math.floor(session.actualDuration / 60);
      const secs = session.actualDuration % 60;
      const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      setSummary(t('growth_focus_summary', { duration: durStr }));
    }
    setShowConfirmEnd(false);
  }, [showConfirmEnd, isRunning, endFocus, t]);

  const handleConfirmEnd = () => {
    const session = endFocus();
    if (session?.actualDuration) {
      const mins = Math.floor(session.actualDuration / 60);
      const secs = session.actualDuration % 60;
      const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      setSummary(t('growth_focus_summary', { duration: durStr }));
    }
    setShowConfirmEnd(false);
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
          {/* Circular duration selector */}
          <div className="relative w-64 h-64 mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
              <circle cx="130" cy="130" r="120" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
              <circle
                cx="130" cy="130" r="120"
                fill="none" stroke="#3B82F6" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 120}
                strokeDashoffset={2 * Math.PI * 120 * (1 - durationMinutes / 60)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-mono font-bold text-white tabular-nums">
                {String(durationMinutes).padStart(2, '0')}:00
              </span>
              <span className="text-white/50 text-xs mt-1">{t('growth_focus_set_duration')}</span>
            </div>
          </div>

          {/* Duration slider */}
          <input
            type="range"
            min={1}
            max={60}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="w-48 mb-8 accent-blue-500"
          />

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
