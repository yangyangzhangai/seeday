import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useGrowthStore, MAX_BOTTLES, type Bottle } from '../../store/useGrowthStore';
import { BottleCard } from './BottleCard';
import { AddBottleModal } from './AddBottleModal';
import { AddGrowthTodoModal } from './AddGrowthTodoModal';
import { useTodoStore, type Recurrence } from '../../store/useTodoStore';
import { cn } from '../../lib/utils';
import {
  APP_MODAL_CARD_CLASS,
  APP_MODAL_OVERLAY_CLASS,
  APP_MODAL_PRIMARY_BUTTON_CLASS,
  APP_MODAL_SECONDARY_BUTTON_CLASS,
} from '../../lib/modalTheme';

export const BottleList = () => {
  const { t } = useTranslation();
  const {
    bottles,
    addBottle,
    removeBottle,
    markBottleIrrigated,
    continueBottle,
    markBottleAchieved,
    fetchBottles,
    isLoading,
    hasHydrated,
    lastSyncError,
  } = useGrowthStore();
  const addTodo = useTodoStore((s) => s.addTodo);
  const [showAdd, setShowAdd] = useState(false);
  const [addError, setAddError] = useState('');

  // Prompt shown after creating a new habit bottle
  const [habitPromptBottle, setHabitPromptBottle] = useState<Bottle | null>(null);
  // Prompt shown on click/long-press of any bottle → "Generate todo?"
  const [todoPromptBottle, setTodoPromptBottle] = useState<Bottle | null>(null);
  // Prompt shown when clicking an achieved bottle → irrigate / goal confirm
  const [achievedBottle, setAchievedBottle] = useState<Bottle | null>(null);

  const [showTodoModal, setShowTodoModal] = useState(false);
  const [todoDefaultBottle, setTodoDefaultBottle] = useState<{ title?: string; bottleId?: string; recurrence?: Recurrence } | undefined>();

  const activeBottles = bottles.filter((b) => b.status === 'active' || b.status === 'achieved');
  const isMaxReached = activeBottles.length >= MAX_BOTTLES;

  const handleRetrySync = () => {
    void fetchBottles();
  };

  const handleAddBottle = (name: string, type: 'habit' | 'goal') => {
    const bottle = addBottle(name, type);
    if (!bottle) {
      setAddError(t('growth_bottle_name_duplicate'));
      return;
    }
    setAddError('');
    setShowAdd(false);
    if (type === 'habit') {
      setHabitPromptBottle(bottle);
    }
  };

  // After new-habit auto-prompt confirms
  const handleHabitConfirm = () => {
    if (!habitPromptBottle) return;
    setTodoDefaultBottle({ title: habitPromptBottle.name, bottleId: habitPromptBottle.id, recurrence: 'daily' });
    setHabitPromptBottle(null);
    setShowTodoModal(true);
  };

  // After click/long-press todo prompt confirms
  const handleTodoPromptConfirm = () => {
    if (!todoPromptBottle) return;
    setTodoDefaultBottle({
      title: todoPromptBottle.name,
      bottleId: todoPromptBottle.id,
      recurrence: todoPromptBottle.type === 'habit' ? 'daily' : 'once',
    });
    setTodoPromptBottle(null);
    setShowTodoModal(true);
  };

  // Irrigate an achieved bottle (animate then remove)
  const handleIrrigate = (id: string) => {
    setAchievedBottle(null);
    markBottleIrrigated(id);
  };

  // Goal confirm: achieved=true → irrigate, false → continue
  const handleGoalConfirm = (achieved: boolean) => {
    if (!achievedBottle) return;
    const id = achievedBottle.id;
    setAchievedBottle(null);
    if (achieved) {
      markBottleAchieved(id);
      setTimeout(() => markBottleIrrigated(id), 100);
    } else {
      continueBottle(id);
    }
  };

  return (
    <section className="mb-4">
      <div className="px-4 mb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-extrabold text-[#1e293b]">{t('growth_bottle_section')}</h2>
          <button
            onClick={() => !isMaxReached && setShowAdd(true)}
            disabled={isMaxReached}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full p-0 text-[#5F7A63] disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: 'rgba(144.67, 212.06, 122.21, 0.20)',
              boxShadow: '0px 2px 2px #C8C8C8',
            }}
            title={isMaxReached ? t('growth_bottle_max_reached') : t('growth_add_bottle')}
          >
            <Plus size={18} />
          </button>
        </div>
        <p className="mt-1 text-xs text-[#94a3b8]">{t('growth_bottle_section_hint')}</p>
      </div>

      {isMaxReached && (
        <p className="mb-2 px-4 text-xs text-orange-500">{t('growth_bottle_max_reached')}</p>
      )}

      {isLoading && !hasHydrated ? (
        <div className="py-6 text-center text-sm text-gray-400">{t('loading')}</div>
      ) : lastSyncError && activeBottles.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <p className="text-center text-xs text-orange-500">{lastSyncError}</p>
          <button
            onClick={handleRetrySync}
            className="rounded-lg bg-[#A86B2B] px-3 py-1.5 text-xs font-medium text-white"
          >
            {t('retry')}
          </button>
        </div>
      ) : activeBottles.length === 0 ? (
        <div className="text-center text-gray-400 py-6 text-sm">{t('no_data')}</div>
      ) : (
        <div className="mt-2 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {activeBottles.map((bottle) => (
            <BottleCard
              key={bottle.id}
              bottle={bottle}
              onTodoPrompt={setTodoPromptBottle}
              onAchievedClick={setAchievedBottle}
              onDelete={removeBottle}
            />
          ))}
        </div>
      )}

      <AddBottleModal
        isOpen={showAdd}
        onClose={() => { setShowAdd(false); setAddError(''); }}
        onAdd={handleAddBottle}
        error={addError}
      />

      {/* ── Fixed modals (not clipped by overflow) ── */}

      {/* 1. New habit auto-prompt */}
      {habitPromptBottle && (
        <div className={cn('fixed inset-0 z-50 flex items-center justify-center', APP_MODAL_OVERLAY_CLASS)}>
          <div className={cn(APP_MODAL_CARD_CLASS, 'mx-8 w-full max-w-sm rounded-3xl p-6')}>
            <p className="text-slate-800 text-center mb-2 font-medium">{t('growth_habit_todo_prompt')}</p>
            <p className="text-slate-500 text-sm text-center mb-4">
              {t('growth_habit_todo_confirm', { name: habitPromptBottle.name })}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setHabitPromptBottle(null)}
                className={cn(APP_MODAL_SECONDARY_BUTTON_CLASS, 'flex-1 py-2')}>
                {t('growth_habit_todo_dismiss')}
              </button>
              <button onClick={handleHabitConfirm}
                className={cn(APP_MODAL_PRIMARY_BUTTON_CLASS, 'flex-1 py-2')}>
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Click/long-press "Generate todo?" prompt */}
      {todoPromptBottle && (
        <div className={cn('fixed inset-0 z-50 flex items-center justify-center', APP_MODAL_OVERLAY_CLASS)}
          onClick={() => setTodoPromptBottle(null)}>
          <div className={cn(APP_MODAL_CARD_CLASS, 'mx-8 w-full max-w-sm rounded-3xl p-6')} onClick={(e) => e.stopPropagation()}>
            <p className="text-slate-800 text-center mb-4 font-medium">
              {t('growth_bottle_todo_prompt', { name: todoPromptBottle.name })}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setTodoPromptBottle(null)}
                className={cn(APP_MODAL_SECONDARY_BUTTON_CLASS, 'flex-1 py-2')}>
                {t('cancel')}
              </button>
              <button onClick={handleTodoPromptConfirm}
                className={cn(APP_MODAL_PRIMARY_BUTTON_CLASS, 'flex-1 py-2')}>
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Achieved bottle popup */}
      {achievedBottle && (
        <div className={cn('fixed inset-0 z-50 flex items-center justify-center', APP_MODAL_OVERLAY_CLASS)}
          onClick={() => setAchievedBottle(null)}>
          <div className={cn(APP_MODAL_CARD_CLASS, 'mx-8 w-full max-w-sm rounded-3xl p-6')} onClick={(e) => e.stopPropagation()}>
            {achievedBottle.type === 'habit' ? (
              <>
                <p className="text-slate-600 text-center mb-4">{t('growth_bottle_irrigate_hint')}</p>
                <div className="flex gap-3">
                  <button onClick={() => setAchievedBottle(null)}
                    className={cn(APP_MODAL_SECONDARY_BUTTON_CLASS, 'flex-1 py-2')}>
                    {t('cancel')}
                  </button>
                  <button onClick={() => handleIrrigate(achievedBottle.id)}
                    className={cn(APP_MODAL_PRIMARY_BUTTON_CLASS, 'flex-1 py-2')}>
                    {t('growth_bottle_irrigate')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-slate-600 text-center mb-4">{t('growth_bottle_goal_confirm')}</p>
                <div className="flex gap-3">
                  <button onClick={() => handleGoalConfirm(false)}
                    className={cn(APP_MODAL_SECONDARY_BUTTON_CLASS, 'flex-1 py-2')}>
                    {t('growth_bottle_goal_no')}
                  </button>
                  <button onClick={() => handleGoalConfirm(true)}
                    className={cn(APP_MODAL_PRIMARY_BUTTON_CLASS, 'flex-1 py-2')}>
                    {t('growth_bottle_goal_yes')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Todo form modal */}
      <AddGrowthTodoModal
        isOpen={showTodoModal}
        onClose={() => { setShowTodoModal(false); setTodoDefaultBottle(undefined); }}
        onAdd={addTodo}
        defaultValues={todoDefaultBottle}
      />
    </section>
  );
};
