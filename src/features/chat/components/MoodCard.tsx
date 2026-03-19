// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Zap, X } from 'lucide-react';
import type { Message } from '../../../store/useChatStore';
import { useChatStore } from '../../../store/useChatStore';
import { useMoodStore } from '../../../store/useMoodStore';
import { getMoodColor } from '../../../lib/moodColor';
import { getMoodI18nKey, normalizeMoodKey } from '../../../lib/moodOptions';
import { cn } from '../../../lib/utils';
import { ImageUploader } from './ImageUploader';

export interface MoodCardProps {
  message: Message; // isMood: true, detached: true
  onReturnToEvent: (id: string) => void;
  onConvertToEvent: (id: string) => void;
  onDelete: (id: string) => void;
  onMoodClick: (messageId: string) => void;
  /** Past-date card: no editing or deleting allowed */
  readonly?: boolean;
}

export const MoodCard: React.FC<MoodCardProps> = ({
  message,
  onReturnToEvent,
  onConvertToEvent,
  onDelete,
  onMoodClick,
  readonly,
}) => {
  const { t } = useTranslation();
  const { updateMessageImage } = useChatStore();
  const getMood           = useMoodStore(s => s.getMood);
  const activityMood      = useMoodStore(s => s.activityMood);
  const customMoodLabel   = useMoodStore(s => s.customMoodLabel);
  const customMoodApplied = useMoodStore(s => s.customMoodApplied);

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

  const getTranslatedMood = (label?: string) => {
    if (!label) return t('chat_unknown_mood_label');
    const key = getMoodI18nKey(label);
    return key ? t(key) : label;
  };

  const mood = getMood(message.id);

  const hasImage1 = !!message.imageUrl;
  const hasImage2 = !!message.imageUrl2;
  const hasImages = hasImage1 || hasImage2;

  const handleImageRemoved = (slot: 'imageUrl' | 'imageUrl2') => {
    void updateMessageImage(message.id, slot, null);
  };

  return (
    <div
      ref={cardRef}
      className="bg-sky-50 border border-sky-100 px-3 py-2 rounded-xl relative"
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
            className="text-sm text-gray-800 leading-snug"
            style={{ fontFamily: 'Songti SC, SimSun, STSong, serif' }}
          >
            {message.content}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Mood chip */}
          {mood ? (
            <div
              role={readonly ? undefined : 'button'}
              onClick={readonly ? undefined : e => { e.stopPropagation(); onMoodClick(message.id); }}
              className={cn('shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] text-slate-700', !readonly && 'active:opacity-80 cursor-pointer')}
              style={
                moodKey === 'anxious'
                  ? { background: 'repeating-linear-gradient(45deg,#E5E7EB 0,#E5E7EB 1px,#9CA3AF 1px,#9CA3AF 2px,#6B7280 2px,#6B7280 3px)' }
                  : { backgroundColor: moodColor }
              }
            >
              <span style={{ fontFamily: 'Songti SC, SimSun, STSong, serif' }}>
                {getTranslatedMood(rawLabel)}
              </span>
            </div>
          ) : (
            !readonly && (
              <button
                onClick={e => { e.stopPropagation(); onMoodClick(message.id); }}
                className="shrink-0 w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                title={t('chat_unknown_mood_label')}
              />
            )
          )}

          {/* Return / convert buttons — hidden when readonly */}
          {!readonly && (
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
