import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGrowthStore } from '../../store/useGrowthStore';
import { useTodoStore } from '../../store/useTodoStore';
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
  const [highlightTodoId, setHighlightTodoId] = useState<string | null>(null);
  const fetchBottles = useGrowthStore((s) => s.fetchBottles);
  const growthLoading = useGrowthStore((s) => s.isLoading);
  const growthSyncError = useGrowthStore((s) => s.lastSyncError);
  const fetchTodos = useTodoStore((s) => s.fetchTodos);
  const todoLoading = useTodoStore((s) => s.isLoading);
  const todoSyncError = useTodoStore((s) => s.lastSyncError);

  const isSyncing = growthLoading || todoLoading;
  const hasSyncError = Boolean(growthSyncError || todoSyncError);

  const handleManualSync = () => {
    void Promise.all([fetchBottles(), fetchTodos()]);
  };

  // 监听 AI 建议待办高亮事件
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ todoId: string }>).detail;
      if (detail?.todoId) {
        setHighlightTodoId(detail.todoId);
        // 3秒后清除高亮
        setTimeout(() => setHighlightTodoId(null), 3000);
      }
    };
    window.addEventListener('suggestion-highlight-todo', handler);
    return () => window.removeEventListener('suggestion-highlight-todo', handler);
  }, []);

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
          className="sticky top-0 z-10 flex items-center justify-between px-4 pb-3 pt-11"
          style={{
            background: 'rgba(252,250,247,0.38)',
            backdropFilter: 'blur(14px) saturate(150%)',
            WebkitBackdropFilter: 'blur(14px) saturate(150%)',
          }}
        >
          <h1 className="text-xl font-extrabold" style={{ color: '#1e293b', letterSpacing: '-0.02em' }}>{t('growth_title')}</h1>
          {hasSyncError ? (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              title={growthSyncError || todoSyncError || ''}
              className="rounded-lg bg-[#A86B2B] px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSyncing ? t('loading') : t('retry')}
            </button>
          ) : null}
        </header>

        <div className="flex-1 pb-28 pt-2">
          <BottleList />
          <div className="mx-4 my-2 border-t border-slate-200/70" />
          <GrowthTodoSection onFocus={(todo) => setFocusTodo(todo)} highlightTodoId={highlightTodoId} />
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
