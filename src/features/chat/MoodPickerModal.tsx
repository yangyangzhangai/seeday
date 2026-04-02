import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { X, Umbrella } from 'lucide-react';
import { allMoodOptions } from '../../lib/mood';
import { getMoodDisplayLabel } from '../../lib/moodOptions';
import {
    APP_MODAL_CARD_CLASS,
    APP_MODAL_CLOSE_CLASS,
    APP_MODAL_OVERLAY_CLASS,
    APP_SELECTED_GLOW_BG,
    APP_SELECTED_GLOW_BORDER,
    APP_SELECTED_GLOW_SHADOW,
} from '../../lib/modalTheme';
import type { MoodOption } from '../../store/useMoodStore';

interface MoodPickerModalProps {
    moodPickerFor: string;
    moodPickerReadonly: boolean;
    selectedMoodOpt: string | null;
    customLabelInput: string;
    showCustomLabelInput: boolean;
    customMoodLabel: Record<string, string | undefined>;
    customMoodApplied: Record<string, boolean>;
    onClose: () => void;
    onSelectMood: (msgId: string, opt: MoodOption) => void;
    onCustomLabelClick: () => void;
    onCustomLabelChange: (value: string) => void;
    onCustomLabelSave: (value: string) => void;
}

export const MoodPickerModal: React.FC<MoodPickerModalProps> = ({
    moodPickerFor,
    moodPickerReadonly,
    selectedMoodOpt,
    customLabelInput,
    showCustomLabelInput,
    customMoodLabel,
    customMoodApplied,
    onClose,
    onSelectMood,
    onCustomLabelClick,
    onCustomLabelChange,
    onCustomLabelSave,
}) => {
    const { t } = useTranslation();
    const customLabelDefault = t('chat_custom_label_default');
    const selectedGlowStyle = {
        background: APP_SELECTED_GLOW_BG,
        border: APP_SELECTED_GLOW_BORDER,
        boxShadow: APP_SELECTED_GLOW_SHADOW,
    };

    return (
        <div
            className={cn('fixed inset-0 flex items-center justify-center z-40 p-4', APP_MODAL_OVERLAY_CLASS)}
            onClick={onClose}
        >
        <div
            className={cn(APP_MODAL_CARD_CLASS, 'relative w-full max-w-sm rounded-3xl p-5')}
            onClick={(e) => e.stopPropagation()}
        >
                <button
                    type="button"
                    onClick={onClose}
                    className={cn(APP_MODAL_CLOSE_CLASS, 'absolute right-3 top-3 p-1')}
                >
                    <X size={16} />
                </button>
                <h3
                    className="mb-3 flex items-center gap-1.5 pr-6 text-sm font-medium text-slate-700"
                    style={{ fontFamily: 'PingFang SC, -apple-system, system-ui, sans-serif' }}
                >
                    <span>{t('chat_pick_mood_for_record')}</span>
                    <span className="inline-flex items-center justify-center p-[3px] text-sky-400">
                        <Umbrella size={12} className="stroke-[1.8] text-sky-400" />
                    </span>
                </h3>
                <div className="flex flex-wrap gap-2">
                    {allMoodOptions().map(opt => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => {
                                if (moodPickerReadonly) return;
                                onSelectMood(moodPickerFor, opt);
                            }}
                            className={cn(
                                'inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs shadow-sm transition-colors',
                                 selectedMoodOpt === opt
                                     ? 'text-[#1D4ED8]'
                                     : 'border-white/80 bg-white/85 text-[#2F3E33]',
                                moodPickerReadonly && 'cursor-not-allowed opacity-60 hover:bg-white'
                            )}
                            style={{
                                fontFamily: 'Songti SC, SimSun, STSong, serif',
                                ...(selectedMoodOpt === opt ? selectedGlowStyle : {}),
                            }}
                            disabled={moodPickerReadonly}
                        >
                            {getMoodDisplayLabel(opt, t)}
                        </button>
                    ))}
                    {/* Custom label button */}
                    <button
                        type="button"
                        onClick={() => {
                            if (moodPickerReadonly) return;
                            onCustomLabelClick();
                        }}
                        className={cn(
                            'inline-flex items-center justify-center rounded-full border px-2.5 py-[3px] text-[10px] shadow-sm transition-colors',
                             (showCustomLabelInput || customMoodApplied[moodPickerFor])
                                 ? 'text-[#1D4ED8]'
                                 : 'border-white/80 bg-white/85 text-[#2F3E33]',
                            moodPickerReadonly && 'cursor-not-allowed opacity-60'
                        )}
                        style={{
                            fontFamily: 'Songti SC, SimSun, STSong, serif',
                            ...((showCustomLabelInput || customMoodApplied[moodPickerFor]) ? selectedGlowStyle : {}),
                        }}
                        disabled={moodPickerReadonly}
                    >
                        {!moodPickerReadonly && showCustomLabelInput ? (
                            <input
                                type="text"
                                value={customLabelInput}
                                onChange={(e) => onCustomLabelChange(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        onCustomLabelSave(customLabelInput);
                                    }
                                }}
                                onBlur={() => onCustomLabelSave(customLabelInput)}
                                className="w-16 bg-transparent text-[10px] text-[#1D4ED8] focus:outline-none"
                                autoFocus
                            />
                        ) : (
                            customMoodLabel[moodPickerFor] || customLabelDefault
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
