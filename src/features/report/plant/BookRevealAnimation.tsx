// DOC-DEPS: LLM.md -> src/features/report/README.md
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DailyPlantRecord } from '../../../types/plant';
import { PlantImage } from './PlantImage';

type Phase = 'entering' | 'flipping' | 'stopping' | 'emerging' | 'done';

interface BookRevealAnimationProps {
  isGenerating: boolean;
  plant: DailyPlantRecord | null;
  onDone: () => void;
}

const LINE_COUNT = 9;

function PageLines({ faint = false }: { faint?: boolean }) {
  return (
    <>
      {Array.from({ length: LINE_COUNT }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            top: 18 + i * 17,
            height: 1,
            background: faint ? 'rgba(140,100,50,0.18)' : 'rgba(160,120,60,0.25)',
          }}
        />
      ))}
    </>
  );
}

export const BookRevealAnimation: React.FC<BookRevealAnimationProps> = ({
  isGenerating,
  plant,
  onDone,
}) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('entering');

  // entering → flipping
  useEffect(() => {
    const id = window.setTimeout(() => setPhase('flipping'), 600);
    return () => window.clearTimeout(id);
  }, []);

  // flipping → stopping → emerging → done (fires when isGenerating ends)
  useEffect(() => {
    if (isGenerating || phase !== 'flipping') return;
    setPhase('stopping');
    const t1 = window.setTimeout(() => setPhase('emerging'), 800);
    const t2 = window.setTimeout(() => { setPhase('done'); onDone(); }, 2400);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [isGenerating, phase, onDone]);

  if (phase === 'done') return null;

  const visible   = phase !== 'entering';
  const flipping  = phase === 'flipping';
  const stopping  = phase === 'stopping';
  const emerging  = phase === 'emerging';

  return (
    <>
      <style>{`
        @keyframes book-flip {
          0%   { transform: rotateY(0deg); }
          45%  { transform: rotateY(-175deg); }
          55%  { transform: rotateY(-175deg); }
          100% { transform: rotateY(0deg); }
        }
        @keyframes book-stop {
          0%   { transform: rotateY(0deg); }
          100% { transform: rotateY(-175deg); }
        }
        @keyframes plant-rise {
          0%   { transform: translateX(-50%) translateY(60px) scale(0.3); opacity: 0; }
          35%  { opacity: 1; }
          100% { transform: translateX(-50%) translateY(-32px) scale(1); opacity: 1; }
        }
        @keyframes spine-glow {
          0%,100% { box-shadow: 0 0 6px rgba(155,205,100,0.15); }
          50%      { box-shadow: 0 0 26px rgba(155,205,100,0.85); }
        }
      `}</style>

      {/* Overlay */}
      <div
        className="absolute inset-0 z-40 flex flex-col items-center justify-center transition-opacity duration-500"
        style={{
          background: 'rgba(16, 10, 4, 0.86)',
          backdropFilter: 'blur(12px)',
          opacity: visible ? 1 : 0,
        }}
      >
        {/* Book */}
        <div
          className="relative transition-all duration-700"
          style={{
            perspective: 900,
            transform: visible
              ? 'translateY(0) scale(1)'
              : 'translateY(22px) scale(0.9)',
          }}
        >
          <div className="flex items-stretch" style={{ gap: 0 }}>
            {/* Left page */}
            <div
              style={{
                position: 'relative',
                width: 130,
                height: 176,
                background: 'linear-gradient(108deg, #f6e9d0 0%, #f0dcb6 100%)',
                borderRadius: '3px 0 0 3px',
                boxShadow: '-4px 8px 20px rgba(0,0,0,0.5)',
                overflow: 'hidden',
              }}
            >
              <PageLines />
            </div>

            {/* Spine */}
            <div
              style={{
                width: 10,
                flexShrink: 0,
                background: 'linear-gradient(to bottom, #7a5a10, #a8801e, #7a5a10)',
                boxShadow: '0 0 10px rgba(0,0,0,0.55)',
                animation: emerging ? 'spine-glow 1.4s ease-in-out' : undefined,
              }}
            />

            {/* Right page */}
            <div
              style={{
                position: 'relative',
                width: 130,
                height: 176,
                background: 'linear-gradient(72deg, #f0dcb6 0%, #f6e9d0 100%)',
                borderRadius: '0 3px 3px 0',
                boxShadow: '4px 8px 20px rgba(0,0,0,0.5)',
                overflow: 'hidden',
              }}
            >
              <PageLines />
            </div>

            {/* Animated flipping page */}
            {(flipping || stopping) && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  width: 130,
                  height: 176,
                  transformStyle: 'preserve-3d',
                  transformOrigin: 'left center',
                  animation: flipping
                    ? 'book-flip 1.7s ease-in-out infinite'
                    : 'book-stop 0.7s ease-out forwards',
                }}
              >
                {/* Front face */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(72deg, #e8d0a4 0%, #f4e6cc 100%)',
                    borderRadius: '0 3px 3px 0',
                    backfaceVisibility: 'hidden',
                    overflow: 'hidden',
                  }}
                >
                  <PageLines faint />
                </div>
                {/* Back face */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(108deg, #f4e6cc 0%, #e8d0a4 100%)',
                    borderRadius: '3px 0 0 3px',
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                />
              </div>
            )}

            {/* Plant rises from spine */}
            {emerging && plant && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '50%',
                  width: 90,
                  height: 114,
                  zIndex: 10,
                  animation: 'plant-rise 1.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                }}
              >
                <PlantImage
                  plantId={plant.plantId}
                  rootType={plant.rootType}
                  plantStage={plant.plantStage}
                  imgClassName="w-full h-full object-contain"
                />
              </div>
            )}
          </div>
        </div>

        {/* Status text */}
        <p
          className="mt-6 text-xs font-medium transition-opacity duration-500"
          style={{ color: '#e0c898', opacity: emerging ? 0 : 1 }}
        >
          {t('plant_generating')}
        </p>
      </div>
    </>
  );
};
