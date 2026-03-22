// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { useEffect, useState } from 'react';

interface PlantRevealAnimationProps {
  revealToken: number;
  children: React.ReactNode;
}

export const PlantRevealAnimation: React.FC<PlantRevealAnimationProps> = ({ revealToken, children }) => {
  const [phase, setPhase] = useState<'idle' | 'cover' | 'reveal'>('idle');

  useEffect(() => {
    if (revealToken <= 0) {
      return;
    }
    setPhase('cover');
    const startId = window.setTimeout(() => {
      setPhase('reveal');
    }, 40);
    const endId = window.setTimeout(() => {
      setPhase('idle');
    }, 1250);
    return () => {
      window.clearTimeout(startId);
      window.clearTimeout(endId);
    };
  }, [revealToken]);

  const overlayClass =
    phase === 'cover'
      ? 'translate-y-0 opacity-100'
      : phase === 'reveal'
        ? 'translate-y-full opacity-100'
        : 'translate-y-full opacity-0';

  const imageClass =
    phase === 'cover'
      ? 'scale-95 opacity-90'
      : 'scale-100 opacity-100';

  return (
    <div className="relative overflow-hidden rounded-xl border border-stone-200/80 bg-gradient-to-b from-amber-50 to-stone-100">
      <div className={`transition-all duration-700 ${imageClass}`}>
        {children}
      </div>
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-stone-700/70 via-stone-600/60 to-stone-400/30 transition-all duration-1000 ease-out ${overlayClass}`}
      />
    </div>
  );
};
