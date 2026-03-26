// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { useMemo, useRef, useState } from 'react';
import { Download, PenLine } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useTranslation } from 'react-i18next';
import type { DailyPlantRecord, PlantCategoryKey, RootSegment } from '../../../types/plant';
import { renderRootSegments } from '../../../lib/rootRenderer';
import { PlantImage } from './PlantImage';
import { SoilCanvas } from './SoilCanvas';

interface PlantFlipCardProps {
  plant: DailyPlantRecord;
  segments: RootSegment[];
  directionOrder: PlantCategoryKey[];
  onGenerateDiary: () => void;
}

export const PlantFlipCard: React.FC<PlantFlipCardProps> = ({
  plant, segments, directionOrder, onGenerateDiary,
}) => {
  const { t } = useTranslation();
  const [flipped, setFlipped] = useState(false);
  const frontRef = useRef<HTMLDivElement>(null);
  const renderedSegments = useMemo(() => renderRootSegments(segments), [segments]);

  const saveCard = async () => {
    if (!frontRef.current) return;
    try {
      const canvas = await html2canvas(frontRef.current, { scale: 2, backgroundColor: null });
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `plant-${plant.date}.png`;
      link.href = url;
      link.click();
    } catch (err) {
      if (import.meta.env.DEV) console.error('[PlantFlipCard] save failed', err);
    }
  };

  const cardStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    borderRadius: 20,
    overflow: 'hidden',
  };

  return (
    <div className="h-full flex flex-col items-center overflow-y-auto px-4 pt-4 pb-6 gap-4">
      {/* ── Flip card ── */}
      <div
        onClick={() => setFlipped(v => !v)}
        style={{ width: '100%', maxWidth: 290, aspectRatio: '3 / 4', flexShrink: 0, perspective: 1200, cursor: 'pointer' }}
      >
        <div style={{
          position: 'relative', width: '100%', height: '100%',
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>

          {/* ── Front: plant image ── */}
          <div
            ref={frontRef}
            style={{
              ...cardStyle,
              background: 'linear-gradient(145deg, #fdfbf7 0%, #f4eee1 100%)',
              border: '1px solid rgba(139,115,85,0.15)',
              boxShadow: '0 8px 32px rgba(90,60,20,0.2)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 20,
            }}
          >
            {/* Corner decorations */}
            <div style={{ position: 'absolute', top: 14, left: 14, width: 18, height: 18, opacity: 0.2, borderTop: '1.5px solid #6b5a3e', borderLeft: '1.5px solid #6b5a3e' }} />
            <div style={{ position: 'absolute', top: 14, right: 14, width: 18, height: 18, opacity: 0.2, borderTop: '1.5px solid #6b5a3e', borderRight: '1.5px solid #6b5a3e' }} />
            <div style={{ position: 'absolute', bottom: 26, left: 14, width: 18, height: 18, opacity: 0.2, borderBottom: '1.5px solid #6b5a3e', borderLeft: '1.5px solid #6b5a3e' }} />
            <div style={{ position: 'absolute', bottom: 26, right: 14, width: 18, height: 18, opacity: 0.2, borderBottom: '1.5px solid #6b5a3e', borderRight: '1.5px solid #6b5a3e' }} />

            {/* Plant image — ~60% card height, object-contain to show full image */}
            <div style={{ height: '60%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PlantImage
                plantId={plant.plantId}
                rootType={plant.rootType}
                plantStage={plant.plantStage}
                imgClassName="max-h-full max-w-full object-contain"
              />
            </div>

            {/* Description — max 3 lines */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', paddingTop: 8 }}>
              {plant.diaryText ? (
                <p
                  className="line-clamp-3"
                  style={{
                    textAlign: 'center', color: '#5c4b37',
                    fontSize: '0.8rem', lineHeight: 1.75,
                    letterSpacing: '0.04em',
                    fontFamily: '"LXGW WenKai", cursive',
                  }}
                >
                  {plant.diaryText}
                </p>
              ) : null}
            </div>

            {/* Date stamp + flip hint */}
            <span style={{ position: 'absolute', bottom: 14, right: 14, opacity: 0.32, fontSize: 9, color: '#5c4b37' }}>
              {plant.date}
            </span>
            <span style={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: 'rgba(90,70,40,0.28)', whiteSpace: 'nowrap' }}>
              {t('plant_tap_to_flip')}
            </span>
          </div>

          {/* ── Back: root system ── */}
          <div style={{
            ...cardStyle,
            transform: 'rotateY(180deg)',
            background: '#140a02',
            boxShadow: '0 8px 32px rgba(90,60,20,0.2)',
          }}>
            {/* Transparent overlay to capture click and flip back */}
            <div
              style={{ position: 'absolute', inset: 0, zIndex: 20 }}
              onClick={(e) => { e.stopPropagation(); setFlipped(false); }}
            />
            {/* Non-interactive root system display */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <SoilCanvas
                items={renderedSegments}
                selectedRootId={null}
                onSelectRoot={() => {}}
                directionOrder={directionOrder}
                detailBubble={null}
                onCloseDetail={() => {}}
              />
            </div>
            <span style={{
              position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
              zIndex: 21, fontSize: 9, color: 'rgba(245,235,210,0.35)', whiteSpace: 'nowrap',
            }}>
              {t('plant_tap_to_flip')}
            </span>
          </div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ width: '100%', maxWidth: 290, display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
        <button
          onClick={onGenerateDiary}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-white font-medium text-[14px] shadow-md active:scale-95 transition-all"
          style={{ background: 'linear-gradient(to right, #728a5c, #5e734b)' }}
        >
          <PenLine size={16} />
          {t('plant_card_diary_button')}
        </button>
        <button
          onClick={saveCard}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-medium text-[14px] active:scale-95 transition-all"
          style={{ color: '#5e734b', border: '1px solid rgba(94,115,75,0.22)', background: 'rgba(255,255,255,0.88)' }}
        >
          <Download size={16} />
          {t('plant_save_card')}
        </button>
      </div>
    </div>
  );
};
