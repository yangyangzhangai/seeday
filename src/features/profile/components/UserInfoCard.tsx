import React, { useEffect, useRef, useState } from 'react';
import { User, Crown, X, MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/useAuthStore';
import { useChatStore } from '../../../store/useChatStore';
import { useGrowthStore } from '../../../store/useGrowthStore';
import { resizeImageToDataUrl } from '../../../lib/imageUtils';
import { cn } from '../../../lib/utils';
import { APP_MODAL_CARD_CLASS, APP_MODAL_CLOSE_CLASS, APP_MODAL_OVERLAY_CLASS } from '../../../lib/modalTheme';
import { supabase } from '../../../api/supabase';

interface Props {
  isPlus: boolean;
}

// Returns local date string YYYY-MM-DD for a timestamp (ms)
function toLocalDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcLast7DayCount(dates: Set<string>): number {
  let days = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    if (dates.has(toLocalDate(d.getTime()))) {
      days++;
    }
    d.setDate(d.getDate() - 1);
  }

  return days;
}

function getLoginDaysFromMeta(user: any): string[] {
  const raw = user?.user_metadata?.login_days;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item));
}
function calcTodayActivities(messages: any[]): number {
  const today = toLocalDate(Date.now());
  return messages.filter(
    (m) =>
      m.mode === 'record' &&
      !m.isMood &&
      toLocalDate(m.timestamp) === today
  ).length;
}

function calcCompletedGoals(bottles: any[]): number {
  return bottles.filter(
    (b) => b.status === 'achieved' || b.status === 'irrigated'
  ).length;
}

