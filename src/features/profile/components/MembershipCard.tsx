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
      className="rounded-2xl px-5 py-4"
      style={{
        background: 'linear-gradient(145deg, #16100A 0%, #251A09 35%, #1C1408 60%, #0E0907 100%)',
        border: '1px solid rgba(212,175,55,0.18)',
      }}
    >

      {/* Title + badge */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Crown size={14} color="#D4AF37" />
          <span
            className="text-[13px] font-bold"
            style={{ color: '#F0DEB0', letterSpacing: '0.08em' }}
          >
            {t('profile_membership')}
          </span>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
          style={
            isPlus
              ? {
                  background: 'linear-gradient(135deg, #C8921A 0%, #F0C830 50%, #E8B820 100%)',
                  color: '#1A0E00',
                  letterSpacing: '0.12em',
                }
              : {
                  background: 'rgba(255,255,255,0.07)',
                  color: '#B0A088',
                  border: '1px solid rgba(255,255,255,0.12)',
                  letterSpacing: '0.12em',
                }
          }
        >
          {isPlus ? 'PLUS' : 'FREE'}
        </span>
      </div>

      {/* divider */}
      <div className="mb-3 h-px" style={{ background: 'rgba(212,175,55,0.15)' }} />

      {/* Features grid */}
      <div className="mb-4 grid grid-cols-2 gap-x-3 gap-y-2">
        {FEATURES.map(({ labelKey, free }) => {
          const unlocked = free || isPlus;
          return (
            <div key={labelKey} className="flex items-center space-x-1.5">
              {unlocked ? (
                <Check size={10} style={{ color: '#D4AF37', flexShrink: 0 }} />
              ) : (
                <Lock size={10} style={{ color: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
              )}
              <span
                className="text-[11px] leading-tight"
                style={{ color: unlocked ? '#EDD9A8' : 'rgba(255,255,255,0.25)' }}
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
          className="relative w-full overflow-hidden rounded-xl py-2.5 text-xs font-bold transition-all active:scale-[0.97]"
          style={{
            background: 'linear-gradient(135deg, #C8921A 0%, #F0C830 50%, #E8B820 100%)',
            color: '#1A0E00',
            letterSpacing: '0.08em',
          }}
        >
          {t('profile_upgrade')}
        </button>
      ) : (
        <div className="flex items-center justify-center space-x-1.5">
          <div className="h-px flex-1" style={{ background: 'rgba(212,175,55,0.15)' }} />
          <span className="text-[10px]" style={{ color: 'rgba(212,175,55,0.5)', letterSpacing: '0.12em' }}>
            ACTIVE
          </span>
          <div className="h-px flex-1" style={{ background: 'rgba(212,175,55,0.15)' }} />
        </div>
      )}
    </div>
  );
};
