import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useGrowthStore, MAX_BOTTLES, type Bottle } from '../../store/useGrowthStore';
import { BottleCard } from './BottleCard';
import { AddBottleModal } from './AddBottleModal';
import { AddGrowthTodoModal } from './AddGrowthTodoModal';
import { useTodoStore, type Recurrence } from '../../store/useTodoStore';

export const BottleList = () => {
  const { t } = useTranslation();
  const { bottles, addBottle, removeBottle, markBottleIrrigated, continueBottle, markBottleAchieved } = useGrowthStore();
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
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-bold text-gray-800">{t('growth_bottle_section')}</h2>
        <button
          onClick={() => !isMaxReached && setShowAdd(true)}
          disabled={isMaxReached}
          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
          title={isMaxReached ? t('growth_bottle_max_reached') : t('growth_add_bottle')}
        >
          <Plus size={18} />
        </button>
      </div>

      {isMaxReached && (
        <p className="text-xs text-orange-500 px-4 mb-2">{t('growth_bottle_max_reached')}</p>
      )}

      {activeBottles.length === 0 ? (
        <div className="text-center text-gray-400 py-6 text-sm">{t('no_data')}</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 mx-8 max-w-sm w-full">
            <p className="text-gray-800 text-center mb-2 font-medium">{t('growth_habit_todo_prompt')}</p>
            <p className="text-gray-500 text-sm text-center mb-4">
              {t('growth_habit_todo_confirm', { name: habitPromptBottle.name })}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setHabitPromptBottle(null)}
                className="flex-1 py-2 bg-gray-100 rounded-xl text-gray-700 font-medium">
                {t('growth_habit_todo_dismiss')}
              </button>
              <button onClick={handleHabitConfirm}
                className="flex-1 py-2 bg-blue-500 rounded-xl text-white font-medium">
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Click/long-press "Generate todo?" prompt */}
      {todoPromptBottle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setTodoPromptBottle(null)}>
          <div className="bg-white rounded-2xl p-6 mx-8 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="text-gray-800 text-center mb-4 font-medium">
              {t('growth_bottle_todo_prompt', { name: todoPromptBottle.name })}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setTodoPromptBottle(null)}
                className="flex-1 py-2 bg-gray-100 rounded-xl text-gray-700 font-medium">
                {t('cancel')}
              </button>
              <button onClick={handleTodoPromptConfirm}
                className="flex-1 py-2 bg-blue-500 rounded-xl text-white font-medium">
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Achieved bottle popup */}
      {achievedBottle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setAchievedBottle(null)}>
          <div className="bg-white rounded-2xl p-6 mx-8 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            {achievedBottle.type === 'habit' ? (
              <>
                <p className="text-gray-600 text-center mb-4">{t('growth_bottle_irrigate_hint')}</p>
                <div className="flex gap-3">
                  <button onClick={() => setAchievedBottle(null)}
                    className="flex-1 py-2 bg-gray-100 rounded-xl text-gray-700 font-medium">
                    {t('cancel')}
                  </button>
                  <button onClick={() => handleIrrigate(achievedBottle.id)}
                    className="flex-1 py-2 bg-green-500 rounded-xl text-white font-medium">
                    {t('growth_bottle_irrigate')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-600 text-center mb-4">{t('growth_bottle_goal_confirm')}</p>
                <div className="flex gap-3">
                  <button onClick={() => handleGoalConfirm(false)}
                    className="flex-1 py-2 bg-gray-100 rounded-xl text-gray-700 font-medium">
                    {t('growth_bottle_goal_no')}
                  </button>
                  <button onClick={() => handleGoalConfirm(true)}
                    className="flex-1 py-2 bg-green-500 rounded-xl text-white font-medium">
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
