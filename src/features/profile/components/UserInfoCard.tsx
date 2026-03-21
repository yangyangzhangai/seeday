import React, { useRef, useState } from 'react';
import { User, Crown, MoreHorizontal, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/useAuthStore';
import { useChatStore } from '../../../store/useChatStore';
import { useGrowthStore } from '../../../store/useGrowthStore';
import { resizeImageToDataUrl } from '../../../lib/imageUtils';
import { supabase } from '../../../api/supabase';

interface Props {
  isPlus: boolean;
}

// Returns local date string YYYY-MM-DD for a timestamp (ms)
function toLocalDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  const { user, updateAvatar, activityStreak } = useAuthStore();
  const messages = useChatStore((s) => s.messages);
  const bottles = useGrowthStore((s) => s.bottles);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  const todayActs = calcTodayActivities(messages);
  const completedGoals = calcCompletedGoals(bottles);

  const displayName =
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || '—';

  const handleAvatarClick = () => {
    setShowMenu(false);
    setShowAvatarModal(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setShowAvatarModal(false);
    setShowMenu(false);
    const dataUrl = await resizeImageToDataUrl(f, 160);
    await updateAvatar(dataUrl);
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
    <div className="bg-white rounded-2xl shadow-sm px-4 py-3">
      <div className="flex items-center space-x-3">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 cursor-pointer flex-shrink-0"
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
                className="text-sm font-semibold text-gray-800 bg-gray-100 rounded-lg px-2 py-0.5 outline-none border border-blue-400 w-36"
              />
            ) : (
              <span
                className="text-sm font-semibold text-gray-800 truncate cursor-pointer hover:text-blue-600 transition-colors"
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
          <p className="text-xs text-gray-400 mt-0.5 truncate">{user?.email}</p>
        </div>
      </div>

      {/* Stats — compact */}
      <div className="mt-3 grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 pt-2">
        <div className="flex flex-col items-center py-1">
          <span className="text-base font-bold text-blue-600">{activityStreak ?? '—'}</span>
          <span className="text-[10px] text-gray-500 mt-0.5">{t('profile_streak')}</span>
        </div>
        <div className="flex flex-col items-center py-1">
          <span className="text-base font-bold text-blue-600">{todayActs}</span>
          <span className="text-[10px] text-gray-500 mt-0.5">{t('profile_today_activities')}</span>
        </div>
        <div className="flex flex-col items-center py-1">
          <span className="text-base font-bold text-blue-600">{completedGoals}</span>
          <span className="text-[10px] text-gray-500 mt-0.5">{t('profile_completed_goals')}</span>
        </div>
      </div>

      {/* Avatar modal */}
      {showAvatarModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => { setShowAvatarModal(false); setShowMenu(false); }}
        >
          <div
            className="relative rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              className="absolute top-2 left-2 p-1.5 rounded-full bg-black/40 text-white z-10"
              onClick={() => { setShowAvatarModal(false); setShowMenu(false); }}
            >
              <X size={16} />
            </button>

            {/* Three-dot menu */}
            <button
              className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/40 text-white z-10"
              onClick={() => setShowMenu((v) => !v)}
            >
              <MoreHorizontal size={18} />
            </button>

            {showMenu && (
              <div className="absolute bottom-12 right-2 bg-white rounded-xl shadow-lg overflow-hidden z-20 min-w-[120px]">
                <button
                  className="block w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  onClick={() => { setShowMenu(false); fileRef.current?.click(); }}
                >
                  更换头像
                </button>
              </div>
            )}

            {/* Full avatar */}
            <div className="w-[min(256px,88vw)] h-[min(256px,88vw)] bg-gray-900 flex items-center justify-center">
              {user?.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="avatar"
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
