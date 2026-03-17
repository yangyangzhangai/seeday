import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  setDuration: number; // seconds, 0 = count-up
  startedAt: number;
  onEnd: () => void;
}

export const FocusTimer = ({ setDuration, startedAt, onEnd }: Props) => {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number>(0);

  const tick = useCallback(() => {
    const now = Date.now();
    const secs = Math.floor((now - startedAt) / 1000);
    setElapsed(secs);

    // Auto-end for countdown mode
    if (setDuration > 0 && secs >= setDuration) {
      onEnd();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [startedAt, setDuration, onEnd]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  const isCountdown = setDuration > 0;
  const displaySeconds = isCountdown ? Math.max(0, setDuration - elapsed) : elapsed;
  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;

  // Progress for circle (0 to 1)
  const progress = isCountdown
    ? Math.min(elapsed / setDuration, 1)
    : 0; // No progress ring for count-up

  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center justify-center">
      {/* Timer circle */}
      <div className="relative w-64 h-64">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
          {/* Background circle */}
          <circle
            cx="130" cy="130" r="120"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="6"
          />
          {/* Progress circle */}
          {isCountdown && (
            <circle
              cx="130" cy="130" r="120"
              fill="none"
              stroke="#3B82F6"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000"
            />
          )}
          {/* Count-up pulsing ring */}
          {!isCountdown && (
            <circle
              cx="130" cy="130" r="120"
              fill="none"
              stroke="#3B82F6"
              strokeWidth="3"
              opacity="0.3"
              className="animate-pulse"
            />
          )}
        </svg>

        {/* Time display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-mono font-bold text-gray-900 tabular-nums">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
          {!isCountdown && (
            <span className="text-xs text-gray-400 mt-1">{t('growth_focus_counting_up')}</span>
          )}
        </div>
      </div>

      {/* End button */}
      <button
        onClick={onEnd}
        className="mt-8 px-8 py-3 bg-red-500 text-white rounded-full text-lg font-medium hover:bg-red-600 transition-colors shadow-lg"
      >
        {t('growth_focus_end')}
      </button>
    </div>
  );
};
