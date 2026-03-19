import React from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Activity, Wand2 } from 'lucide-react';

interface ChatInputBarProps {
    input: string;
    isLoading: boolean;
    isMagicPenModeOn: boolean;
    onInputChange: (v: string) => void;
    onSend: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onToggleMagicPenMode: () => void;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
    input,
    isLoading,
    isMagicPenModeOn,
    onInputChange,
    onSend,
    onKeyDown,
    onToggleMagicPenMode,
}) => {
    const { t } = useTranslation();

    return (
        <div className="bg-white border-t border-gray-200 p-4 pb-safe mt-auto shrink-0">
            <div className="flex items-center space-x-2 rounded-full px-4 py-2 bg-gray-100 transition-all duration-300">
                <button
                    onClick={onToggleMagicPenMode}
                    type="button"
                    className={`p-2 rounded-full transition-colors duration-200 ${
                        isMagicPenModeOn
                            ? 'bg-blue-600 text-white'
                            : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                    }`}
                    aria-label={t(isMagicPenModeOn ? 'chat_magic_pen_mode_on' : 'chat_magic_pen_mode_off')}
                    title={t(isMagicPenModeOn ? 'chat_magic_pen_mode_on' : 'chat_magic_pen_mode_off')}
                >
                    <Wand2 size={16} />
                </button>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={t('chat_placeholder_neutral')}
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
