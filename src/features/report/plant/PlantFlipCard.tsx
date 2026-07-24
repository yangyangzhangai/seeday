// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Download, PenLine, X } from 'lucide-react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { useTranslation } from 'react-i18next';
import type { DailyPlantRecord, PlantCategoryKey, RootSegment } from '../../../types/plant';
import { renderRootSegments } from '../../../lib/rootRenderer';
import { toPlantCategoryKey } from '../../../lib/plantActivityMapper';
import { getPlantDisplayName } from '../../../lib/plantDisplayName';
import { compactPlantDiaryText, resolvePlantDiaryLang } from '../../../lib/plantDiaryText';
import { useChatStore } from '../../../store/useChatStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { PlantImage } from './PlantImage';
import { SoilCanvas } from './SoilCanvas';
import { useLongPressSave } from './useLongPressSave';

function getCompanionName(mode: string): string {
  if (mode === 'agnes') return 'Agnes';
  if (mode === 'zep') return 'Zep';
  if (mode === 'momo') return 'Momo';
  return 'Van';
}

function getCategoryI18nKey(category: PlantCategoryKey): string {
  switch (category) {
    case 'work_study': return 'plant_category_work_study';
    case 'exercise': return 'plant_category_exercise';
    case 'social': return 'category_social';
    case 'entertainment': return 'category_entertainment';
    default: return 'category_life';
  }
}

function PlantCardMetadata({ name, date }: { name: string | null; date: string }) {
  const textStyle: React.CSSProperties = {
    opacity: 0.52,
    color: '#5c4b37',
    fontSize: 11,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    fontFamily: '"LXGW WenKai", cursive',
    letterSpacing: '0.06em',
  };
  return (
    <div style={{
      width: '100%', display: 'flex', alignItems: 'baseline', justifyContent: 'center',
      gap: 8, boxSizing: 'border-box',
    }}>
      {name ? <span style={textStyle}>{name}</span> : <span />}
      <span style={textStyle}>{date}</span>
    </div>
  );
}

interface PlantFlipCardProps {
  plant: DailyPlantRecord;
  segments: RootSegment[];
  directionOrder: PlantCategoryKey[];
  cardOnly?: boolean;
  onClose?: () => void;
  onGenerateDiary?: () => void;
  isGeneratingDiary?: boolean;
  isDiaryButtonDisabled?: boolean;
  diaryButtonHint?: string | null;
}

