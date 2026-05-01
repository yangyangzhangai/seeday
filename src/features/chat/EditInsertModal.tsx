import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save } from 'lucide-react';
import { cn } from '../../lib/utils';
import { normalizeUiLanguage } from '../../store/authLanguageHelpers';
import {
    APP_MODAL_CARD_CLASS,
    APP_MODAL_CLOSE_CLASS,
    APP_MODAL_INPUT_CLASS,
    APP_MODAL_OVERLAY_CLASS,
    APP_MODAL_PRIMARY_BUTTON_CLASS,
} from '../../lib/modalTheme';

interface EditInsertModalProps {
    editingId: string | null;
    insertingAfterId: string | null;
    editContent: string;
    editStartTime: string;
    editEndTime: string;
    maxDateTime: string;
    onContentChange: (v: string) => void;
    onStartTimeChange: (v: string) => void;
    onEndTimeChange: (v: string) => void;
    onSave: () => void;
    onClose: () => void;
}

export const EditInsertModal: React.FC<EditInsertModalProps> = ({
    editingId,
    editContent,
    editStartTime,
    editEndTime,
    maxDateTime,
    onContentChange,
    onStartTimeChange,
    onEndTimeChange,
    onSave,
    onClose,
}) => {
    const { t, i18n } = useTranslation();
    const language = normalizeUiLanguage(i18n.language);
    const dateTimeLocale = language === 'zh' ? 'zh-CN' : language === 'it' ? 'it-IT' : 'en-US';
    const clampToMaxDateTime = (next: string): string => {
        if (!next) return next;
        const nextMs = new Date(next).getTime();
        const maxMs = new Date(maxDateTime).getTime();
        if (!Number.isFinite(nextMs) || !Number.isFinite(maxMs)) return next;
        return nextMs > maxMs ? maxDateTime : next;
    };
    const handleBoundedDateTimeBlur = (next: string, onChange: (v: string) => void) => {
        const clamped = clampToMaxDateTime(next);
        if (clamped !== next) onChange(clamped);
    };
    const openNativePicker = (target: HTMLInputElement) => {
        const pickerTarget = target as HTMLInputElement & { showPicker?: () => void };
        pickerTarget.showPicker?.();
    };

    return (
        <div className={cn('fixed inset-0 flex items-end sm:items-center justify-center z-50 sm:p-4', APP_MODAL_OVERLAY_CLASS)}>
            <div className={cn(APP_MODAL_CARD_CLASS, 'mb-[max(8px,env(safe-area-inset-bottom,0px))] rounded-3xl w-full max-w-sm p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:mb-0 sm:pb-6 space-y-4')}>
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">{editingId ? t('chat_edit_record') : t('chat_insert_record')}</h3>
                    <button onClick={onClose} className={cn(APP_MODAL_CLOSE_CLASS, 'p-1')}>
                        <X size={20} />
                    </button>
                </div>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('chat_label_content')}</label>
                        <input
                            type="text"
                            value={editContent}
                            onChange={(e) => onContentChange(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSave(); } }}
                            enterKeyHint="done"
                            className={cn(APP_MODAL_INPUT_CLASS, 'w-full px-3 py-2 text-base')}
                            placeholder={t('chat_placeholder_content')}
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('chat_label_start_time')}</label>
                            <input
                                type="datetime-local"
                                lang={dateTimeLocale}
                                value={editStartTime}
                                max={maxDateTime}
                                step={60}
                                onClick={(e) => openNativePicker(e.currentTarget)}
                                onFocus={(e) => openNativePicker(e.currentTarget)}
                                onChange={(e) => onStartTimeChange(e.target.value)}
                                onBlur={(e) => handleBoundedDateTimeBlur(e.target.value, onStartTimeChange)}
                                className={cn(APP_MODAL_INPUT_CLASS, 'w-full px-3 py-2 text-base')}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('chat_label_end_time')}</label>
                            <input
                                type="datetime-local"
                                lang={dateTimeLocale}
                                value={editEndTime}
                                max={maxDateTime}
                                step={60}
                                onClick={(e) => openNativePicker(e.currentTarget)}
                                onFocus={(e) => openNativePicker(e.currentTarget)}
                                onChange={(e) => onEndTimeChange(e.target.value)}
                                onBlur={(e) => handleBoundedDateTimeBlur(e.target.value, onEndTimeChange)}
                                className={cn(APP_MODAL_INPUT_CLASS, 'w-full px-3 py-2 text-base')}
                            />
                        </div>
                    </div>
                </div>
                <button
                    onClick={onSave}
                    className={cn(APP_MODAL_PRIMARY_BUTTON_CLASS, 'w-full py-2 font-medium flex items-center justify-center space-x-2')}
                >
                    <Save size={16} />
                    <span>{t('save')}</span>
                </button>
            </div>
        </div>
    );
};
