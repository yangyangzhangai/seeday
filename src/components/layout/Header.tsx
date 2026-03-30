import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogIn, User, X } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { resizeImageToDataUrl } from '../../lib/imageUtils';

export const Header = () => {
  const navigate = useNavigate();
  const { user, updateAvatar } = useAuthStore();
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setShowAvatarModal(false);
    const dataUrl = await resizeImageToDataUrl(f, 160);
    await updateAvatar(dataUrl);
    e.target.value = '';
  };

  const handleAuthClick = () => {
    if (!user) {
      navigate('/auth');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white/80 backdrop-blur-md border-b border-gray-200 z-50 flex items-center justify-between px-4">
      <div className="font-bold text-lg text-blue-600">TimeShine</div>

      <div className="flex items-center space-x-2">
        {user ? (
          <>
            <div
              className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 border border-gray-200 cursor-pointer"
              onClick={() => setShowAvatarModal(true)}
            >
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User size={16} className="text-gray-400" />
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
            <span className="max-w-[100px] truncate text-sm text-gray-700">
              {user.user_metadata?.display_name || user.email?.split('@')[0]}
            </span>
          </>
        ) : (
          <button
            onClick={handleAuthClick}
            className="flex items-center space-x-1 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
          >
            <LogIn size={18} />
            <span>{t('header_login')}</span>
          </button>
        )}
      </div>

      {showAvatarModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowAvatarModal(false)}
        >
          <div
            className="flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="self-end p-1.5 rounded-full bg-black/40 text-white"
              onClick={() => setShowAvatarModal(false)}
            >
              <X size={16} />
            </button>
            <div className="w-[min(256px,88vw)] h-[min(256px,88vw)] rounded-2xl overflow-hidden bg-gray-900 shadow-2xl flex items-center justify-center">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={80} className="text-gray-500" />
              )}
            </div>
            <button
              className="px-6 py-2.5 rounded-full bg-white text-sm font-medium text-gray-700 shadow-lg hover:bg-gray-50 active:bg-gray-100"
              onClick={() => { setShowAvatarModal(false); fileRef.current?.click(); }}
            >
              更换头像
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
