import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
    <div className="flex h-full items-center justify-center bg-transparent font-['Inter',sans-serif] px-0 md:px-8">
      <div className="relative h-full w-full max-w-[430px] overflow-y-auto text-slate-900 [box-shadow:0_0_0_1px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.1)] md:h-[calc(100%-24px)] md:max-w-[980px] md:rounded-[30px] md:border md:border-white/70 md:bg-[#fcfaf7]/85 md:[box-shadow:0_0_0_1px_rgba(255,255,255,0.45),0_24px_64px_rgba(15,23,42,0.12)]">
        <header
          className="sticky top-0 z-10 flex justify-end px-4 pb-3 pt-11"
          style={{
            background: 'rgba(252,250,247,0.38)',
            backdropFilter: 'blur(14px) saturate(150%)',
            WebkitBackdropFilter: 'blur(14px) saturate(150%)',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label="open profile"
            className="flex h-[54px] w-[54px] items-center justify-center rounded-full transition active:scale-95"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.90) 100%)',
              border: '2.5px solid rgba(255,255,255,0.95)',
              boxShadow: '0 6px 20px rgba(148,163,184,0.22), 0 2px 8px rgba(255,255,255,0.58)',
            }}
          >
            <span className="material-symbols-outlined text-[30px] text-[#5F7A63]">person</span>
          </button>
        </header>

        <div className="flex-1 pb-28 pt-2">
          <BottleList />
          <div className="mx-4 my-2 border-t border-slate-200/70" />
          <GrowthTodoSection onFocus={(todo) => setFocusTodo(todo)} />
        </div>
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
