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
        background: 'linear-gradient(132deg, #f5f3ff 0%, #ecebff 38%, #dff0ff 100%)',
        backdropFilter: 'blur(22px) saturate(145%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        border: 'none',
        boxShadow: '0 8px 22px rgba(90,116,199,0.14)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -26,
          right: -22,
          width: 132,
          height: 132,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,101,255,0.42) 0%, rgba(124,101,255,0.12) 45%, rgba(124,101,255,0) 76%)',
          filter: 'blur(0.5px)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 22,
          bottom: -30,
          width: 180,
          height: 100,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(129,180,255,0.34) 0%, rgba(129,180,255,0.08) 48%, rgba(129,180,255,0) 78%)',
        }}
      />

      <div className="relative z-[1] flex flex-col items-center">
        <div className="mb-3 flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #5e4be7 0%, #4058d5 52%, #4c8dff 100%)',
              border: 'none',
              boxShadow: '0 0 10px rgba(95,118,244,0.34)',
            }}
          >
            <Crown size={16} color="#f6f9ff" />
          </div>
          <span className="text-[13px] font-extrabold text-[#3f43aa]">{t('profile_membership')}</span>
          <span
            className="rounded-full px-2 py-[2px] text-[9px] font-bold tracking-[0.06em]"
            style={{
              background: isPlus
                ? 'linear-gradient(135deg, #5242de 0%, #4156da 56%, #4f8fff 100%)'
                : 'rgba(255,255,255,0.66)',
              color: isPlus ? '#f4f8ff' : '#6b7280',
              border: 'none',
              boxShadow: isPlus ? '0 5px 12px rgba(75,96,223,0.3), inset 0 1px 1px rgba(240,246,255,0.78)' : 'none',
            }}
          >
            {isPlus ? 'PLUS' : 'FREE'}
          </span>
        </div>
        <div className="mb-4 grid w-full grid-cols-2 gap-x-4 gap-y-1.5">
          {FEATURES.map(({ labelKey, free }) => {
            const unlocked = free || isPlus;
            return (
              <div
                key={labelKey}
                className="flex items-center justify-center gap-1.5 rounded-full px-2 py-1"
                style={{
                  background: unlocked ? 'rgba(255,255,255,0.46)' : 'rgba(255,255,255,0.28)',
                  border: '1px solid rgba(255,255,255,0.55)',
                }}
              >
                {unlocked ? (
                  <Check
                    size={12}
                    style={{
                      color: '#4c61d8',
                      flexShrink: 0,
                      filter: 'drop-shadow(0 0 3px rgba(95,132,255,0.85)) drop-shadow(0 0 6px rgba(95,132,255,0.45))',
                    }}
                  />
                ) : (
                  <Lock size={12} style={{ color: 'rgba(95,102,157,0.45)', flexShrink: 0 }} />
                )}
                <span
                  className="text-[11px] leading-tight"
                  style={{ color: unlocked ? '#3d4f9f' : 'rgba(98,107,147,0.72)' }}
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
              background: 'linear-gradient(130deg, rgba(132,117,255,0.22) 0%, rgba(131,209,255,0.34) 100%)',
              boxShadow: '0 6px 18px rgba(90,116,199,0.24), inset 0 1px 1px rgba(255,255,255,0.78)',
              color: '#3746b0',
              border: '1px solid rgba(255,255,255,0.82)',
            }}
          >
            {t('profile_upgrade')}
          </button>
        ) : (
          <div className="flex w-full items-center justify-center gap-1.5">
            <div
              className="h-px flex-1"
              style={{
                background: 'linear-gradient(90deg, rgba(117,123,209,0.08) 0%, rgba(117,123,209,0.85) 100%)',
                boxShadow: '0 0 7px rgba(113,128,243,0.6)',
              }}
            />
            <span className="text-[10px] font-semibold tracking-[0.08em] text-[#4751be]">ACTIVE</span>
            <div
              className="h-px flex-1"
              style={{
                background: 'linear-gradient(90deg, rgba(117,123,209,0.85) 0%, rgba(117,123,209,0.08) 100%)',
                boxShadow: '0 0 7px rgba(113,128,243,0.6)',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
