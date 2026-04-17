import { useTranslation } from 'react-i18next';
import { BarChart3, Flame, Sprout, Trash2, Trophy, X } from 'lucide-react';
import type { Bottle } from '../../store/useGrowthStore';
import type { Recurrence } from '../../store/useTodoStore';
import { cn } from '../../lib/utils';
import {
  APP_MODAL_CARD_CLASS,
  APP_MODAL_CLOSE_CLASS,
  APP_MODAL_OVERLAY_CLASS,
  APP_MODAL_PRIMARY_BUTTON_CLASS,
  APP_MODAL_SECONDARY_BUTTON_CLASS,
} from '../../lib/modalTheme';
import type { BottleCheckinStats } from '../../lib/bottleStats';

interface Props {
  bottle: Bottle | null;
  stats: BottleCheckinStats;
  onClose: () => void;
  onCreateTodo: (bottle: Bottle, recurrence: Recurrence) => void;
  onDelete: (id: string) => void;
  onIrrigate: (id: string) => void;
  onContinue: (id: string) => void;
}

export const BottleDetailSheet = ({
  bottle,
  stats,
  onClose,
  onCreateTodo,
  onDelete,
  onIrrigate,
  onContinue,
}: Props) => {
  const { t } = useTranslation();
  if (!bottle) return null;

  const handleCreateTodo = () => {
    const recurrence: Recurrence = bottle.type === 'habit' ? 'daily' : 'once';
    onCreateTodo(bottle, recurrence);
  };

  const handleDelete = () => {
    if (!window.confirm(t('growth_bottle_delete_confirm', { name: bottle.name }))) return;
    onDelete(bottle.id);
  };

  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center p-4', APP_MODAL_OVERLAY_CLASS)} onClick={onClose}>
      <div className={cn(APP_MODAL_CARD_CLASS, 'w-[min(92vw,420px)] rounded-2xl p-5')} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{t(bottle.type === 'habit' ? 'growth_bottle_type_habit' : 'growth_bottle_type_goal')}</p>
            <h3 className="mt-1 text-lg font-bold text-slate-800">{bottle.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{t('growth_bottle_stars', { stars: bottle.stars })}</p>
          </div>
          <button onClick={onClose} className={cn(APP_MODAL_CLOSE_CLASS, 'p-1')}>
            <X size={24} strokeWidth={1.5} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <BarChart3 size={14} />
            </div>
            <p className="text-lg font-bold text-slate-800">{stats.last7Days}</p>
            <p className="text-xs leading-4 text-slate-500">{t('growth_bottle_stats_last7')}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <Flame size={14} />
            </div>
            <p className="text-lg font-bold text-slate-800">{stats.currentStreak}</p>
            <p className="text-xs leading-4 text-slate-500">{t('growth_bottle_stats_streak_current')}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-600">
              <Trophy size={14} />
            </div>
            <p className="text-lg font-bold text-slate-800">{stats.bestStreak}</p>
            <p className="text-xs leading-4 text-slate-500">{t('growth_bottle_stats_streak_best')}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {bottle.status === 'active' ? (
            <button onClick={handleCreateTodo} className={cn(APP_MODAL_PRIMARY_BUTTON_CLASS, 'w-full py-2.5')}>
              <span className="inline-flex items-center gap-1">
                <Sprout size={16} strokeWidth={1.5} />
                {t('growth_bottle_create_todo')}
              </span>
            </button>
          ) : bottle.type === 'habit' ? (
            <button onClick={() => onIrrigate(bottle.id)} className={cn(APP_MODAL_PRIMARY_BUTTON_CLASS, 'w-full py-2.5')}>
              {t('growth_bottle_irrigate')}
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => onContinue(bottle.id)} className={cn(APP_MODAL_SECONDARY_BUTTON_CLASS, 'flex-1 py-2.5')}>
                {t('growth_bottle_goal_no')}
              </button>
              <button onClick={() => onIrrigate(bottle.id)} className={cn(APP_MODAL_PRIMARY_BUTTON_CLASS, 'flex-1 py-2.5')}>
                {t('growth_bottle_goal_yes')}
              </button>
            </div>
          )}

          <button
            onClick={handleDelete}
            className="w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-100"
          >
            <span className="inline-flex items-center gap-1">
              <Trash2 size={16} strokeWidth={1.5} />
              {t('growth_bottle_delete')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
