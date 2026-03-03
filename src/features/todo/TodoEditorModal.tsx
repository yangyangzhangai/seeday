import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { Priority, Recurrence } from '../../store/useTodoStore';

interface TodoEditorModalProps {
  isOpen: boolean;
  editingId: string | null;
  content: string;
  priority: Priority;
  recurrence: Recurrence;
  category: string;
  customCategory: string;
  categories: string[];
  onContentChange: (value: string) => void;
  onPriorityChange: (value: Priority) => void;
  onRecurrenceChange: (value: Recurrence) => void;
  onCategoryChange: (value: string) => void;
  onCustomCategoryChange: (value: string) => void;
  onClose: () => void;
  onDelete: () => void;
  onSubmit: (e: FormEvent) => void;
  getCategoryLabel: (category: string) => string;
}

export function TodoEditorModal({
  isOpen,
  editingId,
  content,
  priority,
  recurrence,
  category,
  customCategory,
  categories,
  onContentChange,
  onPriorityChange,
  onRecurrenceChange,
  onCategoryChange,
  onCustomCategoryChange,
  onClose,
  onDelete,
  onSubmit,
  getCategoryLabel,
}: TodoEditorModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom-10 fade-in">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">{editingId ? t('todo_edit') : t('todo_add')}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('todo_label_content')}</label>
            <input
              type="text"
              required
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={t('todo_placeholder_content')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('todo_label_priority')}</label>
            <select
              value={priority}
              onChange={(e) => onPriorityChange(e.target.value as Priority)}
              className="w-full p-2 border border-gray-300 rounded-lg outline-none bg-white"
            >
              <option value="urgent-important">{t('priority_urgent_important')}</option>
              <option value="important-not-urgent">{t('priority_important_not_urgent')}</option>
              <option value="urgent-not-important">{t('priority_urgent_not_important')}</option>
              <option value="not-important-not-urgent">{t('priority_not_important_not_urgent')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('todo_label_recurrence')}</label>
            <select
              value={recurrence}
              onChange={(e) => onRecurrenceChange(e.target.value as Recurrence)}
              className="w-full p-2 border border-gray-300 rounded-lg outline-none bg-white"
            >
              <option value="none">{t('recurrence_none')}</option>
              <option value="daily">{t('recurrence_daily')}</option>
              <option value="weekly">{t('recurrence_weekly')}</option>
              <option value="monthly">{t('recurrence_monthly')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('todo_label_category')}</label>
            <div className="flex space-x-2">
              <select
                value={category}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="flex-1 p-2 border border-gray-300 rounded-lg outline-none bg-white"
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {getCategoryLabel(item)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={customCategory}
                onChange={(e) => onCustomCategoryChange(e.target.value)}
                placeholder={t('todo_placeholder_custom_category')}
                className="flex-1 p-2 border border-gray-300 rounded-lg outline-none"
              />
            </div>
          </div>

          <div className="flex space-x-3 pt-2">
            {editingId ? (
              <button
                type="button"
                onClick={onDelete}
                className="flex-1 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 border border-red-200"
              >
                {t('todo_delete_confirm')}
              </button>
            ) : (
              <div className="flex-1" />
            )}
            <button type="submit" className="flex-1 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              {t('confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
