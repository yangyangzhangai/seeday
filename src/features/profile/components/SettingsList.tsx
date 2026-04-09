import React from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Shield, Info, LogOut, ChevronRight, Sprout, BarChart3, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/useAuthStore';
import { DirectionSettingsPanel } from './DirectionSettingsPanel';
import { RegionSettingsPanel } from './RegionSettingsPanel';

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

interface Props {
  plain?: boolean;
}

export const SettingsList: React.FC<Props> = ({ plain = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut, user } = useAuthStore();
  const [isRegionOpen, setIsRegionOpen] = React.useState(false);
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
    <div className={plain ? 'overflow-hidden' : 'overflow-hidden rounded-[1.5rem] border border-white/65 bg-[#F7F9F8] [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]'}>
      <button
        onClick={() => setIsRegionOpen(prev => !prev)}
        className={`flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70 ${plain ? '' : 'border-b border-slate-200/60'}`}
      >
        <div className="flex items-center space-x-2.5">
          <MapPin size={16} className="text-[#5F7A63]" />
          <span className="text-xs text-slate-700">{t('profile_region_settings')}</span>
        </div>
        <ChevronRight
          size={14}
          className={`text-gray-300 transition-transform ${isRegionOpen ? 'rotate-90' : ''}`}
        />
      </button>

      {isRegionOpen ? <RegionSettingsPanel onClose={() => setIsRegionOpen(false)} /> : null}

      <button
        onClick={() => setIsDirectionOpen(prev => !prev)}
        className={`flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70 ${plain ? '' : 'border-b border-slate-200/60'}`}
      >
        <div className="flex items-center space-x-2.5">
          <Sprout size={16} className="text-[#5F7A63]" />
          <span className="text-xs text-slate-700">{t('profile_root_direction_settings')}</span>
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
          className={`flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70 ${
            i < SETTINGS.length - 1 && !plain ? 'border-b border-slate-200/60' : ''
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <Icon size={16} className="text-[#5F7A63]" />
            <span className="text-xs text-slate-700">{t(labelKey)}</span>
          </div>
          <ChevronRight size={14} className="text-slate-300" />
        </button>
      ))}

      {canSeeTelemetry ? (
        <button
          onClick={() => navigate('/telemetry/live-input')}
          className={`flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70 ${plain ? '' : 'border-t border-slate-200/60'}`}
        >
          <div className="flex items-center space-x-2.5">
            <BarChart3 size={16} className="text-[#5F7A63]" />
            <span className="text-xs text-slate-700">Live Input Telemetry</span>
          </div>
          <ChevronRight size={14} className="text-slate-300" />
        </button>
      ) : null}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex w-full items-center space-x-2.5 px-4 py-3 transition hover:bg-white/70"
      >
        <LogOut size={16} className="text-[#5F7A63]" />
        <span className="text-xs text-slate-700">{t('profile_logout')}</span>
      </button>
    </div>
  );
};
