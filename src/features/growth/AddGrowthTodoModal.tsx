import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useGrowthStore } from '../../store/useGrowthStore';
import { type GrowthPriority, type Recurrence } from '../../store/useTodoStore';
import { cn } from '../../lib/utils';
import {
  APP_MODAL_CARD_CLASS,
  APP_MODAL_CLOSE_CLASS,
  APP_MODAL_INPUT_CLASS,
  APP_MODAL_OVERLAY_CLASS,
  APP_MODAL_PRIMARY_BUTTON_CLASS,
  APP_SELECTED_GLOW_BG,
  APP_SELECTED_GLOW_BORDER,
  APP_SELECTED_GLOW_SHADOW,
} from '../../lib/modalTheme';
import { triggerLightHaptic } from '../../lib/haptics';

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
  const selectedGlowStyle = {
    background: APP_SELECTED_GLOW_BG,
    border: APP_SELECTED_GLOW_BORDER,
    boxShadow: APP_SELECTED_GLOW_SHADOW,
  };

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
  const recurrences: Recurrence[] = ['once', 'daily', 'weekly'];

  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center p-4', APP_MODAL_OVERLAY_CLASS)}>
      <div className={cn(APP_MODAL_CARD_CLASS, 'animate-in zoom-in-95 fade-in w-[min(92vw,420px)] max-h-[86vh] overflow-hidden rounded-3xl')}>
        <div className="flex max-h-[86vh] flex-col">
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <h3 className="text-lg font-bold text-slate-800">{t('growth_todo_add')}</h3>
            <button onClick={onClose} className={cn(APP_MODAL_CLOSE_CLASS, 'p-1')}><X size={20} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-3 [overscroll-behavior:contain] [-webkit-overflow-scrolling:touch]">
            {/* Title */}
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleError(false); }}
              placeholder={t('growth_todo_title_placeholder')}
              className={cn(
                APP_MODAL_INPUT_CLASS,
                'mb-1 w-full p-3 text-sm',
                titleError ? 'border-red-400' : 'border-gray-200'
              )}
            />
            {titleError && (
              <p className="text-xs text-red-500 mb-3">{t('growth_todo_title_required')}</p>
            )}

            {/* Priority */}
            <label className="block text-sm font-medium text-slate-600 mt-3 mb-2">
              {t('growth_todo_priority')}
            </label>
            <div className="flex gap-2 mb-4">
              {priorities.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    triggerLightHaptic();
                    setPriority(p);
                  }}
                  className={cn(
                    'flex-1 rounded-xl border py-2 text-sm font-medium transition-all',
                    priority === p ? 'text-[#1D4ED8]' : 'border-white/80 bg-white/70 text-[#2F3E33]'
                  )}
                  style={priority === p ? selectedGlowStyle : undefined}
                >
                  {t(`growth_todo_priority_${p}`)}
                </button>
              ))}
            </div>

            {/* Due date */}
            <label className="block text-sm font-medium text-slate-600 mb-2">
              {t('growth_todo_due_datetime')}
            </label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className={cn(APP_MODAL_INPUT_CLASS, 'mb-4 w-full p-3 text-sm')}
            />

            {/* Recurrence */}
            <label className="block text-sm font-medium text-slate-600 mb-2">
              {t('growth_todo_recurrence')}
            </label>
            <div className="flex gap-2 mb-4">
              {recurrences.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    triggerLightHaptic();
                    setRecurrence(r);
                  }}
                  className={cn(
                    'flex-1 rounded-xl border py-2 text-sm font-medium transition-all',
                    recurrence === r
                      ? 'text-[#1D4ED8]'
                      : 'border-white/80 bg-white/70 text-[#2F3E33]'
                  )}
                  style={recurrence === r ? selectedGlowStyle : undefined}
                >
                  {t(`growth_todo_recurrence_${r}`)}
                </button>
              ))}
            </div>

            {/* Weekly day picker */}
            {recurrence === 'weekly' && (
              <>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  {t('growth_todo_weekly_days')}
                </label>
                <div className="flex gap-1 mb-4">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        triggerLightHaptic();
                        toggleDay(i);
                      }}
                      className={cn(
                        'h-9 w-9 rounded-full border text-xs font-medium transition-all',
                        recurrenceDays.includes(i)
                          ? 'text-[#1D4ED8]'
                          : 'border-white/70 bg-white/80 text-[#2F3E33]'
                      )}
                      style={recurrenceDays.includes(i) ? selectedGlowStyle : undefined}
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
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  {t('growth_todo_link_bottle')}
                </label>
                <select
                  value={bottleId}
                  onChange={(e) => setBottleId(e.target.value)}
                  className={cn(APP_MODAL_INPUT_CLASS, 'mb-2 w-full p-3 text-sm')}
                >
                  <option value="">{t('growth_todo_none')}</option>
                  {bottles.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </>
            )}
          </div>

          <div className="border-t border-white/70 bg-white px-5 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-3">
            <button
              onClick={() => {
                if (!title.trim()) {
                  handleSubmit();
                  return;
                }
                triggerLightHaptic();
                handleSubmit();
              }}
              className={cn(APP_MODAL_PRIMARY_BUTTON_CLASS, 'w-full py-2.5')}
            >
              {t('confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
