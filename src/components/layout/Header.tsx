import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogIn, User } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export const Header = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useTranslation();

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
              onClick={() => navigate('/profile')}
            >
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User size={16} className="text-gray-400" />
                </div>
              )}
            </div>
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

    </header>
  );
};
