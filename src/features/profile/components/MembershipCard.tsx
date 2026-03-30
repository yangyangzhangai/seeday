import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Circle } from 'lucide-react';

const FEATURES = [
  { labelKey: 'membership_feat_basic_analysis', free: true },
  { labelKey: 'membership_feat_ai_chat', free: true },
  { labelKey: 'membership_feat_daily_report', free: false },
  { labelKey: 'membership_feat_monthly_report', free: false },
  { labelKey: 'membership_feat_daily_plant', free: true },
  { labelKey: 'membership_feat_advanced_analysis', free: false },
  { labelKey: 'membership_feat_weekly_report', free: false },
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
    <div className="rounded-[1.5rem] border border-[#E3C778]/65 bg-[linear-gradient(145deg,#B6862A_0%,#8A6520_52%,#6D4F1A_100%)] px-4 py-3 text-[#FFF6D8] [box-shadow:inset_0_1px_1px_rgba(255,244,214,0.38),0_10px_24px_rgba(109,79,26,0.28)]">
      {/* Title + badge */}
      <div className="relative mb-2.5 flex items-center justify-center">
        <span className="text-sm font-bold tracking-[0.06em]">{t('profile_membership')}</span>
        <span
          className={`absolute right-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            isPlus
              ? 'bg-[#FFEC9C] text-[#7b6020]'
              : 'bg-[#F4E4B7] text-[#7a5a1f]'
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
                <Check size={11} className="flex-shrink-0 text-[#FDE68A]" />
              ) : (
                <Circle size={11} className="flex-shrink-0 text-[#F1DCA8]/60" />
              )}
              <span className={`text-[11px] ${unlocked ? 'text-[#FFF3CC]' : 'text-[#EBD9A8]/70'}`}>
                {t(labelKey)}
              </span>
            </div>
          );
        })}
      </div>

      {!isPlus && (
        <button
          onClick={() => showToast(t('profile_upgrade_coming'))}
          className="w-full rounded-[17px] bg-[#F9E3A0] py-2 text-xs font-semibold text-[#6B4B1A] shadow-[0px_2px_2px_rgba(109,79,26,0.35)] transition hover:bg-[#FFE8A8]"
        >
          {t('profile_upgrade')}
        </button>
      )}
    </div>
  );
};
