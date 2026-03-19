import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGrowthStore } from '../../store/useGrowthStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DailyGoalPopup } from './DailyGoalPopup';
import { BottleList } from './BottleList';
import { GrowthTodoSection } from './GrowthTodoSection';
import { FocusMode } from './FocusMode';
import { type GrowthTodo } from './GrowthTodoCard';

export const GrowthPage = () => {
  const { t } = useTranslation();
  const shouldShowDailyGoal = useGrowthStore((s) => s.shouldShowDailyGoal);
  const dailyGoalEnabled = useAuthStore((s) => s.preferences.dailyGoalEnabled);
  const [showGoalPopup, setShowGoalPopup] = useState(false);
  const [focusTodo, setFocusTodo] = useState<GrowthTodo | null>(null);

  useEffect(() => {
    // Only show if the user has enabled it in Profile settings AND hasn't seen it today
    if (dailyGoalEnabled && shouldShowDailyGoal()) {
      setShowGoalPopup(true);
    }
  }, [dailyGoalEnabled, shouldShowDailyGoal]);

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-y-auto">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-center">{t('growth_title')}</h1>
      </header>

      {/* Content */}
      <div className="flex-1 py-4">
        {/* Bottle section */}
        <BottleList />

        {/* Divider */}
        <div className="border-t border-gray-200 mx-4 my-2" />

        {/* Todo section */}
        <GrowthTodoSection onFocus={(todo) => setFocusTodo(todo)} />
      </div>

      {/* Daily goal popup */}
      {showGoalPopup && (
        <DailyGoalPopup onClose={() => setShowGoalPopup(false)} />
      )}

      {/* Focus mode overlay */}
      {focusTodo && (
        <FocusMode todo={focusTodo} onClose={() => setFocusTodo(null)} />
      )}
    </div>
  );
};
