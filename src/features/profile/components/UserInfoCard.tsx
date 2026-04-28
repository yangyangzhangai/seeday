import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { User, Crown, X, MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/useAuthStore';
import { useChatStore } from '../../../store/useChatStore';
import { useGrowthStore } from '../../../store/useGrowthStore';
import { blobToDataUrl } from '../../../lib/imageUtils';
import { cn } from '../../../lib/utils';
import { APP_MODAL_CARD_CLASS, APP_MODAL_CLOSE_CLASS, APP_MODAL_OVERLAY_CLASS } from '../../../lib/modalTheme';
import { supabase } from '../../../api/supabase';
import { ImageCropModal } from '../../chat/components/ImageCropModal';

interface Props {
  isPlus: boolean;
}

const MEMBERSHIP_PURPLE = '#a855f7';
const MEMBERSHIP_PURPLE_DEEP = '#9333ea';
const MEMBERSHIP_PINK = '#ec4899';
const MEMBERSHIP_TEXT = '#7e22ce';

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
  const { user, updateAvatar, updateDisplayName } = useAuthStore();
  const messages = useChatStore((s) => s.messages);
  const bottles = useGrowthStore((s) => s.bottles);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
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
    setCropFile(f);
    setShowAvatarMenu(false);
    setShowAvatarModal(false);
    // reset so same file can be re-selected
    e.target.value = '';
  };

  const handleAvatarCropConfirm = async (blob: Blob) => {
    setCropFile(null);
    try {
      const dataUrl = await blobToDataUrl(blob);
      const { error } = await updateAvatar(dataUrl);
      if (error) {
        throw error;
      }
    } catch {
      window.alert(t('image_upload_fail'));
    }
  };

  const handleNameClick = () => {
    setNameValue(displayName);
    setEditingName(true);
  };

  const handleNameSave = async () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== displayName) {
      await updateDisplayName(trimmed);
    }
    setEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNameSave();
    if (e.key === 'Escape') setEditingName(false);
  };

  const plusCardStyle: React.CSSProperties = isPlus
    ? {
      background:
        'radial-gradient(circle at 16% 12%, rgba(216,180,254,0.52) 0%, rgba(216,180,254,0) 34%), radial-gradient(circle at 86% 8%, rgba(236,72,153,0.24) 0%, rgba(236,72,153,0) 30%), linear-gradient(132deg, #f5e8ff 0%, #ead8ff 28%, #f0dcff 58%, #fff0f8 100%)',
      backdropFilter: 'blur(22px) saturate(145%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      border: '1px solid rgba(147,51,234,0.28)',
      boxShadow: '0 12px 30px rgba(147,51,234,0.20), inset 0 1px 1px rgba(255,255,255,0.72)',
    }
    : {};

  return (
    <div
      className={isPlus
        ? 'relative overflow-hidden rounded-2xl px-4 py-3'
        : 'rounded-2xl border border-white/65 bg-[#F7F9F8] px-4 py-3 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75)]'}
      style={plusCardStyle}
    >

      <div className={isPlus ? 'relative z-[1] flex items-center space-x-3' : 'flex items-center space-x-3'}>
        {/* Avatar */}
        <button
          type="button"
          aria-label="Open avatar preview"
          className={isPlus
            ? 'relative z-[2] h-[70px] w-[70px] flex-shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-[#eef3ff] bg-white p-0 shadow-[0_4px_14px_rgba(90,116,199,0.18)]'
            : 'h-[70px] w-[70px] flex-shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white/90 bg-white p-0 shadow-[0_4px_14px_rgba(148,163,184,0.22)]'}
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
              <User size={34} strokeWidth={1.5} className="text-gray-400" />
            </div>
          )}
        </button>
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
                className="w-36 rounded-lg border border-[#8FAF92]/60 bg-white px-2 py-0.5 text-base font-semibold text-slate-700 outline-none"
              />
            ) : (
              <span
                className={isPlus
                  ? 'cursor-pointer truncate text-base font-semibold transition-colors'
                  : 'cursor-pointer truncate text-base font-semibold text-slate-800 transition-colors hover:text-[#5F7A63]'}
                style={isPlus ? { color: MEMBERSHIP_TEXT } : undefined}
                onClick={handleNameClick}
              >
                {displayName}
              </span>
            )}
            {isPlus && (
              <span
                className="flex items-center space-x-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${MEMBERSHIP_PURPLE_DEEP} 0%, ${MEMBERSHIP_PURPLE} 56%, ${MEMBERSHIP_PINK} 100%)`,
                  color: '#f4f8ff',
                  boxShadow: '0 5px 12px rgba(168,85,247,0.3), inset 0 1px 1px rgba(240,246,255,0.78)',
                }}
              >
                <Crown size={10} strokeWidth={1.5} />
                <span>PRO</span>
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs" style={{ color: '#5F7A63' }}>{user?.email}</p>
        </div>
      </div>

      {/* Stats — compact */}
      <div className={isPlus ? 'relative z-[1] mt-3 pt-3' : 'relative mt-3 pt-2'}>
        {isPlus ? (
          <>
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height: 1,
                background: 'linear-gradient(90deg, rgba(168,85,247,0.08) 0%, rgba(168,85,247,0.82) 50%, rgba(168,85,247,0.08) 100%)',
                boxShadow: '0 0 8px rgba(168,85,247,0.42)',
                pointerEvents: 'none',
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: '33.333%',
                top: 6,
                bottom: 6,
                width: 1,
                background: 'linear-gradient(180deg, rgba(168,85,247,0.08) 0%, rgba(168,85,247,0.76) 50%, rgba(168,85,247,0.08) 100%)',
                boxShadow: '0 0 7px rgba(168,85,247,0.34)',
                pointerEvents: 'none',
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: '66.666%',
                top: 6,
                bottom: 6,
                width: 1,
                background: 'linear-gradient(180deg, rgba(168,85,247,0.08) 0%, rgba(168,85,247,0.76) 50%, rgba(168,85,247,0.08) 100%)',
                boxShadow: '0 0 7px rgba(168,85,247,0.34)',
                pointerEvents: 'none',
              }}
            />
          </>
        ) : null}
        {!isPlus ? (
          <>
            <div
              aria-hidden
              className="absolute left-0 right-0 top-0 h-px bg-slate-200/80"
            />
            <div
              aria-hidden
              className="absolute bottom-1 top-3 w-px bg-slate-200/80"
              style={{ left: '33.333%' }}
            />
            <div
              aria-hidden
              className="absolute bottom-1 top-3 w-px bg-slate-200/80"
              style={{ left: '66.666%' }}
            />
          </>
        ) : null}
        <div className="grid grid-cols-3">
        {[
          { label: t('profile_streak'), value: weeklyLoginDays, hint: t('profile_weekly_login_hint', { days: weeklyLoginDays }) },
          { label: t('profile_today_activities'), value: todayActs, hint: t('profile_today_activities_hint', { count: todayActs }) },
          { label: t('profile_completed_goals'), value: completedGoals, hint: t('profile_completed_goals_hint') },
        ].map(({ label, value, hint }) => (
          <div key={label} className="flex flex-col items-center py-1">
            <span className="mt-0.5 text-[12px] font-medium" style={{ color: isPlus ? MEMBERSHIP_TEXT : '#5F7A63' }}>{label}</span>
            <span className="mt-0.5 text-base font-bold" style={{ color: isPlus ? MEMBERSHIP_PURPLE_DEEP : '#5F7A63' }}>{value}</span>
            <span className="mt-0.5 px-1 text-center text-[10px] font-light leading-tight" style={{ color: isPlus ? '#9333ea99' : '#5F7A63' }}>{hint}</span>
          </div>
        ))}
        </div>
      </div>

      {/* Avatar modal */}
      {showAvatarModal ? createPortal(
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
              <X size={16} strokeWidth={1.5} />
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
              <MoreHorizontal size={16} strokeWidth={1.5} />
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
                <User size={80} strokeWidth={1.5} className="text-gray-500" />
              )}
            </div>
          </div>
        </div>
      , document.body) : null}

      {cropFile ? createPortal(
        <ImageCropModal
          file={cropFile}
          aspectW={1}
          aspectH={1}
          outputW={240}
          outputH={240}
          outputQuality={0.82}
          onConfirm={(blob) => { void handleAvatarCropConfirm(blob); }}
          onCancel={() => setCropFile(null)}
        />,
        document.body,
      ) : null}
    </div>
  );
};
