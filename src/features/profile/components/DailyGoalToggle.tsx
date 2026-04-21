import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Flag } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { triggerLightHaptic } from '../../../lib/haptics';

interface Props {
  plain?: boolean;
}

export const DailyGoalToggle: React.FC<Props> = ({ plain = false }) => {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useAuthStore();
  const enabled = preferences.dailyGoalEnabled;

  return (
    <div className={plain ? 'px-4 py-2.5' : 'rounded-2xl border border-white/65 bg-[#F7F9F8] px-4 py-2.5 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]'}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start space-x-2.5">
            <Flag size={16} strokeWidth={1.5} className="mt-0.5 text-[#5F7A63]" />
            <div className="min-w-0">
              <p className="profile-fn-title">{t('profile_daily_goal')}</p>
              <p className="mt-0.5 text-[10px] font-light leading-tight text-slate-500">{t('profile_daily_goal_desc')}</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            triggerLightHaptic();
            updatePreferences({ dailyGoalEnabled: !enabled });
          }}
          className="relative w-9 h-5 rounded-full border border-transparent transition-colors"
          style={enabled ? { background: 'linear-gradient(135deg, #C8EDD8 0%, #A5D4B8 100%)' } : { background: '#cbd5e1' }}
        >
          <motion.div
            animate={{ x: enabled ? 16 : 2 }}
            className="absolute left-0 w-4 h-4 rounded-full bg-white shadow-sm"
            style={{ top: '50%', marginTop: '-8px' }}
          />
        </button>
      </div>
    </div>
  );
};
