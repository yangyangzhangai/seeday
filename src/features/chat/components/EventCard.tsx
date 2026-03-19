// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, StopCircle } from 'lucide-react';
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
}

export const EventCard: React.FC<EventCardProps> = ({
  message, moodDescriptions, onEndActivity, onConvertMood, onMoodClick,
}) => {
  const { t } = useTranslation();
  const getMood       = useMoodStore(s => s.getMood);
  const activityMood  = useMoodStore(s => s.activityMood);
  const customMoodLabel   = useMoodStore(s => s.customMoodLabel);
  const customMoodApplied = useMoodStore(s => s.customMoodApplied);
  const { detachMoodFromEvent } = useChatStore();

  const rawLabel = (customMoodApplied[message.id] && customMoodLabel[message.id])
    ? customMoodLabel[message.id]
    : activityMood[message.id];
  const moodKey  = normalizeMoodKey(rawLabel);
  const moodColor = getMoodColor(rawLabel) || '#10B981';

  const getTranslatedMood = (label?: string) => {
    if (!label) return t('chat_unknown_mood_label');
    const key = getMoodI18nKey(label);
    return key ? t(key) : label;
  };

  const mood      = getMood(message.id);
  const isOngoing = message.isActive && message.duration == null;

  const handleImageUploaded = (url: string) => {
    useChatStore.setState(state => ({
      messages: state.messages.map(m =>
        m.id === message.id ? { ...m, imageUrl: url } : m,
      ),
    }));
  };

  const handleImageRemoved = () => {
    useChatStore.setState(state => ({
      messages: state.messages.map(m =>
        m.id === message.id ? { ...m, imageUrl: null } : m,
      ),
    }));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">

        {/* Left: colour dot + title */}
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div
            className="w-2 h-2 rounded-full mt-1 shrink-0"
            style={
              moodKey === 'anxious'
                ? { background: 'repeating-linear-gradient(45deg,#E5E7EB 0,#E5E7EB 1px,#9CA3AF 1px,#9CA3AF 2px)' }
                : { backgroundColor: moodColor }
            }
          />
          <span
            className="text-sm font-semibold text-gray-900 leading-snug"
            style={{ fontFamily: '"Source Han Serif SC","Noto Serif SC","Songti SC","SimSun","STSong",serif' }}
          >
            {message.content}
          </span>
        </div>

        {/* Right: mood chip (clickable) + duration / end button */}
        <div className="flex flex-col items-end shrink-0 gap-1">
          {/* Mood chip — opens picker on click */}
          {mood ? (
            <button
              onClick={() => onMoodClick(message.id)}
              className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] text-slate-700 active:opacity-80')}
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
            /* Placeholder so layout stays stable even with no mood */
            <button
              onClick={() => onMoodClick(message.id)}
              className="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              title={t('chat_unknown_mood_label')}
            />
          )}

          {/* Duration badge OR end-activity icon button */}
          {message.duration != null ? (
            <div className="text-[10px] text-sky-600 border border-sky-200 rounded-full px-2 py-0.5">
              {formatDuration(message.duration)}
            </div>
          ) : isOngoing ? (
            <button
              onClick={() => onEndActivity(message.id)}
              title={t('end_event_btn')}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <StopCircle size={16} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Mood descriptions (attached to this event) */}
      {moodDescriptions.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-gray-50 pt-1.5">
          {moodDescriptions.map(desc => (
            <div key={desc.id} className="flex items-center justify-between gap-2">
              <span
                className="text-xs text-gray-600 flex-1"
                style={{ fontFamily: 'Songti SC, SimSun, STSong, serif' }}
              >
                {desc.content}
              </span>
              <button
                onClick={() => {
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

      {/* Image upload */}
      <ImageUploader
        messageId={message.id}
        imageUrl={message.imageUrl}
        onUploaded={handleImageUploaded}
        onRemoved={handleImageRemoved}
      />
    </div>
  );
};
