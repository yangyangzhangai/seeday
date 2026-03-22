import React from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Shield, Info, LogOut, ChevronRight, Sprout, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/useAuthStore';
import { DirectionSettingsPanel } from './DirectionSettingsPanel';

function isLikelyAdmin(user: any): boolean {
  if (import.meta.env.DEV) {
    return true;
  }

  const roleCandidates = [
    user?.app_metadata?.role,
    user?.user_metadata?.role,
    ...(Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : []),
    ...(Array.isArray(user?.user_metadata?.roles) ? user.user_metadata.roles : []),
  ];

  return roleCandidates.some((item) => (
    typeof item === 'string'
    && ['admin', 'owner', 'staff', 'internal', 'super_admin'].includes(item.trim().toLowerCase())
  ));
}

export const SettingsList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut, user } = useAuthStore();
  const [isDirectionOpen, setIsDirectionOpen] = React.useState(false);
  const canSeeTelemetry = isLikelyAdmin(user);

  const handleLogout = () => {
    if (window.confirm(t('header_confirm_logout'))) {
      signOut();
      navigate('/chat');
    }
  };

  const SETTINGS = [
    { icon: HelpCircle, labelKey: 'profile_help', action: () => {} },
    { icon: Shield, labelKey: 'profile_privacy', action: () => {} },
    { icon: Info, labelKey: 'profile_about', action: () => {} },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setIsDirectionOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition border-b border-gray-100"
      >
        <div className="flex items-center space-x-2.5">
          <Sprout size={16} className="text-gray-500" />
          <span className="text-xs text-gray-700">{t('profile_root_direction_settings')}</span>
        </div>
        <ChevronRight
          size={14}
          className={`text-gray-300 transition-transform ${isDirectionOpen ? 'rotate-90' : ''}`}
        />
      </button>

      {isDirectionOpen ? <DirectionSettingsPanel onClose={() => setIsDirectionOpen(false)} /> : null}

      {SETTINGS.map(({ icon: Icon, labelKey, action }, i) => (
        <button
          key={labelKey}
          onClick={action}
          className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition ${
            i < SETTINGS.length - 1 ? 'border-b border-gray-100' : ''
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <Icon size={16} className="text-gray-500" />
            <span className="text-xs text-gray-700">{t(labelKey)}</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </button>
      ))}

      {canSeeTelemetry ? (
        <button
          onClick={() => navigate('/telemetry/live-input')}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition border-t border-gray-100"
        >
          <div className="flex items-center space-x-2.5">
            <BarChart3 size={16} className="text-gray-500" />
            <span className="text-xs text-gray-700">Live Input Telemetry</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </button>
      ) : null}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center space-x-2.5 px-4 py-3 hover:bg-red-50 transition"
      >
        <LogOut size={16} className="text-red-500" />
        <span className="text-xs text-red-500 font-medium">{t('profile_logout')}</span>
      </button>
    </div>
  );
};
