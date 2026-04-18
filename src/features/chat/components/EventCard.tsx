// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, Camera, StopCircle, X } from 'lucide-react';
import { getMoodColor } from '../../../lib/moodColor';
import { getMoodI18nKey, normalizeMoodKey } from '../../../lib/moodOptions';
import { formatDuration } from '../../../lib/time';
import { cn } from '../../../lib/utils';
import { playSound } from '../../../services/sound/soundService';
import { ImageUploader, type ImageUploaderHandle } from './ImageUploader';
import type { Message, MoodDescription } from '../../../store/useChatStore';
import { useMoodStore } from '../../../store/useMoodStore';
import { useChatStore } from '../../../store/useChatStore';
import { useStardustStore } from '../../../store/useStardustStore';
import { autoDetectMood } from '../../../lib/mood';
import type { StardustCardData } from '../../../types/stardust';

const CHAT_CARD_ACTIVE_EVENT = 'chat-card-active';
const MOOD_TAG_FALLBACK_COLOR = '#0F766E';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hslToHex(h: number, s: number, l: number): string {
  const safeS = clamp01(s);
  const safeL = clamp01(l);
  const a = safeS * Math.min(safeL, 1 - safeL);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = safeL - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const cleaned = hex.replace('#', '');
  const normalized = cleaned.length === 3
    ? cleaned.split('').map((ch) => `${ch}${ch}`).join('')
    : cleaned;
  if (normalized.length !== 6) return null;

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };

  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;

  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

function withHexAlpha(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const normalized = cleaned.length === 3
    ? cleaned.split('').map((ch) => `${ch}${ch}`).join('')
    : cleaned;
  if (normalized.length !== 6) return hex;
  const alphaHex = Math.round(clamp01(alpha) * 255).toString(16).padStart(2, '0');
  return `#${normalized}${alphaHex}`;
}

function getStrongerMoodTagColor(hex: string | undefined): string {
  const parsed = hex ? hexToHsl(hex) : null;
  if (!parsed) return MOOD_TAG_FALLBACK_COLOR;
  const strongerS = Math.max(0.6, Math.min(1, parsed.s * 1.45));
  const strongerL = Math.max(0.25, Math.min(0.42, parsed.l - 0.24));
  return hslToHex(parsed.h, strongerS, strongerL);
}

export interface EventCardProps {
  message: Message;
  moodDescriptions: MoodDescription[];
  onEndActivity: (id: string) => void;
  onConvertMood: (moodId: string) => void;
  onMoodClick: (messageId: string) => void;
  onDelete: (id: string) => void;
  allowConvertToMood: boolean;
  readonly?: boolean;
  onStardustSelect?: (data: StardustCardData, position: { x: number; y: number }) => void;
}

