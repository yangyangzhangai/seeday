import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useGrowthStore } from '../../store/useGrowthStore';
import { type GrowthPriority, type Recurrence } from '../../store/useTodoStore';
import { cn } from '../../lib/utils';

interface DefaultValues {
  title?: string;
  bottleId?: string;
  recurrence?: Recurrence;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (input: {
    title: string;
    priority: GrowthPriority;
    bottleId?: string;
    dueAt?: number;
    recurrence?: Recurrence;
    recurrenceDays?: number[];
  }) => void;
  defaultValues?: DefaultValues;
}

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export const AddGrowthTodoModal = ({ isOpen, onClose, onAdd, defaultValues }: Props) => {
  const { t } = useTranslation();
  const bottles = useGrowthStore((s) => s.bottles.filter((b) => b.status === 'active'));
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<GrowthPriority>('medium');
  const [bottleId, setBottleId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('once');
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [titleError, setTitleError] = useState(false);

  // Apply defaults when modal opens
  useEffect(() => {
    if (isOpen && defaultValues) {
      if (defaultValues.title) setTitle(defaultValues.title);
      if (defaultValues.bottleId) setBottleId(defaultValues.bottleId);
      if (defaultValues.recurrence) setRecurrence(defaultValues.recurrence);
    }
  }, [isOpen, defaultValues]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!title.trim()) {
      setTitleError(true);
      return;
    }
    onAdd({
      title: title.trim(),
      priority,
      bottleId: bottleId || undefined,
      dueAt: dueAt ? new Date(dueAt).getTime() : undefined,
      recurrence,
      recurrenceDays: recurrence === 'weekly' ? recurrenceDays : undefined,
    });
    // Reset form
    setTitle('');
    setPriority('medium');
    setBottleId('');
    setDueAt('');
    setRecurrence('once');
    setRecurrenceDays([]);
    setTitleError(false);
    onClose();
  };

  const toggleDay = (day: number) => {
    setRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const priorities: GrowthPriority[] = ['high', 'medium', 'low'];
  const priorityColors: Record<GrowthPriority, string> = {
    high: 'border-red-500 bg-red-50 text-red-600',
    medium: 'border-orange-500 bg-orange-50 text-orange-600',
    low: 'border-green-500 bg-green-50 text-green-600',
  };

  const recurrences: Recurrence[] = ['once', 'daily', 'weekly'];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 pb-safe animate-slide-up max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">{t('growth_todo_add')}</h3>
          <button onClick={onClose} className="text-gray-400"><X size={20} /></button>
        </div>

        {/* Title */}
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setTitleError(false); }}
          placeholder={t('growth_todo_title_placeholder')}
          className={cn(
            "w-full border rounded-xl p-3 text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-blue-400",
            titleError ? "border-red-400" : "border-gray-200"
          )}
        />
        {titleError && (
          <p className="text-xs text-red-500 mb-3">{t('growth_todo_title_required')}</p>
        )}

        {/* Priority */}
        <label className="block text-sm font-medium text-gray-700 mt-3 mb-2">
          {t('growth_todo_priority')}
        </label>
        <div className="flex gap-2 mb-4">
          {priorities.map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={cn(
                "flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all",
                priority === p ? priorityColors[p] : "border-gray-200 text-gray-500"
              )}
            >
              {t(`growth_todo_priority_${p}`)}
            </button>
          ))}
        </div>

        {/* Due date */}
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('growth_todo_due_datetime')}
        </label>
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        {/* Recurrence */}
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('growth_todo_recurrence')}
        </label>
        <div className="flex gap-2 mb-4">
          {recurrences.map((r) => (
            <button
              key={r}
              onClick={() => setRecurrence(r)}
              className={cn(
                "flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all",
                recurrence === r
                  ? "border-blue-500 bg-blue-50 text-blue-600"
                  : "border-gray-200 text-gray-500"
              )}
            >
              {t(`growth_todo_recurrence_${r}`)}
            </button>
          ))}
        </div>

        {/* Weekly day picker */}
        {recurrence === 'weekly' && (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('growth_todo_weekly_days')}
            </label>
            <div className="flex gap-1 mb-4">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "w-9 h-9 rounded-full text-xs font-medium transition-all",
                    recurrenceDays.includes(i)
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-500"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Link bottle */}
        {bottles.length > 0 && (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('growth_todo_link_bottle')}
            </label>
            <select
              value={bottleId}
              onChange={(e) => setBottleId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">{t('growth_todo_none')}</option>
              {bottles.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </>
        )}

        <button
          onClick={handleSubmit}
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          {t('confirm')}
        </button>
      </div>
    </div>
  );
};
