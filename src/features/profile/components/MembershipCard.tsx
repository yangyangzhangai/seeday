import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Circle } from 'lucide-react';

const FEATURES = [
  { labelKey: 'membership_feat_basic_analysis', free: true },
  { labelKey: 'membership_feat_daily_plant', free: true },
  { labelKey: 'membership_feat_ai_chat', free: true },
  { labelKey: 'membership_feat_advanced_analysis', free: false },
  { labelKey: 'membership_feat_daily_report', free: false },
  { labelKey: 'membership_feat_weekly_report', free: false },
  { labelKey: 'membership_feat_monthly_report', free: false },
  { labelKey: 'membership_feat_yearly_report', free: false },
];

interface Props {
  isPlus: boolean;
}

function showToast(msg: string) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText =
    'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 16px;border-radius:20px;font-size:14px;z-index:9999;pointer-events:none;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

export const MembershipCard: React.FC<Props> = ({ isPlus }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-gradient-to-br from-[#2D3748] to-[#1A202C] text-white rounded-2xl px-4 py-3">
      {/* Title + badge */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-bold">{t('profile_membership')}</span>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isPlus
              ? 'bg-yellow-400 text-yellow-900'
              : 'bg-white/20 text-white/80'
          }`}
        >
          {isPlus ? 'PLUS' : 'FREE'}
        </span>
      </div>

      {/* Features grid */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {FEATURES.map(({ labelKey, free }) => {
          const unlocked = free || isPlus;
          return (
            <div key={labelKey} className="flex items-center space-x-1.5">
              {unlocked ? (
                <Check size={11} className="text-green-400 flex-shrink-0" />
              ) : (
                <Circle size={11} className="text-white/30 flex-shrink-0" />
              )}
              <span className={`text-[11px] ${unlocked ? 'text-white' : 'text-white/40'}`}>
                {t(labelKey)}
              </span>
            </div>
          );
        })}
      </div>

      {!isPlus && (
        <button
          onClick={() => showToast(t('profile_upgrade_coming'))}
          className="w-full py-2 rounded-xl bg-white/20 backdrop-blur text-white text-xs font-medium hover:bg-white/30 transition"
        >
          {t('profile_upgrade')}
        </button>
      )}
    </div>
  );
};