export const EventCard: React.FC<EventCardProps> = ({
  message, moodDescriptions, onEndActivity, onConvertMood, onMoodClick, onDelete, allowConvertToMood, readonly, onStardustSelect,
}) => {
  const { t } = useTranslation();
  const getMood           = useMoodStore(s => s.getMood);
  const setMood           = useMoodStore(s => s.setMood);
  const activityMood      = useMoodStore(s => s.activityMood);
  const customMoodLabel   = useMoodStore(s => s.customMoodLabel);
  const customMoodApplied = useMoodStore(s => s.customMoodApplied);
  const stardust = useStardustStore(s => s.getStardustByMessageId(message.id));
  const stardustMemories = useStardustStore(s => s.memories);
  const { detachMoodFromEvent, updateMessageImage, reclassifyRecentInput } = useChatStore();
  const stardustEmoji = stardust?.emojiChar || message.stardustEmoji;

  const [cardActive, setCardActive] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Dismiss delete button when clicking outside the card
  useEffect(() => {
    if (!cardActive) return;
    const handler = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setCardActive(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    document.addEventListener('pointerdown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('pointerdown', handler);
    };
  }, [cardActive]);

  useEffect(() => {
    const handleOtherCardActivated = (event: Event) => {
      const detail = (event as CustomEvent<{ messageId?: string }>).detail;
      if (detail?.messageId !== message.id) {
        setCardActive(false);
      }
    };
    window.addEventListener(CHAT_CARD_ACTIVE_EVENT, handleOtherCardActivated as EventListener);
    return () => {
      window.removeEventListener(CHAT_CARD_ACTIVE_EVENT, handleOtherCardActivated as EventListener);
    };
  }, [message.id]);

  const rawLabel = (customMoodApplied[message.id] && customMoodLabel[message.id])
    ? customMoodLabel[message.id]
    : activityMood[message.id];
  const fallbackLabel =
    !rawLabel && message.mode === 'record' && !message.isMood && message.duration != null
      ? autoDetectMood(message.content, 0)
      : undefined;
  const displayLabel = rawLabel || fallbackLabel;
  const moodKey   = normalizeMoodKey(displayLabel);
  const moodColor = getMoodColor(displayLabel) || '#10B981';

  const getTranslatedMood = (label?: string) => {
    if (!label) return t('chat_unknown_mood_label');
    const key = getMoodI18nKey(label);
    return key ? t(key) : label;
  };

  const mood      = getMood(message.id);
  const hasMoodChip = Boolean(displayLabel || mood);
  const isOngoing = message.isActive && message.duration == null;
  const hasImage1 = !!message.imageUrl;
  const hasImage2 = !!message.imageUrl2;
  const canUploadImage = !hasImage1 || !hasImage2;
  const image1UploaderRef = useRef<ImageUploaderHandle | null>(null);
  const image2UploaderRef = useRef<ImageUploaderHandle | null>(null);

  // Live elapsed-time counter for ongoing events (ticks every 30s)
  const [elapsedSec, setElapsedSec] = useState(() =>
    isOngoing ? Math.floor((Date.now() - message.timestamp) / 1000) : 0,
  );
  useEffect(() => {
    if (!isOngoing) return;
    const update = () => setElapsedSec(Math.floor((Date.now() - message.timestamp) / 1000));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [isOngoing, message.timestamp]);

  useEffect(() => {
    if (rawLabel || mood || !fallbackLabel) return;
    setMood(message.id, fallbackLabel, 'auto');
  }, [rawLabel, mood, fallbackLabel, message.id, setMood]);

  const handleImageUploaded = (slot: 'imageUrl' | 'imageUrl2', url: string) => {
    void updateMessageImage(message.id, slot, url);
  };

  const handleImageRemoved = (slot: 'imageUrl' | 'imageUrl2') => {
    void updateMessageImage(message.id, slot, null);
  };

  const handleOpenImageUpload = () => {
    if (!hasImage1) {
      image1UploaderRef.current?.openFilePicker();
      return;
    }
    if (!hasImage2) {
      image2UploaderRef.current?.openFilePicker();
    }
  };

  const moodTagColor = getStrongerMoodTagColor(moodColor);
  const moodTagBg = withHexAlpha(moodTagColor, 0.2);
  const moodTagShadow = withHexAlpha(moodTagColor, 0.22);

  return (
    <div
      ref={cardRef}
      data-message-id={message.id}
      className="rounded-2xl"
      style={{
        background: '#F7F9F8',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        border: 'none',
        boxShadow: 'none',
        position: 'relative',
        overflow: 'hidden',
        padding: '10px 13px 9px',
      }}
      onClick={() => {
        if (readonly || cardActive) return;
        window.dispatchEvent(new CustomEvent(CHAT_CARD_ACTIVE_EVENT, { detail: { messageId: message.id } }));
        setCardActive(true);
      }}
    >
      {/* ── Header row: title + mood tag + delete ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 6, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flex: 1, minWidth: 0, paddingRight: 6 }}>
          <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', margin: 0, flex: 1, minWidth: 0,
            lineHeight: 1.4 }}>
            {message.content}
          </h3>
          {stardustEmoji && (
            stardust && onStardustSelect ? (
              <button type="button" aria-label="stardust-emoji"
                style={{ flexShrink: 0, fontSize: 14, lineHeight: 1, borderRadius: 9999, padding: '2px 4px',
                  background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={e => {
                  e.stopPropagation();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  onStardustSelect({ emojiChar: stardust.emojiChar, message: stardust.message,
                    alienName: stardust.alienName || 'T.S', createdAt: stardust.createdAt },
                    { x: rect.left + rect.width / 2, y: rect.top });
                }}>
                {stardustEmoji}
              </button>
            ) : (
              <span style={{ flexShrink: 0, fontSize: 14, lineHeight: 1 }} aria-label="stardust-emoji">{stardustEmoji}</span>
            )
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {cardActive && !readonly && canUploadImage && (
            <button onClick={e => { e.stopPropagation(); handleOpenImageUpload(); }} title={t('image_upload')}
              style={{ width: 24, height: 24, background: '#0EA5E9', borderRadius: '50%', border: 'none', cursor: 'pointer',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Camera size={10} />
            </button>
          )}
          {cardActive && !readonly && allowConvertToMood && (
            <button onClick={e => { e.stopPropagation(); void reclassifyRecentInput(message.id, 'mood'); }} title={t('event_to_mood')}
              style={{ width: 24, height: 24, background: '#8B5CF6', borderRadius: '50%', border: 'none', cursor: 'pointer',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowRightLeft size={10} />
            </button>
          )}
          {/* Mood tag */}
          {hasMoodChip ? (
            <button
              onClick={readonly ? undefined : e => { e.stopPropagation(); onMoodClick(message.id); }}
              className="text-xs"
              style={{ fontWeight: 400, padding: '3px 8px', borderRadius: 9999,
                background: moodTagBg, color: moodTagColor, border: 'none',
                cursor: readonly ? 'default' : 'pointer', whiteSpace: 'nowrap',
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                letterSpacing: '0.03em', transition: 'all 0.15s',
                boxShadow: `0 1px 2px ${moodTagShadow}` }}
            >
              {getTranslatedMood(displayLabel)}
            </button>
          ) : (
            !readonly && (
              <button onClick={e => { e.stopPropagation(); onMoodClick(message.id); }}
                style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(178,238,218,0.2)',
                  border: 'none', cursor: 'pointer' }} />
            )
          )}
          {/* Delete */}
          {cardActive && !readonly && (
            <button onClick={e => { e.stopPropagation(); onDelete(message.id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 0, display: 'flex' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Images ── */}
      {(hasImage1 || hasImage2 || (!readonly && canUploadImage)) && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6, position: 'relative', zIndex: 1 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <ImageUploader ref={readonly ? undefined : image1UploaderRef} messageId={message.id}
              imageUrl={message.imageUrl}
              onUploaded={url => handleImageUploaded('imageUrl', url)}
              onRemoved={() => handleImageRemoved('imageUrl')}
              compact hideUploadButton={!readonly} hideUploadWhen={readonly && !hasImage1} readonly={readonly} />
          </div>
          {hasImage1 && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <ImageUploader ref={readonly ? undefined : image2UploaderRef} messageId={`${message.id}_2`}
                imageUrl={message.imageUrl2}
                onUploaded={url => handleImageUploaded('imageUrl2', url)}
                onRemoved={() => handleImageRemoved('imageUrl2')}
                compact hideUploadButton={!readonly} hideUploadWhen={readonly ? !hasImage2 : hasImage2} readonly={readonly} />
            </div>
          )}
        </div>
      )}

      {/* ── Mood notes (italic small) ── */}
      {moodDescriptions.length > 0 && (
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 6 }}>
          {moodDescriptions.map(desc => {
            const moodStardust = stardustMemories.find(mem => mem.messageId === desc.id);
            return (
              <div key={desc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <p className="text-xs" style={{ color: '#64748b', margin: '0 0 3px', lineHeight: 1.45, fontStyle: 'italic', flex: 1 }}>
                  {desc.content}
                </p>
                {moodStardust?.emojiChar && onStardustSelect && (
                  <button type="button" aria-label="stardust-emoji"
                    style={{ flexShrink: 0, fontSize: 14, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={e => {
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      onStardustSelect({ emojiChar: moodStardust.emojiChar, message: moodStardust.message,
                        alienName: moodStardust.alienName || 'T.S', createdAt: moodStardust.createdAt },
                        { x: rect.left + rect.width / 2, y: rect.top });
                    }}>
                    {moodStardust.emojiChar}
                  </button>
                )}
                {!readonly && (
                  <button onClick={e => { e.stopPropagation(); detachMoodFromEvent(message.id, desc.id); onConvertMood(desc.id); }}
                    title={t('mood_convert_btn')}
                    style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#38BDF8', padding: 2 }}>
                    <ArrowRightLeft size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Timer row ── */}
      {(isOngoing || message.duration != null) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <div className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700,
            color: isOngoing ? '#B2EEDA' : 'rgba(71,85,105,0.65)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>timer</span>
            <span>
              {message.duration != null
                ? formatDuration(message.duration)
                : elapsedSec < 60 ? '< 1m'
                  : elapsedSec < 3600 ? `${Math.floor(elapsedSec / 60)}m`
                    : `${Math.floor(elapsedSec / 3600)}h ${Math.floor((elapsedSec % 3600) / 60)}m`}
            </span>
            {isOngoing && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#B2EEDA',
                animation: 'pulse 1s infinite', display: 'inline-block', marginLeft: 2 }} />
            )}
          </div>
          {isOngoing && !readonly && (
            <button onClick={e => { e.stopPropagation(); playSound('ding'); onEndActivity(message.id); }}
              title={t('end_event_btn')}
              className="text-xs"
              style={{ fontWeight: 800, padding: '3px 9px', borderRadius: 9999,
                border: '1px solid rgba(244,192,194,0.3)', background: 'rgba(244,192,194,0.10)',
                color: '#F4C0C2', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>stop_circle</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
