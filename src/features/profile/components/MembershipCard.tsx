import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Lock, Crown } from 'lucide-react';

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
    <div
      className="relative overflow-hidden rounded-[1.5rem] px-4 py-4"
      style={{
        background: '#F7F9F8',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        border: 'none',
      }}
    >
      <div className="relative z-[1] flex flex-col items-center">
        <div className="mb-3 flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{
              background: '#F7F9F8',
              border: '1px solid rgba(255,255,255,0.7)',
            }}
          >
            <Crown size={16} color="#5F7A63" />
          </div>
          <span className="text-[13px] font-extrabold text-[#1e293b]">{t('profile_membership')}</span>
          <span
            className="rounded-full px-2 py-[2px] text-[9px] font-bold tracking-[0.06em]"
            style={{
              background: '#F7F9F8',
              color: isPlus ? '#3f5f35' : '#64748b',
              border: '1px solid rgba(255,255,255,0.7)',
            }}
          >
            {isPlus ? 'PLUS' : 'FREE'}
          </span>
        </div>
        <div className="mb-4 grid w-full grid-cols-2 gap-x-4 gap-y-1.5">
          {FEATURES.map(({ labelKey, free }) => {
            const unlocked = free || isPlus;
            return (
              <div key={labelKey} className="flex items-center justify-center gap-1.5">
                {unlocked ? (
                  <Check size={12} style={{ color: '#5F7A63', flexShrink: 0 }} />
                ) : (
                  <Lock size={12} style={{ color: 'rgba(95,122,99,0.45)', flexShrink: 0 }} />
                )}
                <span
                  className="text-[11px] leading-tight"
                  style={{ color: unlocked ? '#334155' : 'rgba(100,116,139,0.7)' }}
                >
                  {t(labelKey)}
                </span>
              </div>
            );
          })}
        </div>

        {!isPlus ? (
          <button
            onClick={() => showToast(t('profile_upgrade_coming'))}
            className="relative w-full overflow-hidden rounded-[17px] py-[11px] text-[13px] font-extrabold transition-all active:scale-[0.97]"
            style={{
              background: 'rgba(252,241,200,0.72)',
              boxShadow: '0px 2px 2px #C8C8C8, inset 0 1px 1px rgba(255,255,255,0.72)',
              color: '#1e293b',
            }}
          >
            {t('profile_upgrade')}
          </button>
        ) : (
          <div className="flex w-full items-center justify-center gap-1.5">
            <div className="h-px flex-1" style={{ background: 'rgba(100,116,139,0.18)' }} />
            <span className="text-[10px] font-semibold tracking-[0.08em] text-[#5F7A63]">ACTIVE</span>
            <div className="h-px flex-1" style={{ background: 'rgba(100,116,139,0.18)' }} />
          </div>
        )}
      </div>
    </div>
  );
};
