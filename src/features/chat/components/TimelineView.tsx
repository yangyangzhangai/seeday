// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, isToday } from 'date-fns';
import { EventCard } from './EventCard';
import { MoodCard } from './MoodCard';
import type { Message, MoodDescription } from '../../../store/useChatStore';
import { useChatStore } from '../../../store/useChatStore';
import { useMoodStore } from '../../../store/useMoodStore';
import { autoDetectMood } from '../../../lib/mood';
import type { StardustCardData } from '../../../types/stardust';
import imgTimelineLeaf from '../../../assets/timeline-leaf.png';

export interface TimelineViewProps {
  messages: Message[];
  selectedDate: Date;
  isLoading: boolean;
  onMoodClick: (messageId: string) => void;
  onStardustSelect?: (data: StardustCardData, position: { x: number; y: number }) => void;
  onTimeClick?: (message: Message) => void;
}

const PRIMARY = '#B2EEDA';
const TIMELINE_BOTTOM_PADDING = 'calc(env(safe-area-inset-bottom, 0px) + 270px)';

const SkeletonCard: React.FC = () => (
  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
    <div style={{ width: 44, flexShrink: 0 }} />
    <div style={{ width: 20, flexShrink: 0 }} />
    <div style={{ flex: 1, background: '#F0F4F2', borderRadius: '2rem', height: 64, animation: 'pulse 1.5s ease-in-out infinite' }} />
  </div>
);

export const TimelineView: React.FC<TimelineViewProps> = ({
  messages, selectedDate, isLoading, onMoodClick, onStardustSelect, onTimeClick,
}) => {
  const { t } = useTranslation();
  const { endActivity, reattachMoodToEvent, convertMoodToEvent, deleteActivity } = useChatStore();
  const getMood = useMoodStore(s => s.getMood);
  const setMood = useMoodStore(s => s.setMood);

  const { items, moodDescMap, latestRecordMessageId } = useMemo(() => {
    const eligible = messages
      .filter(m => m.mode === 'record' && m.type === 'text')
      .sort((a, b) => a.timestamp - b.timestamp);

    const moodDescMap = new Map<string, MoodDescription[]>();
    for (const m of eligible) {
      if (!m.isMood) {
        moodDescMap.set(m.id, m.moodDescriptions?.length ? [...m.moodDescriptions] : []);
      }
    }

    const items = eligible.filter(m => !m.isMood || m.detached === true);
    const latestRecordMessageId = eligible.length > 0 ? eligible[eligible.length - 1].id : null;
    return { items, moodDescMap, latestRecordMessageId };
  }, [messages]);

  useEffect(() => {
    for (const msg of items) {
      if (msg.mode !== 'record' || msg.isMood || msg.duration == null) continue;
      if (getMood(msg.id)) continue;
      setMood(msg.id, autoDetectMood(msg.content, msg.duration ?? 0), 'auto');
    }
  }, [items, getMood, setMood]);

  if (isLoading) {
    return (
      <div className="app-scroll-container" style={{ flex: 1, paddingLeft: 16, paddingRight: 16, paddingBottom: TIMELINE_BOTTOM_PADDING, paddingTop: 16 }}>
        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="app-scroll-container" style={{ flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80, opacity: 0.45 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 52, color: PRIMARY }}>event_note</span>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0, textAlign: 'center' }}>
          {t('new_day_start')}<br />
          <span style={{ fontSize: 11, opacity: 0.7 }}>{t('record_what_you_do')}</span>
        </p>
      </div>
    );
  }

  const timelineLineX = 60;

  return (
    <div className="app-scroll-container" style={{ flex: 1, paddingLeft: 16, paddingRight: 16, paddingBottom: TIMELINE_BOTTOM_PADDING, paddingTop: 16 }}>
      <div style={{ position: 'relative' }}>
        {/* Vertical timeline line */}
        <div style={{ position: 'absolute', left: timelineLineX, top: 12, bottom: 0, width: 1.5,
          background: 'repeating-linear-gradient(to bottom, rgba(178,214,128,0.84) 0px, rgba(178,214,128,0.46) 600px, rgba(178,214,128,0.84) 1200px)',
          boxShadow: '0 0 9px rgba(178,214,128,0.30), 0 0 16px rgba(206,228,172,0.20)' }} />

        {items.map((msg, index) => {
          const isMoodCard = msg.isMood && msg.detached;
          const allowReclassify = msg.id === latestRecordMessageId;
          const cardReadonly = !isToday(selectedDate);
          const timeLabel = format(msg.timestamp, 'HH:mm');
          const hasImages = Boolean(msg.imageUrl || msg.imageUrl2);
          const rowGap = hasImages ? 22 : 14;

          const leafSize = 18;
          const leafMirrored = index % 2 === 0;
          const stemRootX = leafSize * 0.18;
          const stemRootY = leafSize * 0.94;
          const nodeY = 14;
          const leafRotation = leafMirrored ? 8 : -8;
          const leafDropY = 2;

          return (
            <div key={msg.id} style={{ display: 'flex', gap: 10, marginBottom: rowGap, position: 'relative', zIndex: 1 }}>
              {/* Timeline leaf node */}
              <img
                src={imgTimelineLeaf}
                alt=""
                style={{
                  position: 'absolute',
                  left: timelineLineX - stemRootX,
                  top: nodeY - stemRootY + leafDropY,
                  width: leafSize,
                  height: leafSize,
                  transform: leafMirrored ? `scaleX(-1) rotate(${leafRotation}deg)` : `rotate(${leafRotation}deg)`,
                  transformOrigin: '18% 94%',
                  opacity: 0.96,
                  transition: 'all 0.3s',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              />

              {/* Time label */}
              <div style={{ width: 44, paddingTop: 8, textAlign: 'right', flexShrink: 0, position: 'relative', zIndex: 1 }}>
                <span
                  style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    cursor: (!cardReadonly && onTimeClick) ? 'pointer' : 'default' }}
                  onClick={() => { if (!cardReadonly && onTimeClick) onTimeClick(msg); }}
                >
                  {timeLabel}
                </span>
              </div>

              {/* Timeline column spacer */}
              <div style={{ width: 20, flexShrink: 0 }} />

              {/* Card */}
              <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
                {isMoodCard ? (
                  <MoodCard
                    message={msg}
                    onReturnToEvent={id => void reattachMoodToEvent(id)}
                    onConvertToEvent={id => void convertMoodToEvent(id)}
                    onDelete={id => void deleteActivity(id)}
                    onMoodClick={onMoodClick}
                    onStardustSelect={onStardustSelect}
                    readonly={cardReadonly}
                  />
                ) : (
                  <EventCard
                    message={msg}
                    moodDescriptions={moodDescMap.get(msg.id) || []}
                    onEndActivity={id => void endActivity(id)}
                    onConvertMood={() => {/* handled inside EventCard */}}
                    onMoodClick={onMoodClick}
                    onStardustSelect={onStardustSelect}
                    onDelete={id => void deleteActivity(id)}
                    allowConvertToMood={allowReclassify}
                    readonly={cardReadonly}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
