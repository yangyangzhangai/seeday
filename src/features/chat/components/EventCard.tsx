// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, Camera, StopCircle, X } from 'lucide-react';
import { getMoodColor } from '../../../lib/moodColor';
import { getMoodI18nKey, normalizeMoodKey } from '../../../lib/moodOptions';
import { formatDuration } from '../../../lib/time';
import { cn } from '../../../lib/utils';
import { ImageUploader, type ImageUploaderHandle } from './ImageUploader';
import type { Message, MoodDescription } from '../../../store/useChatStore';
import { useMoodStore } from '../../../store/useMoodStore';
import { useChatStore } from '../../../store/useChatStore';
import { useStardustStore } from '../../../store/useStardustStore';
import { autoDetectMood } from '../../../lib/mood';

export interface EventCardProps {
  message: Message;
  moodDescriptions: MoodDescription[];
  onEndActivity: (id: string) => void;
  onConvertMood: (moodId: string) => void;
  onMoodClick: (messageId: string) => void;
  onDelete: (id: string) => void;
  allowConvertToMood: boolean;
  readonly?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({
  message, moodDescriptions, onEndActivity, onConvertMood, onMoodClick, onDelete, allowConvertToMood, readonly,
}) => {
  const { t } = useTranslation();
  const getMood           = useMoodStore(s => s.getMood);
  const setMood           = useMoodStore(s => s.setMood);
  const activityMood      = useMoodStore(s => s.activityMood);
  const customMoodLabel   = useMoodStore(s => s.customMoodLabel);
  const customMoodApplied = useMoodStore(s => s.customMoodApplied);
  const stardust = useStardustStore(s => s.getStardustByMessageId(message.id));
  const { detachMoodFromEvent, updateMessageImage, reclassifyRecentInput } = useChatStore();
  const stardustEmoji = stardust?.emojiChar || message.stardustEmoji;

  const [cardActive, setCardActive] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Dismiss delete button when clicking outside the card
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

  return (
    <div
      ref={cardRef}
      className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm relative"
      onClick={() => { if (!readonly && !cardActive) setCardActive(true); }}
    >
      {cardActive && !readonly && (
        <div className="absolute -top-2.5 -right-2.5 flex items-center gap-1 z-10">
          {canUploadImage && (
            <button
              onClick={e => { e.stopPropagation(); handleOpenImageUpload(); }}
              title={t('image_upload')}
              className="w-6 h-6 bg-sky-500 hover:bg-sky-600 rounded-full text-white flex items-center justify-center transition-colors"
            >
              <Camera size={10} />
            </button>
          )}
          {allowConvertToMood && (
            <button
              onClick={e => { e.stopPropagation(); void reclassifyRecentInput(message.id, 'mood'); }}
              title={t('event_to_mood')}
              className="w-6 h-6 bg-violet-500 hover:bg-violet-600 rounded-full text-white flex items-center justify-center transition-colors"
            >
              <ArrowRightLeft size={10} />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDelete(message.id); }}
            className="w-6 h-6 bg-gray-400 hover:bg-red-400 rounded-full text-white flex items-center justify-center transition-colors"
          >
            <X size={9} />
          </button>
        </div>
      )}

      {/* ── Header: dot + title + mood chip ─────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 flex-1 min-w-0">
          <div
            className="w-1.5 h-1.5 rounded-full mt-1 shrink-0"
            style={
              moodKey === 'anxious'
                ? { background: 'repeating-linear-gradient(45deg,#E5E7EB 0,#E5E7EB 1px,#9CA3AF 1px,#9CA3AF 2px)' }
                : { backgroundColor: moodColor }
            }
          />
          <span
            className="text-xs font-semibold text-gray-900 leading-snug"
            style={{ fontFamily: '"Source Han Serif SC","Noto Serif SC","Songti SC","SimSun","STSong",serif' }}
          >
            {message.content}
          </span>
          {stardustEmoji && (
            <span className="shrink-0 text-sm leading-none" aria-label="stardust-emoji">
              {stardustEmoji}
            </span>
          )}
        </div>

        {/* Mood chip (right) — clickable only when not readonly */}
        {hasMoodChip ? (
          <div
            role={readonly ? undefined : 'button'}
            onClick={readonly ? undefined : e => { e.stopPropagation(); onMoodClick(message.id); }}
            className={cn(
              'shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] text-slate-700',
              !readonly && 'active:opacity-80 cursor-pointer',
              cardActive && !readonly && 'mr-20',
            )}
            style={
              moodKey === 'anxious'
                ? { background: 'repeating-linear-gradient(45deg,#E5E7EB 0,#E5E7EB 1px,#9CA3AF 1px,#9CA3AF 2px,#6B7280 2px,#6B7280 3px)' }
                : { backgroundColor: moodColor }
            }
          >
            <span style={{ fontFamily: 'Songti SC, SimSun, STSong, serif' }}>
              {getTranslatedMood(displayLabel)}
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
      </div>

      {readonly ? (
        <div className="flex gap-1.5 mt-1.5">
          {hasImage1 && (
            <div className="flex-1 min-w-0">
              <ImageUploader
                messageId={message.id}
                imageUrl={message.imageUrl}
                onUploaded={url => handleImageUploaded('imageUrl', url)}
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
                onUploaded={url => handleImageUploaded('imageUrl2', url)}
                onRemoved={() => handleImageRemoved('imageUrl2')}
                compact
                hideUploadWhen
                readonly={readonly}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-1.5 mt-1.5">
          <div className="flex-1 min-w-0">
            <ImageUploader
              ref={image1UploaderRef}
              messageId={message.id}
              imageUrl={message.imageUrl}
              onUploaded={url => handleImageUploaded('imageUrl', url)}
              onRemoved={() => handleImageRemoved('imageUrl')}
              compact
              hideUploadButton
            />
          </div>
          {hasImage1 && (
            <div className="flex-1 min-w-0">
              <ImageUploader
                ref={image2UploaderRef}
                messageId={`${message.id}_2`}
                imageUrl={message.imageUrl2}
                onUploaded={url => handleImageUploaded('imageUrl2', url)}
                onRemoved={() => handleImageRemoved('imageUrl2')}
                compact
                hideUploadWhen={hasImage2}
                hideUploadButton
              />
            </div>
          )}
        </div>
      )}

      {/* ── Mood descriptions — below images ─────────────────── */}
      {moodDescriptions.length > 0 && (
        <div className="mt-1.5 space-y-1 border-t border-gray-50 pt-1.5">
          {moodDescriptions.map(desc => (
            <div key={desc.id} className="flex items-center justify-between gap-2">
              <span
                className="text-xs text-gray-600 flex-1"
                style={{ fontFamily: 'Songti SC, SimSun, STSong, serif' }}
              >
                {desc.content}
              </span>
              {!readonly && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    detachMoodFromEvent(message.id, desc.id);
                    onConvertMood(desc.id);
                  }}
                  title={t('mood_convert_btn')}
                  className="flex items-center text-sky-500 hover:text-sky-700 shrink-0 p-0.5"
                >
                  <ArrowRightLeft size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Bottom-left: end button / duration ───────────────── */}
      {(isOngoing || message.duration != null) && (
        <div className="flex items-center gap-1.5 mt-1.5">
          {message.duration != null ? (
            <div className="text-[10px] text-sky-600 border border-sky-200 rounded-full px-2 py-0.5">
              {formatDuration(message.duration)}
            </div>
          ) : (
            <>
              {!readonly && (
                <button
                  onClick={e => { e.stopPropagation(); onEndActivity(message.id); }}
                  title={t('end_event_btn')}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <StopCircle size={14} />
                </button>
              )}
              {/* Live elapsed time */}
              <span className="text-[10px] text-gray-400 tabular-nums">
                {elapsedSec < 60
                  ? `< 1m`
                  : elapsedSec < 3600
                  ? `${Math.floor(elapsedSec / 60)}m`
                  : `${Math.floor(elapsedSec / 3600)}h ${Math.floor((elapsedSec % 3600) / 60)}m`}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
