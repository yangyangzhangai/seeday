import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  APP_SELECTED_GLOW_BG,
  APP_SELECTED_GLOW_BORDER,
  APP_SELECTED_GLOW_SHADOW,
} from '../../../lib/modalTheme';

export const DailyGoalToggle: React.FC = () => {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useAuthStore();
  const enabled = preferences.dailyGoalEnabled;
  const selectedGlowStyle: React.CSSProperties = {
    background: APP_SELECTED_GLOW_BG,
    border: APP_SELECTED_GLOW_BORDER,
    boxShadow: APP_SELECTED_GLOW_SHADOW,
  };

  return (
    <div className="rounded-[1.5rem] border border-white/65 bg-[#F7F9F8] px-4 py-2.5 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800">{t('profile_daily_goal')}</p>
          <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{t('profile_daily_goal_desc')}</p>
        </div>
        <button
          onClick={() => updatePreferences({ dailyGoalEnabled: !enabled })}
          className={`relative inline-flex w-9 h-5 flex-shrink-0 items-center rounded-full border transition-colors ${
            enabled ? '' : 'border-transparent bg-slate-300'
          }`}
          style={enabled ? selectedGlowStyle : undefined}
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
