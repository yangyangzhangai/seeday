import React from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Activity, Wand2 } from 'lucide-react';

interface ChatInputBarProps {
    input: string;
    isLoading: boolean;
    isReadOnly?: boolean;
    readOnlyMessage?: string;
    isMagicPenModeOn: boolean;
    onInputChange: (v: string) => void;
    onSend: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onToggleMagicPenMode: () => void;
    /** Validation error message — turns border red */
    inputError?: string | null;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
    input,
    isLoading,
    isReadOnly = false,
    readOnlyMessage,
    isMagicPenModeOn,
    onInputChange,
    onSend,
    onKeyDown,
    onToggleMagicPenMode,
    inputError,
}) => {
    const { t } = useTranslation();
    const disabled = isLoading || isReadOnly;
    const hasInput = input.trim().length > 0;

    return (
        <div className="bg-white border-t border-gray-200 p-3 pb-safe mt-auto shrink-0">
            {/* Error message */}
            {inputError && (
                <p className="text-xs text-red-500 mb-1.5 px-1">{inputError}</p>
            )}
            {isReadOnly && readOnlyMessage && !inputError && (
                <p className="text-xs text-gray-500 mb-1.5 px-1">{readOnlyMessage}</p>
            )}

            {/* Input row */}
            <div className={`flex items-center space-x-2 rounded-full px-4 py-2 bg-gray-100 transition-colors ${inputError ? 'ring-2 ring-red-400' : ''}`}>
                {/* Magic pen toggle */}
                <button
                    onClick={() => { if (!disabled) onToggleMagicPenMode(); }}
                    type="button"
                    disabled={disabled}
                    className={`p-2 rounded-full transition-colors duration-200 ${
                        isMagicPenModeOn
                            ? 'bg-blue-600 text-white'
                            : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                    className="flex-1 bg-transparent border-none focus:outline-none text-base"
                    disabled={disabled}
                />

                <button
                    onClick={onSend}
                    disabled={!hasInput || disabled}
                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
                >
                    {isLoading ? <Activity className="animate-spin" size={16} /> : <Send size={16} />}
                </button>
            </div>
        </div>
    );
};
