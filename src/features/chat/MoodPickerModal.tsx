import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { X, Umbrella } from 'lucide-react';
import { allMoodOptions } from '../../lib/mood';
import { getMoodDisplayLabel } from '../../lib/moodOptions';
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

    return (
        <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4"
            onClick={onClose}
        >
            <div
                className="bg-pink-50 w-full max-w-xs rounded-xl p-4 shadow-lg relative border border-pink-100"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                    <X size={16} />
                </button>
                <h3
                    className="text-sm font-light text-gray-500 mb-3 pr-6 flex items-center gap-1.5"
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
                                "inline-flex items-center justify-center px-3 py-1.5 text-xs rounded-full border shadow-sm transition-colors",
                                selectedMoodOpt === opt
                                    ? "bg-rose-100 text-rose-700 border-rose-300 ring-1 ring-rose-200"
                                    : "bg-white text-slate-700 border-gray-200 hover:bg-gray-50",
                                moodPickerReadonly && "opacity-60 cursor-not-allowed hover:bg-white"
                            )}
                            style={{ fontFamily: 'Songti SC, SimSun, STSong, serif' }}
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
                            "inline-flex items-center justify-center px-2.5 py-[3px] text-[10px] rounded-full border shadow-sm transition-colors",
                            (showCustomLabelInput || customMoodApplied[moodPickerFor])
                                ? "bg-rose-100 text-rose-700 border-rose-300 ring-1 ring-rose-200"
                                : "bg-sky-50 text-sky-600 border-sky-200",
                            moodPickerReadonly && "opacity-60 cursor-not-allowed"
                        )}
                        style={{ fontFamily: 'Songti SC, SimSun, STSong, serif' }}
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
                                className="w-16 bg-transparent text-[10px] text-rose-700 focus:outline-none"
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
