import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Activity, Wand2, ImagePlus, X } from 'lucide-react';

interface ChatInputBarProps {
    input: string;
    isLoading: boolean;
    isMagicPenModeOn: boolean;
    onInputChange: (v: string) => void;
    onSend: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onToggleMagicPenMode: () => void;
    /** Called when the user picks a photo — parent handles cropping */
    onPhotoFileSelected?: (file: File) => void;
    /** Preview URLs of staged images (shown above input) */
    pendingImagePreviews?: string[];
    /** Remove a staged image by index */
    onRemovePendingImage?: (idx: number) => void;
    /** Validation error message — turns border red */
    inputError?: string | null;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
    input,
    isLoading,
    isMagicPenModeOn,
    onInputChange,
    onSend,
    onKeyDown,
    onToggleMagicPenMode,
    onPhotoFileSelected,
    pendingImagePreviews = [],
    onRemovePendingImage,
    inputError,
}) => {
    const { t } = useTranslation();
    const photoInputRef = useRef<HTMLInputElement>(null);
    const hasPending = pendingImagePreviews.length > 0;
    const canAddMore = pendingImagePreviews.length < 2;

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        onPhotoFileSelected?.(file);
    };

    return (
        <div className="bg-white border-t border-gray-200 p-3 pb-safe mt-auto shrink-0">
            {/* Hidden file input */}
            <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
            />

            {/* Staged image thumbnails */}
            {hasPending && (
                <div className="flex gap-2 mb-2 px-1">
                    {pendingImagePreviews.map((src, i) => (
                        <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                            <img src={src} alt="" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => onRemovePendingImage?.(i)}
                                className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white"
                            >
                                <X size={10} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Error message */}
            {inputError && (
                <p className="text-xs text-red-500 mb-1.5 px-1">{inputError}</p>
            )}

            {/* Input row */}
            <div className={`flex items-center space-x-2 rounded-full px-4 py-2 bg-gray-100 transition-colors ${inputError ? 'ring-2 ring-red-400' : ''}`}>
                {/* Magic pen toggle */}
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

                {/* Photo upload — hidden when 2 images already staged */}
                {canAddMore && (
                    <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors duration-200 shrink-0"
                        title={t('image_upload')}
                    >
                        <ImagePlus size={16} />
                    </button>
                )}

                <input
                    type="text"
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={t('chat_placeholder_neutral')}
                    className="flex-1 bg-transparent border-none focus:outline-none text-base"
                />

                <button
                    onClick={onSend}
                    disabled={!input.trim() && !hasPending}
                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
                >
                    {isLoading ? <Activity className="animate-spin" size={16} /> : <Send size={16} />}
                </button>
            </div>
        </div>
    );
};
