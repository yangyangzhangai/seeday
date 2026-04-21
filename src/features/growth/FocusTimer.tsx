import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  setDuration: number; // seconds, 0 = count-up
  startedAt: number;
  onEnd: () => void;          // manual "End" button
  onAutoComplete?: () => void; // auto-triggered when countdown reaches 0
}

export const FocusTimer = ({ setDuration, startedAt, onEnd, onAutoComplete }: Props) => {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number>(0);

  const tick = useCallback(() => {
    const now = Date.now();
    const secs = Math.floor((now - startedAt) / 1000);
    setElapsed(secs);

    // Auto-end for countdown mode
    if (setDuration > 0 && secs >= setDuration) {
      if (onAutoComplete) onAutoComplete();
      else onEnd();
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
  const TICKS = 60;
  const elapsedTicks = isCountdown ? Math.min(TICKS, Math.floor(progress * TICKS)) : TICKS;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative h-[260px] w-[260px] sm:h-[290px] sm:w-[290px]">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 260 260">
          <circle cx="130" cy="130" r="120" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />

          {Array.from({ length: TICKS }, (_, i) => {
            const deg = i * 6;
            const rad = (deg - 90) * (Math.PI / 180);
            const active = i < elapsedTicks;
            const tickLen = i % 5 === 0 ? 12 : 7;
            const x1 = 130 + Math.cos(rad) * 101;
            const y1 = 130 + Math.sin(rad) * 101;
            const x2 = 130 + Math.cos(rad) * (101 + tickLen);
            const y2 = 130 + Math.sin(rad) * (101 + tickLen);

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={active ? 'rgba(125,211,252,0.92)' : 'rgba(255,255,255,0.16)'}
                strokeWidth={i % 5 === 0 ? 2.2 : 1.4}
                strokeLinecap="round"
              />
            );
          })}

          {isCountdown && (
            <circle
              cx="130" cy="130" r="120"
              fill="none"
              stroke="rgba(125,211,252,0.6)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000"
              style={{ filter: 'drop-shadow(0 0 8px rgba(125,211,252,0.55))' }}
            />
          )}

          {!isCountdown && (
            <circle
              cx="130" cy="130" r="120"
              fill="none"
              stroke="rgba(125,211,252,0.46)"
              strokeWidth="7"
              opacity="0.65"
              className="animate-pulse"
            />
          )}

          <circle
            cx="130"
            cy="130"
            r="88"
            fill="url(#focusTimerGrad)"
            stroke="rgba(125,211,252,0.4)"
            strokeWidth="2.5"
            style={{ filter: 'drop-shadow(0 0 28px rgba(125,211,252,0.24))' }}
          />
          <defs>
            <radialGradient id="focusTimerGrad" cx="45%" cy="38%" r="60%">
              <stop offset="0%" stopColor="rgba(125,211,252,0.22)" />
              <stop offset="60%" stopColor="rgba(56,189,248,0.14)" />
              <stop offset="100%" stopColor="rgba(15,23,42,0.10)" />
            </radialGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-5xl font-bold tabular-nums text-white [text-shadow:0_0_24px_rgba(125,211,252,0.55)]">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
          {!isCountdown && (
            <span className="mt-1 text-xs text-sky-200/55">{t('growth_focus_counting_up')}</span>
          )}
          {isCountdown && (
            <span className="mt-1 text-xs text-white/40">{t('growth_focus_set_duration')}</span>
          )}
        </div>
      </div>

      <button
        onClick={onEnd}
        className="mt-7 rounded-full border border-rose-300/35 bg-rose-500/25 px-8 py-3 text-lg font-semibold text-rose-100 transition hover:bg-rose-500/35"
      >
        {t('growth_focus_end')}
      </button>
    </div>
  );
};
