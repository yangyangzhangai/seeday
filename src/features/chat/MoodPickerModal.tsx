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
            className="relative w-full max-w-sm rounded-3xl border border-[#EBDCC2] bg-[#FFF9EE] p-5 shadow-[0_20px_60px_rgba(71,52,24,0.24)]"
            onClick={(e) => e.stopPropagation()}
        >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-3 top-3 rounded-full bg-white/80 p-1 text-gray-500"
                >
                    <X size={16} />
                </button>
                <h3
                    className="mb-3 flex items-center gap-1.5 pr-6 text-sm font-medium text-[#6D5434]"
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
                                     ? "border-[#CA8A4A] bg-[#FEE6BE] text-[#7A4D1E] ring-1 ring-[#F4D7A8]"
                                     : "border-[#E8DCC7] bg-white text-slate-700",
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
                                 ? "border-[#CA8A4A] bg-[#FEE6BE] text-[#7A4D1E] ring-1 ring-[#F4D7A8]"
                                 : "border-[#D6C1A0] bg-[#F8F0DF] text-[#7A5A2C]",
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
