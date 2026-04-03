// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Zap } from 'lucide-react';
import type { Message } from '../../../store/useChatStore';
import { useChatStore } from '../../../store/useChatStore';
import { useMoodStore } from '../../../store/useMoodStore';
import { getMoodColor } from '../../../lib/moodColor';
import { normalizeMoodKey } from '../../../lib/moodOptions';
import { ImageUploader } from './ImageUploader';
import { useStardustStore } from '../../../store/useStardustStore';
import type { StardustCardData } from '../../../types/stardust';

export interface MoodCardProps {
  message: Message; // isMood: true, detached: true
  onReturnToEvent: (id: string) => void;
  onConvertToEvent: (id: string) => void;
  onDelete: (id: string) => void;
  onMoodClick: (messageId: string) => void;
  readonly?: boolean;
  onStardustSelect?: (data: StardustCardData, position: { x: number; y: number }) => void;
}

export const MoodCard: React.FC<MoodCardProps> = ({
  message,
  onReturnToEvent,
  onConvertToEvent,
  onDelete,
  onMoodClick,
  readonly,
  onStardustSelect,
}) => {
  const { t } = useTranslation();
  const { updateMessageImage } = useChatStore();
  const activityMood      = useMoodStore(s => s.activityMood);
  const customMoodLabel   = useMoodStore(s => s.customMoodLabel);
  const customMoodApplied = useMoodStore(s => s.customMoodApplied);
  const stardust = useStardustStore(s => s.getStardustByMessageId(message.id));
  const stardustEmoji = stardust?.emojiChar || message.stardustEmoji;

  const [cardActive, setCardActive] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardActive) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setCardActive(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cardActive]);

  const rawLabel = (customMoodApplied[message.id] && customMoodLabel[message.id])
    ? customMoodLabel[message.id]
    : activityMood[message.id];
  const moodKey   = normalizeMoodKey(rawLabel);
  const moodColor = getMoodColor(rawLabel) || '#38BDF8';
  void onMoodClick;
  void moodKey;

  const hasImage1 = !!message.imageUrl;
  const hasImage2 = !!message.imageUrl2;
  const hasImages = hasImage1 || hasImage2;

  const handleImageRemoved = (slot: 'imageUrl' | 'imageUrl2') => {
    void updateMessageImage(message.id, slot, null);
  };

  return (
    <div
      ref={cardRef}
      data-message-id={message.id}
      style={{
        background: 'linear-gradient(135deg, rgba(240,249,255,0.97) 0%, rgba(224,242,254,0.94) 100%)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        borderRadius: '2rem',
        border: 'none',
        boxShadow: 'none',
        position: 'relative',
        overflow: 'hidden',
        padding: '10px 13px 9px',
      }}
      onClick={() => { if (!readonly && !cardActive) setCardActive(true); }}
    >
      {/* ── Header row: title + action buttons + delete ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: hasImages ? 6 : 0, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flex: 1, minWidth: 0, paddingRight: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0,
            background: moodColor }} />
          <h3 style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', margin: 0, flex: 1, minWidth: 0,
            lineHeight: 1.4 }}>
            {message.content}
          </h3>
          {stardustEmoji && (
            stardust && onStardustSelect ? (
              <button type="button" aria-label="stardust-emoji"
                style={{ flexShrink: 0, fontSize: 14, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}
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
          {/* Return / convert buttons — shown when cardActive */}
          {!readonly && cardActive && (
            <>
              <button onClick={e => { e.stopPropagation(); onReturnToEvent(message.id); }} title={t('mood_return_event')}
                style={{ background: 'none', border: '1px solid rgba(56,189,248,0.4)', borderRadius: '50%',
                  padding: 4, cursor: 'pointer', color: '#38BDF8', display: 'flex' }}>
                <ArrowLeft size={12} />
              </button>
              <button onClick={e => { e.stopPropagation(); onConvertToEvent(message.id); }} title={t('mood_to_event')}
                style={{ background: 'none', border: '1px solid rgba(52,211,153,0.4)', borderRadius: '50%',
                  padding: 4, cursor: 'pointer', color: '#34D399', display: 'flex' }}>
                <Zap size={12} />
              </button>
            </>
          )}
          {/* Delete */}
          {!readonly && (
            <button onClick={e => { e.stopPropagation(); onDelete(message.id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BAE6FD', padding: 0, display: 'flex' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>
          )}
        </div>
      </div>

      {/* Images */}
      {hasImages && (
        <div style={{ display: 'flex', gap: 6, position: 'relative', zIndex: 1 }}>
          {hasImage1 && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <ImageUploader messageId={message.id} imageUrl={message.imageUrl}
                onUploaded={() => {}} onRemoved={() => handleImageRemoved('imageUrl')}
                compact hideUploadWhen readonly={readonly} />
            </div>
          )}
          {hasImage2 && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <ImageUploader messageId={`${message.id}_2`} imageUrl={message.imageUrl2}
                onUploaded={() => {}} onRemoved={() => handleImageRemoved('imageUrl2')}
                compact hideUploadWhen readonly={readonly} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
