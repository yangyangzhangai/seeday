import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/useAuthStore';
import { triggerLightHaptic } from '../../../lib/haptics';

export const DailyGoalToggle: React.FC = () => {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useAuthStore();
  const enabled = preferences.dailyGoalEnabled;
  const enabledSwitchStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #D8EEDE 0%, #B8DEC7 100%)',
    boxShadow: '0 5px 12px rgba(103,154,121,0.22), inset 0 1px 0 rgba(255,255,255,0.68)',
    border: 'none',
  };

  return (
    <div className="rounded-[1.5rem] border border-white/65 bg-[#F7F9F8] px-4 py-2.5 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800">{t('profile_daily_goal')}</p>
          <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{t('profile_daily_goal_desc')}</p>
        </div>
        <button
          onClick={() => {
            triggerLightHaptic();
            updatePreferences({ dailyGoalEnabled: !enabled });
          }}
          className={`relative inline-flex w-9 h-5 flex-shrink-0 items-center rounded-full border transition-colors ${
            enabled ? 'border-transparent' : 'border-transparent bg-slate-300'
          }`}
          style={enabled ? enabledSwitchStyle : undefined}
        >
          <span
            className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
              enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );
};
