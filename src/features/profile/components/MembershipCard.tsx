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
    <div className="rounded-[1.5rem] border border-white/65 bg-[#F7F9F8] px-4 py-3 text-slate-800 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]">
      {/* Title + badge */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-bold">{t('profile_membership')}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            isPlus
              ? 'bg-[#FFEC9C] text-[#7b6020]'
              : 'bg-slate-200 text-slate-600'
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
                <Check size={11} className="flex-shrink-0 text-[#5F7A63]" />
              ) : (
                <Circle size={11} className="flex-shrink-0 text-slate-300" />
              )}
              <span className={`text-[11px] ${unlocked ? 'text-slate-700' : 'text-slate-400'}`}>
                {t(labelKey)}
              </span>
            </div>
          );
        })}
      </div>

      {!isPlus && (
        <button
          onClick={() => showToast(t('profile_upgrade_coming'))}
          className="w-full rounded-[17px] bg-[#FFEC9C]/70 py-2 text-xs font-semibold text-slate-800 shadow-[0px_2px_2px_#C8C8C8] transition hover:bg-[#FFEC9C]/90"
        >
          {t('profile_upgrade')}
        </button>
      )}
    </div>
  );
};
