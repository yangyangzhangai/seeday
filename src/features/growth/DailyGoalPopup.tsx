import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGrowthStore } from '../../store/useGrowthStore';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../api/supabase';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const DailyGoalPopup = ({ onClose }: Props) => {
  const { t } = useTranslation();
  const { dailyGoal, setDailyGoal, disablePopup } = useGrowthStore();
  const updatePreferences = useAuthStore((s) => s.updatePreferences);
  const user = useAuthStore((s) => s.user);
  const [text, setText] = useState(dailyGoal);
  const [showMenu, setShowMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleConfirm = async () => {
    setDailyGoal(text);
    if (user?.id) {
      const now = new Date();
      const goalDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      setIsSaving(true);
      try {
        const { data } = await supabase.auth.updateUser({
          data: {
            daily_goal: text,
            daily_goal_date: goalDate,
          },
        });
        if (data?.user) {
          useAuthStore.setState({ user: data.user });
        }
      } finally {
        setIsSaving(false);
      }
    }
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
        className="relative mx-6 w-full max-w-sm rounded-3xl border border-[#EBDCC2] bg-[#FFF9EE] p-6 shadow-[0_20px_60px_rgba(71,52,24,0.24)]"
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/80 p-1 text-gray-500">
          <X size={20} />
        </button>

        <h2 className="mb-2 text-center text-xl font-bold text-[#5E4120]">
          {t('growth_daily_goal_title')}
        </h2>
        <p className="mb-5 text-center text-sm text-[#8E7350]">
          {t('growth_daily_goal_subtitle')}
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('growth_daily_goal_placeholder')}
          className="min-h-[88px] w-full resize-none rounded-2xl border border-[#E4D3B5] bg-white p-3 text-sm text-[#5E4120] outline-none focus:ring-2 focus:ring-[#D8B37A]"
          rows={3}
        />

        <button
          onClick={() => { void handleConfirm(); }}
          disabled={isSaving}
          className="mt-4 w-full rounded-2xl bg-[#A86B2B] py-2.5 font-medium text-white transition-colors disabled:opacity-60"
        >
          {isSaving ? t('loading') : t('growth_daily_goal_confirm')}
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
