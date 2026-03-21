import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGrowthStore } from '../../store/useGrowthStore';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../api/supabase';
import { DailyGoalPopup } from './DailyGoalPopup';
import { BottleList } from './BottleList';
import { GrowthTodoSection } from './GrowthTodoSection';
import { FocusMode } from './FocusMode';
import { type GrowthTodo } from './GrowthTodoCard';

function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeDateKey(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const slash = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slash) {
    const [, y, m, d] = slash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }

  return '';
}

export const GrowthPage = () => {
  const { t } = useTranslation();
  const goalDate = useGrowthStore((s) => s.goalDate);
  const popupDisabled = useGrowthStore((s) => s.popupDisabled);
  const dailyGoalEnabled = useAuthStore((s) => s.preferences.dailyGoalEnabled);
  const authLoading = useAuthStore((s) => s.loading);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const remoteGoalDate = useAuthStore((s) => {
    const date = s.user?.user_metadata?.daily_goal_date;
    return typeof date === 'string' ? date : '';
  });
  const [showGoalPopup, setShowGoalPopup] = useState(false);
  const [focusTodo, setFocusTodo] = useState<GrowthTodo | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) return;
    if (typeof window === 'undefined' || !window.sessionStorage || !window.localStorage) return;
    let cancelled = false;

    const checkPopup = async () => {
      const today = localDateStr();
      const firstLoginSessionKey = `growth:is-first-login:${userId}:${today}`;
      const visitKey = `growth:daily-goal-evaluated:${userId}:${today}`;

      // Popup may only be evaluated in today's first login session.
      if (window.sessionStorage.getItem(firstLoginSessionKey) !== '1') return;

      // Only evaluate popup rules on the first Growth-page visit of the day.
      if (window.localStorage.getItem(visitKey) === '1') return;

      let freshestRemoteGoalDate = normalizeDateKey(remoteGoalDate);
      try {
        const { data } = await supabase.auth.getUser();
        const latestMetaDate = normalizeDateKey(data.user?.user_metadata?.daily_goal_date);
        if (latestMetaDate) freshestRemoteGoalDate = latestMetaDate;
        if (!cancelled && data.user && data.user.id === userId) {
          useAuthStore.setState({ user: data.user });
        }
      } catch {
        // fall back to currently cached metadata
      }

      const hasSubmittedToday =
        normalizeDateKey(goalDate) === today || freshestRemoteGoalDate === today;

      if (!cancelled && dailyGoalEnabled && !popupDisabled && !hasSubmittedToday) {
        setShowGoalPopup(true);
      }

      if (!cancelled) {
        window.localStorage.setItem(visitKey, '1');
      }
    };

    void checkPopup();
    return () => {
      cancelled = true;
    };
  }, [authLoading, dailyGoalEnabled, goalDate, popupDisabled, remoteGoalDate, userId]);

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
