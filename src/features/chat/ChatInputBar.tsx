import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { Heart, Send, Activity } from 'lucide-react';

interface ChatInputBarProps {
    input: string;
    isMoodMode: boolean;
    isLoading: boolean;
    onInputChange: (v: string) => void;
    onSend: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onToggleMoodMode: () => void;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
    input,
    isMoodMode,
    isLoading,
    onInputChange,
    onSend,
    onKeyDown,
    onToggleMoodMode,
}) => {
    const { t } = useTranslation();

    return (
        <div className="bg-white border-t border-gray-200 p-4 pb-safe">
            <div className={cn(
                "flex items-center space-x-2 rounded-full px-4 py-2 transition-all duration-300",
                isMoodMode
                    ? "bg-pink-50 border border-pink-400"
                    : "bg-gray-100"
            )}>
                <button
                    onClick={onToggleMoodMode}
                    className={cn(
                        "transition-all duration-300",
                        isMoodMode
                            ? "text-pink-500 animate-pulse scale-110"
                            : "text-gray-400 hover:text-gray-600"
                    )}
                    title={isMoodMode ? t('chat_switch_to_activity') : t('chat_switch_to_mood')}
                >
                    <Heart size={18} fill={isMoodMode ? "currentColor" : "none"} />
                </button>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={isMoodMode ? t('chat_placeholder_mood') : t('chat_placeholder_activity')}
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm"
                    disabled={isLoading}
                />
                <button
                    onClick={onSend}
                    disabled={!input.trim() || isLoading}
                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
                >
                    {isLoading ? <Activity className="animate-spin" size={16} /> : <Send size={16} />}
                </button>
            </div>
        </div>
    );
};
