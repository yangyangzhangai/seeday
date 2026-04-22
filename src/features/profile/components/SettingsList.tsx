import React from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Shield, Info, LogOut, ChevronRight, Sprout, BarChart3, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { reportTelemetryEvent } from '../../../services/input/reportTelemetryEvent';
import { useAuthStore } from '../../../store/useAuthStore';
import { DirectionSettingsPanel } from './DirectionSettingsPanel';
import { RegionSettingsPanel } from './RegionSettingsPanel';
import { isTelemetryAdmin } from '../../telemetry/isTelemetryAdmin';

interface Props {
  plain?: boolean;
}

export const SettingsList: React.FC<Props> = ({ plain = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut, user } = useAuthStore();
  const [isRegionOpen, setIsRegionOpen] = React.useState(false);
  const [isDirectionOpen, setIsDirectionOpen] = React.useState(false);
  const canSeeTelemetry = isTelemetryAdmin(user);

  const handleLogout = () => {
    if (window.confirm(t('header_confirm_logout'))) {
      signOut();
      navigate('/auth', { replace: true });
    }
  };

  const SETTINGS = [
    { icon: HelpCircle, labelKey: 'profile_help', action: () => {} },
    { icon: Shield, labelKey: 'profile_privacy', action: () => {} },
    { icon: Info, labelKey: 'profile_about', action: () => {} },
  ];

  return (
    <div className={plain ? 'overflow-hidden' : 'overflow-hidden rounded-2xl border border-white/65 bg-[#F7F9F8] [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]'}>
      <button
        onClick={() => setIsRegionOpen(prev => !prev)}
        className={`flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70 ${plain ? '' : 'border-b border-slate-200/60'}`}
      >
        <div className="flex items-center space-x-2.5">
          <MapPin size={18} strokeWidth={2} className="text-[#000000]" />
          <span className="profile-fn-title">{t('profile_region_settings')}</span>
        </div>
        <ChevronRight
          size={18}
          strokeWidth={2.5}
          className={`text-[#5F7A63] transition-transform ${isRegionOpen ? 'rotate-90' : ''}`}
        />
      </button>

      {isRegionOpen ? <RegionSettingsPanel onClose={() => setIsRegionOpen(false)} /> : null}

      <button
        onClick={() => {
          setIsDirectionOpen(prev => {
            const next = !prev;
            if (next) {
              void reportTelemetryEvent('root_direction_opened', { source: 'profile_settings' });
            }
            return next;
          });
        }}
        className={`flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70 ${plain ? '' : 'border-b border-slate-200/60'}`}
      >
        <div className="flex items-center space-x-2.5">
          <Sprout size={18} strokeWidth={2} className="text-[#000000]" />
          <span className="profile-fn-title">{t('profile_root_direction_settings')}</span>
        </div>
        <ChevronRight
          size={18}
          strokeWidth={2.5}
          className={`text-[#5F7A63] transition-transform ${isDirectionOpen ? 'rotate-90' : ''}`}
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
            <Icon size={18} strokeWidth={2} className="text-[#000000]" />
            <span className="profile-fn-title">{t(labelKey)}</span>
          </div>
          <ChevronRight size={18} strokeWidth={2.5} className="text-[#5F7A63]" />
        </button>
      ))}

        {canSeeTelemetry ? (
          <button
            onClick={() => navigate('/telemetry')}
            className={`flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70 ${plain ? '' : 'border-t border-slate-200/60'}`}
          >
            <div className="flex items-center space-x-2.5">
              <BarChart3 size={18} strokeWidth={2} className="text-[#000000]" />
              <span className="profile-fn-title">{t('telemetry_hub_title')}</span>
            </div>
            <ChevronRight size={18} strokeWidth={2.5} className="text-[#5F7A63]" />
          </button>
        ) : null}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex w-full items-center space-x-2.5 px-4 py-3 transition hover:bg-white/70"
      >
        <LogOut size={18} strokeWidth={2} className="text-[#000000]" />
        <span className="profile-fn-title">{t('profile_logout')}</span>
      </button>
    </div>
  );
};
