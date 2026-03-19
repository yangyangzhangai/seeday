import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGrowthStore } from '../../store/useGrowthStore';
import { useAuthStore } from '../../store/useAuthStore';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const DailyGoalPopup = ({ onClose }: Props) => {
  const { t } = useTranslation();
  const { dailyGoal, setDailyGoal, disablePopup } = useGrowthStore();
  const updatePreferences = useAuthStore((s) => s.updatePreferences);
  const [text, setText] = useState(dailyGoal);
  const [showMenu, setShowMenu] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleConfirm = () => {
    setDailyGoal(text);
    onClose();
  };

  const handleLongPressStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => setShowMenu(true), 600);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleDisable = () => {
    disablePopup();
    // Also turn off the Profile setting so the toggle stays in sync
    void updatePreferences({ dailyGoalEnabled: false });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="bg-white rounded-2xl mx-6 p-6 w-full max-w-sm shadow-xl relative"
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-center text-gray-900 mb-2">
          {t('growth_daily_goal_title')}
        </h2>
        <p className="text-sm text-gray-500 text-center mb-5">
          {t('growth_daily_goal_subtitle')}
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('growth_daily_goal_placeholder')}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[80px]"
          rows={3}
        />

        <button
          onClick={handleConfirm}
          className="w-full mt-4 bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          {t('growth_daily_goal_confirm')}
        </button>

        {showMenu && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]">
            <button
              onClick={handleDisable}
              className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-50"
            >
              {t('growth_daily_goal_disable')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
