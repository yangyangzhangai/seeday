import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Activity, Wand2, ImagePlus } from 'lucide-react';

interface ChatInputBarProps {
    input: string;
    isLoading: boolean;
    isMagicPenModeOn: boolean;
    onInputChange: (v: string) => void;
    onSend: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onToggleMagicPenMode: () => void;
    /** Called when the user picks a photo from the ➕ button */
    onPhotoSelect?: (file: File) => void;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
    input,
    isLoading,
    isMagicPenModeOn,
    onInputChange,
    onSend,
    onKeyDown,
    onToggleMagicPenMode,
    onPhotoSelect,
}) => {
    const { t } = useTranslation();
    const photoInputRef = useRef<HTMLInputElement>(null);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        onPhotoSelect?.(file);
    };

    return (
        <div className="bg-white border-t border-gray-200 p-4 pb-safe mt-auto shrink-0">
            {/* Hidden file input for photo upload */}
            <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
            />
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
                {/* Photo upload button */}
                <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors duration-200"
                    title={t('image_upload')}
                >
                    <ImagePlus size={16} />
                </button>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={t('chat_placeholder_neutral')}
                    className="flex-1 bg-transparent border-none focus:outline-none text-base"
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
