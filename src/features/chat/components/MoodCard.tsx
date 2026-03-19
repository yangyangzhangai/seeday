// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Zap } from 'lucide-react';
import type { Message } from '../../../store/useChatStore';

export interface MoodCardProps {
  message: Message; // isMood: true, detached: true
  onReturnToEvent: (id: string) => void;
  onConvertToEvent: (id: string) => void;
}

export const MoodCard: React.FC<MoodCardProps> = ({
  message,
  onReturnToEvent,
  onConvertToEvent,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between bg-sky-50 border border-sky-100 px-3 py-2 rounded-xl">
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
          onClick={() => onReturnToEvent(message.id)}
          title={t('mood_return_event')}
          className="flex items-center text-sky-600 border border-sky-200 rounded-full p-1 hover:bg-sky-100 transition-colors"
        >
          <ArrowLeft size={12} />
        </button>
        <button
          onClick={() => onConvertToEvent(message.id)}
          title={t('mood_to_event')}
          className="flex items-center text-emerald-600 border border-emerald-200 rounded-full p-1 hover:bg-emerald-50 transition-colors"
        >
          <Zap size={12} />
        </button>
      </div>
    </div>
  );
};
