// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Zap, X } from 'lucide-react';
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
  // Keep mood data in store for analytics/reporting, while hiding chip in this card UI.
  void onMoodClick;

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
      className="relative"
      style={{
        background: 'linear-gradient(135deg, rgba(240,249,255,0.97) 0%, rgba(224,242,254,0.92) 100%)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        borderRadius: '1.5rem',
        border: '1px solid rgba(186,230,253,0.4)',
        padding: '10px 13px 9px',
      }}
      onClick={() => { if (!readonly && !cardActive) setCardActive(true); }}
    >
      {/* Delete button — top-right, only when card is tapped and not readonly */}
      {cardActive && !readonly && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(message.id); }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-gray-400 hover:bg-red-400 rounded-full text-white flex items-center justify-center transition-colors z-10"
        >
          <X size={9} />
        </button>
      )}

      {/* Text row: dot + content + mood chip + action buttons */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 flex-1 min-w-0">
          <div
            className="w-1.5 h-1.5 rounded-full mt-1 shrink-0"
            style={
              moodKey === 'anxious'
                ? { background: 'repeating-linear-gradient(45deg,#BAE6FD 0,#BAE6FD 1px,#7DD3FC 1px,#7DD3FC 2px)' }
                : { backgroundColor: moodColor }
            }
          />
          <span
            className="leading-snug"
            style={{ fontSize: 13, color: '#1e293b', fontFamily: "'Inter', sans-serif" }}
          >
            {message.content}
          </span>
          {stardustEmoji && (
            stardust && onStardustSelect ? (
              <button
                type="button"
                className="shrink-0 text-sm leading-none rounded-full px-1 py-0.5 hover:bg-violet-50 transition-colors"
                aria-label="stardust-emoji"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  onStardustSelect(
                    {
                      emojiChar: stardust.emojiChar,
                      message: stardust.message,
                      alienName: stardust.alienName || 'T.S',
                      createdAt: stardust.createdAt,
                    },
                    { x: rect.left + rect.width / 2, y: rect.top },
                  );
                }}
              >
                {stardustEmoji}
              </button>
            ) : (
              <span className="shrink-0 text-sm leading-none" aria-label="stardust-emoji">
                {stardustEmoji}
              </span>
            )
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Return / convert buttons — hidden until card is activated */}
          {!readonly && cardActive && (
            <>
              <button
                onClick={e => { e.stopPropagation(); onReturnToEvent(message.id); }}
                title={t('mood_return_event')}
                className="flex items-center text-sky-600 border border-sky-200 rounded-full p-1 hover:bg-sky-100 transition-colors"
              >
                <ArrowLeft size={12} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onConvertToEvent(message.id); }}
                title={t('mood_to_event')}
                className="flex items-center text-emerald-600 border border-emerald-200 rounded-full p-1 hover:bg-emerald-50 transition-colors"
              >
                <Zap size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Images — same layout/size as EventCard, with tap-to-zoom/delete via ImageUploader */}
      {hasImages && (
        <div className="flex gap-1.5 mt-1.5">
          {hasImage1 && (
            <div className="flex-1 min-w-0">
              <ImageUploader
                messageId={message.id}
                imageUrl={message.imageUrl}
                onUploaded={() => {}}
                onRemoved={() => handleImageRemoved('imageUrl')}
                compact
                hideUploadWhen
                readonly={readonly}
              />
            </div>
          )}
          {hasImage2 && (
            <div className="flex-1 min-w-0">
              <ImageUploader
                messageId={`${message.id}_2`}
                imageUrl={message.imageUrl2}
                onUploaded={() => {}}
                onRemoved={() => handleImageRemoved('imageUrl2')}
                compact
                hideUploadWhen
                readonly={readonly}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
