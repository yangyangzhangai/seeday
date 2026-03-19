// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, StopCircle, X } from 'lucide-react';
import { getMoodColor } from '../../../lib/moodColor';
import { getMoodI18nKey, normalizeMoodKey } from '../../../lib/moodOptions';
import { formatDuration } from '../../../lib/time';
import { cn } from '../../../lib/utils';
import { ImageUploader } from './ImageUploader';
import type { Message, MoodDescription } from '../../../store/useChatStore';
import { useMoodStore } from '../../../store/useMoodStore';
import { useChatStore } from '../../../store/useChatStore';

export interface EventCardProps {
  message: Message;
  moodDescriptions: MoodDescription[];
  onEndActivity: (id: string) => void;
  onConvertMood: (moodId: string) => void;
  onMoodClick: (messageId: string) => void;
  onDelete: (id: string) => void;
}

export const EventCard: React.FC<EventCardProps> = ({
  message, moodDescriptions, onEndActivity, onConvertMood, onMoodClick, onDelete,
}) => {
  const { t } = useTranslation();
  const getMood           = useMoodStore(s => s.getMood);
  const activityMood      = useMoodStore(s => s.activityMood);
  const customMoodLabel   = useMoodStore(s => s.customMoodLabel);
  const customMoodApplied = useMoodStore(s => s.customMoodApplied);
  const { detachMoodFromEvent } = useChatStore();

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
  const moodKey   = normalizeMoodKey(rawLabel);
  const moodColor = getMoodColor(rawLabel) || '#10B981';

  const getTranslatedMood = (label?: string) => {
    if (!label) return t('chat_unknown_mood_label');
    const key = getMoodI18nKey(label);
    return key ? t(key) : label;
  };

  const mood      = getMood(message.id);
  const isOngoing = message.isActive && message.duration == null;
  const hasImage1 = !!message.imageUrl;
  const hasImage2 = !!message.imageUrl2;

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

  const handleImageUploaded = (slot: 'imageUrl' | 'imageUrl2', url: string) => {
    useChatStore.setState(state => ({
      messages: state.messages.map(m =>
        m.id === message.id ? { ...m, [slot]: url } : m,
      ),
    }));
  };

  const handleImageRemoved = (slot: 'imageUrl' | 'imageUrl2') => {
    useChatStore.setState(state => ({
      messages: state.messages.map(m =>
        m.id === message.id ? { ...m, [slot]: null } : m,
      ),
    }));
  };

  return (
    <div
      ref={cardRef}
      className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm relative"
      onClick={() => { if (!cardActive) setCardActive(true); }}
    >
      {/* Delete button — top-right, only when card is tapped */}
      {cardActive && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(message.id); }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-gray-400 hover:bg-red-400 rounded-full text-white flex items-center justify-center transition-colors z-10"
        >
          <X size={9} />
        </button>
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
        </div>

        {/* Mood chip (right) */}
        {mood ? (
          <button
            onClick={e => { e.stopPropagation(); onMoodClick(message.id); }}
            className={cn('shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] text-slate-700 active:opacity-80')}
            style={
              moodKey === 'anxious'
                ? { background: 'repeating-linear-gradient(45deg,#E5E7EB 0,#E5E7EB 1px,#9CA3AF 1px,#9CA3AF 2px,#6B7280 2px,#6B7280 3px)' }
                : { backgroundColor: moodColor }
            }
          >
            <span style={{ fontFamily: 'Songti SC, SimSun, STSong, serif' }}>
              {getTranslatedMood(rawLabel)}
            </span>
          </button>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); onMoodClick(message.id); }}
            className="shrink-0 w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            title={t('chat_unknown_mood_label')}
          />
        )}
      </div>

      {/* ── Images (up to 2, compact, side-by-side) ──────────── */}
      <div className="flex gap-1.5 mt-1.5">
        <div className="flex-1 min-w-0">
          <ImageUploader
            messageId={message.id}
            imageUrl={message.imageUrl}
            onUploaded={url => handleImageUploaded('imageUrl', url)}
            onRemoved={() => handleImageRemoved('imageUrl')}
            compact
          />
        </div>
        {/* Second slot: only appears after first image is uploaded */}
        {hasImage1 && (
          <div className="flex-1 min-w-0">
            <ImageUploader
              messageId={`${message.id}_2`}
              imageUrl={message.imageUrl2}
              onUploaded={url => handleImageUploaded('imageUrl2', url)}
              onRemoved={() => handleImageRemoved('imageUrl2')}
              compact
              hideUploadWhen={hasImage2}
            />
          </div>
        )}
      </div>

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
              <button
                onClick={e => { e.stopPropagation(); onEndActivity(message.id); }}
                title={t('end_event_btn')}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <StopCircle size={14} />
              </button>
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
