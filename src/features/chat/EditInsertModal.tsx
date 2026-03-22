import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save } from 'lucide-react';

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
    const { t } = useTranslation();
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
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6 space-y-4 shadow-xl">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">{editingId ? t('chat_edit_record') : t('chat_insert_record')}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('chat_label_content')}</label>
                        <input
                            type="text"
                            value={editContent}
                            onChange={(e) => onContentChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                            placeholder={t('chat_placeholder_content')}
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">{t('chat_label_start_time')}</label>
                            <input
                                type="datetime-local"
                                value={editStartTime}
                                max={maxDateTime}
                                step={60}
                                onClick={(e) => openNativePicker(e.currentTarget)}
                                onFocus={(e) => openNativePicker(e.currentTarget)}
                                onChange={(e) => onStartTimeChange(e.target.value)}
                                onBlur={(e) => handleBoundedDateTimeBlur(e.target.value, onStartTimeChange)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">{t('chat_label_end_time')}</label>
                            <input
                                type="datetime-local"
                                value={editEndTime}
                                max={maxDateTime}
                                step={60}
                                onClick={(e) => openNativePicker(e.currentTarget)}
                                onFocus={(e) => openNativePicker(e.currentTarget)}
                                onChange={(e) => onEndTimeChange(e.target.value)}
                                onBlur={(e) => handleBoundedDateTimeBlur(e.target.value, onEndTimeChange)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                            />
                        </div>
                    </div>
                </div>
                <button
                    onClick={onSave}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                >
                    <Save size={16} />
                    <span>{t('save')}</span>
                </button>
            </div>
        </div>
    );
};
