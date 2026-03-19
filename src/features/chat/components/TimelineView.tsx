// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { EventCard } from './EventCard';
import { MoodCard } from './MoodCard';
import type { Message, MoodDescription } from '../../../store/useChatStore';
import { useChatStore } from '../../../store/useChatStore';
import { cn } from '../../../lib/utils';

export interface TimelineViewProps {
  messages: Message[];
  selectedDate: Date;
  isLoading: boolean;
  onMoodClick: (messageId: string) => void;
}

/** Animated growing line shown below the dot of an ongoing (not-yet-ended) event */
const OngoingGrowthLine: React.FC<{ startTimestamp: number }> = ({ startTimestamp }) => {
  const [height, setHeight] = useState(() =>
    Math.min(Math.floor((Date.now() - startTimestamp) / 60000) * 5, 100),
  );

  useEffect(() => {
    const update = () =>
      setHeight(Math.min(Math.floor((Date.now() - startTimestamp) / 60000) * 5, 100));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [startTimestamp]);

  return (
    <div className="flex flex-col items-center mt-0.5">
      {/* Solid growing line */}
      <div
        className="w-0.5 bg-gradient-to-b from-blue-400 to-blue-200 transition-[height] duration-[800ms] ease-linear"
        style={{ height: `${Math.max(height, 8)}px` }}
      />
      {/* Pulsing tip dot — indicates "still going" */}
      <div className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse mt-0.5" />
    </div>
  );
};

const SkeletonCard: React.FC = () => (
  <div className="flex items-stretch animate-pulse">
    <div className="w-10 shrink-0" />
    <div className="w-5 shrink-0 flex flex-col items-center">
      <div className="w-0.5 h-2 bg-gray-200" />
      <div className="w-2.5 h-2.5 rounded-full bg-gray-200 shrink-0" />
    </div>
    <div className="flex-1 bg-gray-100 rounded-xl h-16 ml-2 mb-5" />
  </div>
);

export const TimelineView: React.FC<TimelineViewProps> = ({
  messages, selectedDate, isLoading, onMoodClick,
}) => {
  const { t } = useTranslation();
  const { endActivity, reattachMoodToEvent, convertMoodToEvent, deleteActivity } = useChatStore();

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

  if (isLoading) {
    return (
      <div className="flex flex-col px-3 py-4">
        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
        <div className="text-4xl mb-3">✨</div>
        <p className="text-sm font-medium">{t('new_day_start')}</p>
        <p className="text-xs mt-1 text-gray-300">{t('record_what_you_do')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-3 py-4">
        {items.map((msg, idx) => {
          const isFirst = idx === 0;
          const isLast  = idx === items.length - 1;
          const timeLabel = format(msg.timestamp, 'HH:mm');
          const isMoodCard = msg.isMood && msg.detached;
          const allowReclassify = msg.id === latestRecordMessageId;

          return (
            /* items-stretch makes all children equal height so the bottom
               connector fills to the row's bottom, creating a gapless line */
            <div key={msg.id} className="flex items-stretch">

              {/* ── Time label (left of line) ──────────────── */}
              <div className="w-10 shrink-0 flex flex-col items-end pr-2 pt-1">
                <span className="text-[11px] font-medium text-gray-400 leading-none tabular-nums">
                  {timeLabel}
                </span>
              </div>

              {/* ── Dot + continuous vertical line ─────────── */}
              <div className="w-5 shrink-0 flex flex-col items-center">
                {/* Top connector: connects to previous item's bottom connector */}
                <div className={cn(
                  'w-0.5 shrink-0',
                  isFirst ? 'h-1 bg-transparent' : 'h-2 bg-gray-300',
                )} />
                {/* Dot */}
                <div className={cn(
                  'w-2.5 h-2.5 rounded-full shrink-0 border-2 border-white shadow-sm',
                  isMoodCard ? 'bg-sky-400' : 'bg-blue-500',
                )} />
                {/* Bottom connector: flex-1 fills to row bottom = seamless line */}
                {!isLast && <div className="w-0.5 bg-gray-300 flex-1" />}
                {/* Growing animated line for the last ongoing event */}
                {isLast && !isMoodCard && msg.isActive && msg.duration == null && (
                  <OngoingGrowthLine startTimestamp={msg.timestamp} />
                )}
              </div>

              {/* ── Card ───────────────────────────────────── */}
              <div className={cn('flex-1 min-w-0 pl-2 pt-0.5', isLast ? 'pb-2' : 'pb-5')}>
                {isMoodCard ? (
                  <MoodCard
                    message={msg}
                    onReturnToEvent={id => reattachMoodToEvent(id)}
                    onConvertToEvent={id => void convertMoodToEvent(id)}
                    onDelete={id => void deleteActivity(id)}
                    allowConvertToEvent={allowReclassify}
                  />
                ) : (
                  <EventCard
                    message={msg}
                    moodDescriptions={moodDescMap.get(msg.id) || []}
                    onEndActivity={id => void endActivity(id)}
                    onConvertMood={() => {/* handled inside EventCard */}}
                    onMoodClick={onMoodClick}
                    onDelete={id => void deleteActivity(id)}
                    allowConvertToMood={allowReclassify}
                  />
                )}
              </div>

            </div>
          );
        })}
        <div className="h-2" />
      </div>
    </div>
  );
};