export const PlantFlipCard: React.FC<PlantFlipCardProps> = ({
  plant, segments, directionOrder, cardOnly = false, onClose, onGenerateDiary, isGeneratingDiary = false, isDiaryButtonDisabled = false, diaryButtonHint = null,
}) => {
  const { t, i18n } = useTranslation();
  const [flipped, setFlipped] = useState(false);
  const [selectedRootId, setSelectedRootId] = useState<string | null>(null);
  const frontExportRef = useRef<HTMLDivElement>(null);
  const backCaptureRef = useRef<HTMLDivElement>(null);
  const renderedSegments = useMemo(() => renderRootSegments(segments), [segments]);
  const messages = useChatStore(state => state.messages);
  const aiMode = useAuthStore((state) => state.preferences.aiMode);
  const plantName = useMemo(
    () => getPlantDisplayName(plant.plantId, i18n.resolvedLanguage ?? i18n.language),
    [i18n.language, i18n.resolvedLanguage, plant.plantId],
  );
  const cardDiaryText = useMemo(
    () => compactPlantDiaryText(
      plant.diaryText ?? '',
      resolvePlantDiaryLang(i18n.resolvedLanguage ?? i18n.language),
    ),
    [i18n.language, i18n.resolvedLanguage, plant.diaryText],
  );

  const messageMap = useMemo(() => {
    const map = new Map<string, {
      content: string;
      activityType?: string | null;
      timestamp: number;
      categoryKey?: PlantCategoryKey;
    }>();
    if (plant.rootSnapshot) {
      plant.rootSnapshot.activities.forEach(activity => map.set(activity.id, {
        content: activity.content,
        activityType: activity.activityType,
        timestamp: activity.timestamp,
        categoryKey: activity.categoryKey,
      }));
      return map;
    }
    messages.forEach(m => map.set(m.id, {
      content: m.content,
      activityType: m.activityType,
      timestamp: m.timestamp,
    }));
    return map;
  }, [messages, plant.rootSnapshot]);

  const selectedSegment = useMemo(
    () => segments.find(s => s.id === selectedRootId) ?? null,
    [selectedRootId, segments],
  );
  const selectedMessage = selectedSegment ? messageMap.get(selectedSegment.activityId) : null;

  // Auto-dismiss detail bubble after 5s
  useEffect(() => {
    if (!selectedRootId) return;
    const id = window.setTimeout(() => setSelectedRootId(null), 5000);
    return () => window.clearTimeout(id);
  }, [selectedRootId]);

  const detailBubble = useMemo(() => {
    if (!selectedSegment) return null;
    const startTs = selectedMessage?.timestamp ?? 0;
    const endTs = startTs + selectedSegment.minutes * 60_000;
    const timeRange = startTs
      ? `${format(startTs, 'HH:mm')}-${format(endTs, 'HH:mm')}`
      : '-';
    const category = selectedMessage?.categoryKey
      ?? toPlantCategoryKey(selectedMessage?.activityType, selectedMessage?.content);
    return {
      title: t('plant_detail_title'),
      activity: `${t('plant_detail_activity')}: ${selectedMessage?.content ?? '-'}`,
      category: `${t('plant_detail_category')}: ${t(getCategoryI18nKey(category))}`,
      timeRange: `${t('plant_detail_time_range')}: ${timeRange}`,
      duration: `${t('plant_detail_duration')}: ${t('duration_minutes', { mins: selectedSegment.minutes })}`,
      focus: `${t('plant_detail_focus')}: ${selectedSegment.focus === 'high' ? t('plant_focus_high') : t('plant_focus_medium')}`,
    };
  }, [selectedSegment, selectedMessage, t]);

  const saveCard = async () => {
    const captureRef = flipped ? backCaptureRef : frontExportRef;
    if (!captureRef.current) return;
    try {
      const canvas = await html2canvas(captureRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
      });
      const filename = `plant-${plant.date}-${flipped ? 'roots' : 'plant'}.png`;
      // iOS WKWebView: use Web Share API to save to Photos
      if (typeof navigator.share === 'function') {
        await new Promise<void>((resolve, reject) => {
          canvas.toBlob(async (blob) => {
            if (!blob) { reject(new Error('blob null')); return; }
            const file = new File([blob], filename, { type: 'image/png' });
            try {
              await navigator.share({ files: [file] });
              resolve();
            } catch (e) {
              reject(e);
            }
          }, 'image/png');
        });
        return;
      }
      // Web fallback
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      link.click();
    } catch (err) {
      if (import.meta.env.DEV) console.error('[PlantFlipCard] save failed', err);
    }
  };
  const longPressSaveHandlers = useLongPressSave({
    enabled: cardOnly,
    onSave: saveCard,
  });

  const cardFaceStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    borderRadius: 20,
    overflow: 'hidden',
  };

  const frontContentStyle: React.CSSProperties = {
    ...cardFaceStyle,
    background: 'linear-gradient(145deg, #fdfbf7 0%, #f4eee1 100%)',
    border: '1px solid rgba(139,115,85,0.15)',
    boxShadow: '0 8px 32px rgba(90,60,20,0.2)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 20,
  };

  return (
    <div className={cardOnly
      ? 'h-full w-full'
      : 'h-full flex flex-col items-center overflow-y-auto px-4 pt-4 pb-6 gap-4'}
    >
      {/* ── Flip card ── */}
      <div
        {...longPressSaveHandlers}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: cardOnly ? 'none' : 290,
          height: cardOnly ? '100%' : undefined,
          aspectRatio: '3 / 4',
          flexShrink: 0,
          WebkitTouchCallout: cardOnly ? 'none' : undefined,
          userSelect: cardOnly ? 'none' : undefined,
        }}
      >
        {onClose && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 10, right: 10, zIndex: 50,
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(245,238,224,0.88)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(200,178,138,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} strokeWidth={1.5} color="#5a4028" />
          </button>
        )}
        <div style={{ width: '100%', height: '100%', perspective: 1200 }}>
        <div style={{
          position: 'relative', width: '100%', height: '100%',
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>

          {/* ── Front: plant image (tap to flip) ── */}
          <div
            onClick={() => setFlipped(true)}
            style={{ ...frontContentStyle, cursor: 'pointer' }}
          >
            {/* Corner brackets — all four at true card corners */}
            <div style={{ position: 'absolute', top: 12, left: 12, width: 16, height: 16, opacity: 0.28, borderTop: '1.5px solid #6b5a3e', borderLeft: '1.5px solid #6b5a3e' }} />
            <div style={{ position: 'absolute', top: 12, right: 12, width: 16, height: 16, opacity: 0.28, borderTop: '1.5px solid #6b5a3e', borderRight: '1.5px solid #6b5a3e' }} />
            <div style={{ position: 'absolute', bottom: 12, left: 12, width: 16, height: 16, opacity: 0.28, borderBottom: '1.5px solid #6b5a3e', borderLeft: '1.5px solid #6b5a3e' }} />
            <div style={{ position: 'absolute', bottom: 12, right: 12, width: 16, height: 16, opacity: 0.28, borderBottom: '1.5px solid #6b5a3e', borderRight: '1.5px solid #6b5a3e' }} />

            <div style={{ height: '58%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PlantImage
                plantId={plant.plantId}
                rootType={plant.rootType}
                plantStage={plant.plantStage}
                imgClassName="max-h-full max-w-full object-contain"
              />
            </div>

            {/* Text + date — bottom-aligned so content always appears in the lower area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', width: '100%', gap: 8, paddingBottom: 20, overflow: 'hidden' }}>
              {cardDiaryText ? (
                <p className="line-clamp-5" style={{ textAlign: 'center', color: '#5c4b37', fontSize: '0.75rem', lineHeight: 1.7, letterSpacing: '0.04em', fontFamily: '"LXGW WenKai", cursive' }}>
                  {cardDiaryText}
                </p>
              ) : null}
              <PlantCardMetadata name={plantName} date={plant.date} />
            </div>

            {/* Tap-to-flip hint */}
            <span style={{ position: 'absolute', bottom: 7, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: 'rgba(90,70,40,0.4)', whiteSpace: 'nowrap', fontFamily: '"LXGW WenKai", cursive', letterSpacing: '0.05em' }}>
              ↻ {t('plant_tap_to_flip')}
            </span>
          </div>

          {/* Front export-only surface: no tap hint, extra bottom breathing room */}
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              left: -9999,
              top: -9999,
              width: 290,
              aspectRatio: '3 / 4',
              pointerEvents: 'none',
            }}
          >
            <div
              ref={frontExportRef}
              style={{
                ...frontContentStyle,
                position: 'relative',
                inset: 'auto',
                width: '100%',
                height: '100%',
              }}
            >
              <div style={{ position: 'absolute', top: 12, left: 12, width: 16, height: 16, opacity: 0.28, borderTop: '1.5px solid #6b5a3e', borderLeft: '1.5px solid #6b5a3e' }} />
              <div style={{ position: 'absolute', top: 12, right: 12, width: 16, height: 16, opacity: 0.28, borderTop: '1.5px solid #6b5a3e', borderRight: '1.5px solid #6b5a3e' }} />
              <div style={{ position: 'absolute', bottom: 12, left: 12, width: 16, height: 16, opacity: 0.28, borderBottom: '1.5px solid #6b5a3e', borderLeft: '1.5px solid #6b5a3e' }} />
              <div style={{ position: 'absolute', bottom: 12, right: 12, width: 16, height: 16, opacity: 0.28, borderBottom: '1.5px solid #6b5a3e', borderRight: '1.5px solid #6b5a3e' }} />

              <div style={{ height: '58%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PlantImage
                  plantId={plant.plantId}
                  rootType={plant.rootType}
                  plantStage={plant.plantStage}
                  imgClassName="max-h-full max-w-full object-contain"
                />
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', width: '100%', gap: 8, paddingBottom: 30, overflow: 'hidden' }}>
                {cardDiaryText ? (
                  <p className="line-clamp-5" style={{ textAlign: 'center', color: '#5c4b37', fontSize: '0.75rem', lineHeight: 1.7, letterSpacing: '0.04em', fontFamily: '"LXGW WenKai", cursive' }}>
                    {cardDiaryText}
                  </p>
                ) : null}
                <PlantCardMetadata name={plantName} date={plant.date} />
              </div>
            </div>
          </div>

          {/* ── Back: interactive root system ── */}
          <div style={{ ...cardFaceStyle, transform: 'rotateY(180deg)', boxShadow: '0 8px 32px rgba(90,60,20,0.2)' }}>
            <div ref={backCaptureRef} style={{ position: 'absolute', inset: 0 }}>
              {/* Flip-back button */}
              <button
                onClick={() => { setFlipped(false); setSelectedRootId(null); }}
                style={{
                  position: 'absolute', top: 10, left: 10, zIndex: 30,
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(245,238,224,0.88)',
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(200,178,138,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <ChevronLeft size={24} strokeWidth={1.5} color="#5a4028" />
              </button>

              {/* Fully interactive root system */}
              <SoilCanvas
                items={renderedSegments}
                selectedRootId={selectedRootId}
                onSelectRoot={setSelectedRootId}
                directionOrder={directionOrder}
                detailBubble={detailBubble}
                onCloseDetail={() => setSelectedRootId(null)}
              />
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      {!cardOnly ? (
      <div style={{ width: '100%', maxWidth: 290, display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
        {onGenerateDiary ? (
            <button
              onClick={onGenerateDiary}
              disabled={isDiaryButtonDisabled}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-white font-medium text-base shadow-md active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(to right, #728a5c, #5e734b)' }}
            >
              <PenLine size={16} strokeWidth={1.5} />
            {isGeneratingDiary ? t('report_generating', { companion: getCompanionName(aiMode) }) : t('plant_card_diary_button')}
          </button>
        ) : null}
        {diaryButtonHint ? (
          <p className="text-[10px] font-medium text-center" style={{ color: '#5f6f65', margin: 0 }}>
            {diaryButtonHint}
          </p>
        ) : null}
        <button
          onClick={saveCard}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-medium text-sm active:scale-95 transition-all"
          style={{ color: '#5e734b', border: '1px solid rgba(94,115,75,0.22)', background: 'rgba(255,255,255,0.88)' }}
        >
          <Download size={16} strokeWidth={1.5} />
          {t('plant_save_card')}
        </button>
      </div>
      ) : null}
    </div>
  );
};
