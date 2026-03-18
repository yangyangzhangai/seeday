import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/useAuthStore';

export const DailyGoalToggle: React.FC = () => {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useAuthStore();
  const enabled = preferences.dailyGoalEnabled;

  return (
    <div className="bg-white rounded-2xl shadow-sm px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800">{t('profile_daily_goal')}</p>
          <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{t('profile_daily_goal_desc')}</p>
        </div>
        <button
          onClick={() => updatePreferences({ dailyGoalEnabled: !enabled })}
          className={`relative inline-flex w-9 h-5 flex-shrink-0 items-center rounded-full transition-colors ${
            enabled ? 'bg-blue-500' : 'bg-gray-300'
          }`}
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
