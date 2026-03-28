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
        <div
            className="mt-auto shrink-0 px-4 pb-safe"
            style={{
                background: 'linear-gradient(to top, rgba(252,250,247,0.98) 60%, rgba(252,250,247,0))',
                paddingTop: 20,
                paddingBottom: 16,
            }}
        >
            {/* Error / readonly hint */}
            {inputError && (
                <p className="text-xs text-red-500 mb-1.5 px-1">{inputError}</p>
            )}
            {isReadOnly && readOnlyMessage && !inputError && (
                <p className="text-xs text-gray-400 mb-1.5 px-1">{readOnlyMessage}</p>
            )}

            {/* Input row */}
            <div
                className={`flex items-center gap-2.5 rounded-full ${inputError ? 'ring-2 ring-red-400' : ''}`}
                style={{
                    background: '#ffffff',
                    border: '1px solid rgba(0,0,0,0.05)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
                    padding: '7px 7px 7px 14px',
                }}
            >
                {/* Magic pen toggle */}
                <button
                    onClick={() => { if (!disabled) onToggleMagicPenMode(); }}
                    type="button"
                    disabled={disabled}
                    className="rounded-full flex items-center justify-center shrink-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                        width: 34, height: 34,
                        background: isMagicPenModeOn
                            ? 'linear-gradient(135deg, rgba(219,234,254,0.95) 0%, rgba(147,197,253,0.72) 100%)'
                            : 'rgba(178,238,218,0.18)',
                        boxShadow: isMagicPenModeOn ? '0 8px 18px rgba(59,130,246,0.20)' : 'none',
                    }}
                    aria-label={t(isMagicPenModeOn ? 'chat_magic_pen_mode_on' : 'chat_magic_pen_mode_off')}
                    title={t(isMagicPenModeOn ? 'chat_magic_pen_mode_on' : 'chat_magic_pen_mode_off')}
                >
                    <Wand2 size={15} color={isMagicPenModeOn ? '#2563EB' : '#94A3B8'} />
                </button>

                <input
                    type="text"
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={t('chat_placeholder_neutral')}
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm"
                    style={{ color: '#0f172a', fontFamily: "'Inter', sans-serif" }}
                    disabled={disabled}
                />

                <button
                    onClick={onSend}
                    disabled={!hasInput || disabled}
                    className="rounded-full flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    style={{
                        width: 34, height: 34,
                        background: 'rgba(144, 212, 122, 0.22)',
                        boxShadow: '0px 2px 4px rgba(200,200,200,0.6)',
                        color: '#5F7A63',
                        border: 'none',
                    }}
                >
                    {isLoading ? <Activity className="animate-spin" size={15} /> : <Send size={15} />}
                </button>
            </div>
        </div>
    );
};
