import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGrowthStore } from '../../store/useGrowthStore';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../api/supabase';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  APP_MODAL_CARD_CLASS,
  APP_MODAL_CLOSE_CLASS,
  APP_MODAL_INPUT_CLASS,
  APP_MODAL_OVERLAY_CLASS,
  APP_MODAL_PRIMARY_BUTTON_CLASS,
} from '../../lib/modalTheme';

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
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center', APP_MODAL_OVERLAY_CLASS)}>
      <div
        className={cn(APP_MODAL_CARD_CLASS, 'relative mx-6 w-full max-w-sm rounded-2xl p-6')}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
      >
        <button onClick={onClose} className={cn(APP_MODAL_CLOSE_CLASS, 'absolute right-4 top-4 p-1')}>
          <X size={24} strokeWidth={1.5} />
        </button>

        <h2 className="mb-2 text-center text-2xl font-bold text-slate-800">
          {t('growth_daily_goal_title')}
        </h2>
        <p className="mb-5 text-center text-sm text-slate-500">
          {t('growth_daily_goal_subtitle')}
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('growth_daily_goal_placeholder')}
          className={cn(APP_MODAL_INPUT_CLASS, 'min-h-[88px] w-full resize-none p-3 text-sm')}
          rows={3}
        />

        <button
          onClick={() => { void handleConfirm(); }}
          disabled={isSaving}
          className={cn(APP_MODAL_PRIMARY_BUTTON_CLASS, 'mt-4 w-full py-2.5 disabled:opacity-60')}
        >
          {isSaving ? t('loading') : t('growth_daily_goal_confirm')}
        </button>

        {showMenu && (
          <div className={cn(APP_MODAL_CARD_CLASS, 'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 rounded-xl py-1 min-w-[140px]')}>
            <button
              onClick={handleDisable}
              className="w-full text-left px-4 py-2 text-sm text-[#2F3E33] hover:bg-white/70"
            >
              {t('growth_daily_goal_disable')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