export const UserInfoCard: React.FC<Props> = ({ isPlus }) => {
  const { t } = useTranslation();
  const { user, updateAvatar } = useAuthStore();
  const messages = useChatStore((s) => s.messages);
  const bottles = useGrowthStore((s) => s.bottles);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [weeklyLoginDays, setWeeklyLoginDays] = useState(0);

  // Prefer login-day history; activity dates are used as fallback for older accounts.
  useEffect(() => {
    if (!user) {
      setWeeklyLoginDays(0);
      return;
    }

    let cancelled = false;
    const recentDays = new Set(getLoginDaysFromMeta(user));
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const load = async () => {
      const { data } = await supabase
        .from('messages')
        .select('timestamp')
        .eq('user_id', user.id)
        .neq('activity_type', 'chat')
        .eq('is_mood', false)
        .gte('timestamp', sevenDaysAgo.getTime());

      (data || []).forEach((row) => recentDays.add(toLocalDate(Number(row.timestamp))));
      if (!cancelled) {
        setWeeklyLoginDays(calcLast7DayCount(recentDays));
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const todayActs = calcTodayActivities(messages);
  const completedGoals = calcCompletedGoals(bottles);

  const displayName =
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || '—';

  const handleAvatarClick = () => {
    setShowAvatarModal(true);
    setShowAvatarMenu(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setShowAvatarModal(false);
    const dataUrl = await resizeImageToDataUrl(f, 640, 0.95);
    await updateAvatar(dataUrl);
    setShowAvatarMenu(false);
    // reset so same file can be re-selected
    e.target.value = '';
  };

  const handleNameClick = () => {
    setNameValue(displayName);
    setEditingName(true);
  };

  const handleNameSave = async () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== displayName) {
      await supabase.auth.updateUser({ data: { display_name: trimmed } });
      // refresh user in store
      const { data } = await supabase.auth.getUser();
      if (data?.user) useAuthStore.setState({ user: data.user });
    }
    setEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNameSave();
    if (e.key === 'Escape') setEditingName(false);
  };

  return (
    <div className="rounded-[1.5rem] border border-white/65 bg-[#F7F9F8] px-4 py-3 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]">
      <div className="flex items-center space-x-3">
        {/* Avatar */}
        <div
          className="h-12 w-12 flex-shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white/90 bg-white shadow-[0_4px_14px_rgba(148,163,184,0.22)]"
          onClick={handleAvatarClick}
        >
          {user?.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt="avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User size={22} className="text-gray-400" />
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Name + email */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1.5">
            {editingName ? (
              <input
                autoFocus
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={handleNameKeyDown}
                className="w-36 rounded-lg border border-[#8FAF92]/60 bg-white px-2 py-0.5 text-sm font-semibold text-slate-700 outline-none"
              />
            ) : (
              <span
                className="cursor-pointer truncate text-sm font-semibold text-slate-800 transition-colors hover:text-[#5F7A63]"
                onClick={handleNameClick}
              >
                {displayName}
              </span>
            )}
            {isPlus && (
              <span className="flex items-center space-x-0.5 bg-yellow-100 text-yellow-600 text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                <Crown size={10} />
                <span>PLUS</span>
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">{user?.email}</p>
        </div>
      </div>

      {/* Stats — compact */}
      <div className="mt-3 grid grid-cols-3 divide-x divide-slate-200/60 border-t border-slate-200/60 pt-2">
        <div className="flex flex-col items-center py-1">
          <span className="mt-0.5 text-[10px] text-slate-500">{t('profile_streak')}</span>
          <span className="mt-0.5 text-base font-bold text-[#5F7A63]">{weeklyLoginDays}</span>
          <span className="mt-0.5 px-1 text-center text-[9px] leading-tight text-slate-400">
            {t('profile_weekly_login_hint', { days: weeklyLoginDays })}
          </span>
        </div>
        <div className="flex flex-col items-center py-1">
          <span className="mt-0.5 text-[10px] text-slate-500">{t('profile_today_activities')}</span>
          <span className="mt-0.5 text-base font-bold text-[#5F7A63]">{todayActs}</span>
          <span className="mt-0.5 px-1 text-center text-[9px] leading-tight text-slate-400">
            {t('profile_today_activities_hint', { count: todayActs })}
          </span>
        </div>
        <div className="flex flex-col items-center py-1">
          <span className="mt-0.5 text-[10px] text-slate-500">{t('profile_completed_goals')}</span>
          <span className="mt-0.5 text-base font-bold text-[#5F7A63]">{completedGoals}</span>
          <span className="mt-0.5 px-1 text-center text-[9px] leading-tight text-slate-400">
            {t('profile_completed_goals_hint')}
          </span>
        </div>
      </div>

      {/* Avatar modal */}
      {showAvatarModal && (
        <div
          className={cn('fixed inset-0 flex items-center justify-center z-50', APP_MODAL_OVERLAY_CLASS)}
          onClick={() => {
            setShowAvatarModal(false);
            setShowAvatarMenu(false);
          }}
        >
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              className={cn(APP_MODAL_CLOSE_CLASS, 'absolute right-3 top-3 z-10 p-1.5')}
              onClick={() => {
                setShowAvatarModal(false);
                setShowAvatarMenu(false);
              }}
              title={t('auth_close')}
            >
              <X size={16} />
            </button>

            {showAvatarMenu ? (
              <div className={cn(APP_MODAL_CARD_CLASS, 'absolute bottom-12 right-3 z-10 overflow-hidden rounded-xl')}>
                <button
                  className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-white/70"
                  onClick={() => fileRef.current?.click()}
                >
                  {t('auth_change_avatar')}
                </button>
              </div>
            ) : null}

            <button
              className={cn(APP_MODAL_CLOSE_CLASS, 'absolute bottom-3 right-3 z-10 p-2')}
              onClick={() => setShowAvatarMenu((v) => !v)}
              title={t('auth_more')}
            >
              <MoreHorizontal size={16} />
            </button>

            {/* Full avatar */}
            <div className="h-[min(320px,88vw)] w-[min(320px,88vw)] rounded-2xl overflow-hidden bg-gray-900 shadow-2xl flex items-center justify-center">
              {user?.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="avatar large"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={80} className="text-gray-500" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
