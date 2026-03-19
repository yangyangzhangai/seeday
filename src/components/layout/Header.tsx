import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogIn, LogOut, User, MoreHorizontal, X } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { LanguageSwitcher } from './LanguageSwitcher';

export const Header = () => {
  const navigate = useNavigate();
  const { user, signOut, updateAvatar } = useAuthStore();
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);

  const resizeImageToDataUrl = (file: File, maxSize = 160): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAuthClick = () => {
    if (user) {
      if (window.confirm(t('header_confirm_logout'))) {
        signOut();
        navigate('/chat');
      }
    } else {
      navigate('/auth');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white/80 backdrop-blur-md border-b border-gray-200 z-50 flex items-center justify-between px-4">
      <div className="font-bold text-lg text-blue-600">TimeShine</div>

      <div className="flex items-center space-x-2">
        <LanguageSwitcher />

        {user ? (
          <>
            <div
              className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 border border-gray-200 cursor-pointer"
              onClick={() => fileRef.current?.click()}
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
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const dataUrl = await resizeImageToDataUrl(f, 160);
                await updateAvatar(dataUrl);
              }}
            />
            <span className="max-w-[100px] truncate text-sm text-gray-700">
              {user.user_metadata?.display_name || user.email?.split('@')[0]}
            </span>
            <button onClick={handleAuthClick} className="text-gray-600 hover:text-red-600">
              <LogOut size={18} />
            </button>
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
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowAvatarModal(false); setShowAvatarMenu(false); }}
        >
          <div
            className="relative bg-white rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute right-2 top-2 p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-600 shadow"
              onClick={() => { setShowAvatarModal(false); setShowAvatarMenu(false); }}
            >
              <X size={16} />
            </button>
            <button
              className="absolute right-10 top-2 p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-600 shadow"
              onClick={() => setShowAvatarMenu((v) => !v)}
            >
              <MoreHorizontal size={16} />
            </button>
            {showAvatarMenu && (
              <div className="absolute right-2 top-10 bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
                <button
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                  onClick={() => fileRef.current?.click()}
                >
                  更换头像
                </button>
              </div>
            )}
            <div className="w-[280px] h-[280px] bg-gray-100 flex items-center justify-center">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="avatar large" className="w-full h-full object-cover" />
              ) : (
                <User className="text-gray-300" size={120} />
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
