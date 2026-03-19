// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Zap, X } from 'lucide-react';
import type { Message } from '../../../store/useChatStore';

export interface MoodCardProps {
  message: Message; // isMood: true, detached: true
  onReturnToEvent: (id: string) => void;
  onConvertToEvent: (id: string) => void;
  onDelete: (id: string) => void;
  allowConvertToEvent: boolean;
}

export const MoodCard: React.FC<MoodCardProps> = ({
  message,
  onReturnToEvent,
  onConvertToEvent,
  onDelete,
  allowConvertToEvent,
}) => {
  const { t } = useTranslation();
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

  return (
    <div
      ref={cardRef}
      className="flex items-center justify-between bg-sky-50 border border-sky-100 px-3 py-2 rounded-xl relative"
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

      <div className="flex items-center gap-2 min-w-0">
        <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
        <span
          className="text-sm text-gray-800 truncate"
          style={{ fontFamily: 'Songti SC, SimSun, STSong, serif' }}
        >
          {message.content}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <button
          onClick={e => { e.stopPropagation(); onReturnToEvent(message.id); }}
          title={t('mood_return_event')}
          className="flex items-center text-sky-600 border border-sky-200 rounded-full p-1 hover:bg-sky-100 transition-colors"
        >
          <ArrowLeft size={12} />
        </button>
        {allowConvertToEvent && (
          <button
            onClick={e => { e.stopPropagation(); onConvertToEvent(message.id); }}
            title={t('mood_to_event')}
            className="flex items-center text-emerald-600 border border-emerald-200 rounded-full p-1 hover:bg-emerald-50 transition-colors"
          >
            <Zap size={12} />
          </button>
        )}
      </div>
    </div>
  );
};
