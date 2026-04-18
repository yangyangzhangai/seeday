import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Crown } from 'lucide-react';
import { purchase } from '@payment';
import { useAuthStore } from '../../../store/useAuthStore';
import { isEligibleForMembershipTrial } from '../membershipTrialEligibility';

const MEMBERSHIP_PURPLE = '#a855f7';
const MEMBERSHIP_PURPLE_DEEP = '#9333ea';
const MEMBERSHIP_PINK = '#ec4899';
const MEMBERSHIP_TEXT = '#7e22ce';
const MEMBERSHIP_ICON = '#a855f7';

export const MEMBERSHIP_FEATURES = [
  { labelKey: 'membership_feat_basic_analysis', free: true },
  { labelKey: 'membership_feat_ai_chat', free: true },
  { labelKey: 'membership_feat_daily_plant', free: true },
  { labelKey: 'membership_feat_daily_report', free: false },
  { labelKey: 'membership_feat_monthly_report', free: false },
  { labelKey: 'membership_feat_advanced_analysis', free: false },
  { labelKey: 'membership_feat_ai_memory', free: false },
  { labelKey: 'membership_feat_weekly_report', free: false },
  { labelKey: 'membership_feat_yearly_report', free: false },
];

interface Props {
  isPlus: boolean;
}

export const MembershipCard: React.FC<Props> = ({ isPlus }) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const user = useAuthStore((state) => state.user);
  const initializeAuth = useAuthStore((state) => state.initialize);
  const showTrialCta = isEligibleForMembershipTrial(user, isPlus);

  const handleDirectUpgrade = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await purchase('monthly');
      if (!result.success) {
        const code = result.code;
        const errorKey = !code
          ? 'upgrade_error_generic'
          : code === 'iap_client_not_ready'
            ? 'upgrade_error_iap_not_ready'
            : code === 'subscription_failed'
              ? 'upgrade_error_subscription_failed'
              : code === 'activate_failed'
                ? 'upgrade_error_activate_failed'
                : code === 'restore_failed'
                  ? 'upgrade_error_restore_failed'
                  : code === 'stripe_not_ready'
                    ? 'upgrade_error_stripe_not_ready'
                    : code === 'stripe_not_supported'
                      ? 'upgrade_error_stripe_not_supported'
                      : 'upgrade_error_generic';
        window.alert(t(errorKey));
        return;
      }

      await initializeAuth();
      window.alert(t('upgrade_purchase_success'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl px-4 py-4"
      style={{
        background:
          'linear-gradient(132deg, #fcf9ff 0%, #f6f0ff 24%, #f8f2ff 52%, #fef8fc 100%)',
        backdropFilter: 'blur(22px) saturate(145%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        border: '1px solid rgba(168,85,247,0.22)',
        boxShadow: '0 10px 28px rgba(168,85,247,0.16)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(118deg, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0.38) 34%, rgba(255,255,255,0.16) 62%, rgba(255,255,255,0.34) 100%), linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.08) 44%, rgba(168,85,247,0.08) 100%), linear-gradient(90deg, rgba(168,85,247,0.04) 0%, rgba(236,72,153,0.05) 100%)',
        }}
      />

      <div className="relative z-[1] flex flex-col items-center">
        <div className="mb-3 flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden"
            style={{
              background: `linear-gradient(145deg, ${MEMBERSHIP_PURPLE_DEEP} 0%, ${MEMBERSHIP_PURPLE} 58%, ${MEMBERSHIP_PINK} 100%)`,
              border: 'none',
              boxShadow: '0 0 14px rgba(168,85,247,0.40)',
            }}
          >
            <Crown size={16} strokeWidth={1.5} color="#f6f9ff" />
          </div>
          <span className="profile-fn-title">{t('profile_membership')}</span>
          <span
            className="rounded-full px-2 py-[2px] text-[9px] font-bold tracking-[0.06em]"
            style={{
              background: isPlus
                ? `linear-gradient(135deg, ${MEMBERSHIP_PURPLE_DEEP} 0%, ${MEMBERSHIP_PURPLE} 56%, ${MEMBERSHIP_PINK} 100%)`
                : 'rgba(255,255,255,0.66)',
              color: isPlus ? '#f4f8ff' : '#6b7280',
              border: 'none',
              boxShadow: isPlus ? '0 5px 12px rgba(168,85,247,0.3), inset 0 1px 1px rgba(240,246,255,0.78)' : 'none',
            }}
          >
            {isPlus ? 'PRO' : 'FREE'}
          </span>
        </div>
        <div className="mb-4 grid w-full grid-cols-2 gap-x-4 gap-y-1.5">
          {MEMBERSHIP_FEATURES.map(({ labelKey, free }) => {
            const unlocked = free || isPlus;
            return (
              <div
                key={labelKey}
                className="flex items-center justify-center gap-1.5 rounded-full px-2 py-1"
                style={{
                  background: unlocked ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.38)',
                  border: unlocked ? '1px solid rgba(168,85,247,0.20)' : '1px solid rgba(255,255,255,0.58)',
                }}
              >
                {unlocked ? (
                  <Check
                    size={12}
                    strokeWidth={1.5}
                    style={{
                      color: MEMBERSHIP_ICON,
                      flexShrink: 0,
                      filter: 'drop-shadow(0 0 3px rgba(168,85,247,0.85)) drop-shadow(0 0 6px rgba(168,85,247,0.45))',
                    }}
                  />
                ) : (
                  <span aria-hidden style={{ width: 12, height: 12, display: 'inline-block', flexShrink: 0 }} />
                )}
                <span
                  className="text-xs leading-tight"
                  style={{ color: unlocked ? MEMBERSHIP_TEXT : '#545f78' }}
                >
                  {t(labelKey)}
                </span>
              </div>
            );
          })}
        </div>

        {!isPlus ? (
          <button
            onClick={() => { void handleDirectUpgrade(); }}
            disabled={isSubmitting}
            className="relative w-full overflow-hidden rounded-xl min-h-[44px] py-[11px] text-sm font-extrabold transition-all active:scale-[0.97]"
            style={{
              background: 'linear-gradient(130deg, rgba(147,51,234,0.56) 0%, rgba(168,85,247,0.5) 58%, rgba(236,72,153,0.48) 100%)',
              boxShadow: '0 4px 12px rgba(168,85,247,0.14)',
              color: 'rgba(248,250,255,0.94)',
              border: '0.5px solid rgba(255,255,255,0.84)',
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            {isSubmitting
              ? t('upgrade_processing')
              : (showTrialCta ? t('profile_upgrade_trial') : t('profile_upgrade'))}
          </button>
        ) : (
          <div className="flex w-full items-center justify-center gap-1.5">
            <div
              className="h-px flex-1"
              style={{
                background: 'linear-gradient(90deg, rgba(168,85,247,0.08) 0%, rgba(168,85,247,0.85) 100%)',
                boxShadow: '0 0 7px rgba(168,85,247,0.55)',
              }}
            />
            <span className="text-[10px] font-semibold tracking-[0.08em]" style={{ color: MEMBERSHIP_TEXT }}>ACTIVE</span>
            <div
              className="h-px flex-1"
              style={{
                background: 'linear-gradient(90deg, rgba(168,85,247,0.85) 0%, rgba(168,85,247,0.08) 100%)',
                boxShadow: '0 0 7px rgba(168,85,247,0.55)',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
