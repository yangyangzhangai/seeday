// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/profile/README.md
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  canRestorePurchase,
  getPaymentSource,
  listPlans,
  purchase,
  restorePurchase,
} from '@payment';
import type { PaymentPlanType } from '../../services/payment/types';
import { MEMBERSHIP_FEATURES } from './components/MembershipCard';
import { useAuthStore } from '../../store/useAuthStore';

function resolvePaymentResultKey(code: string | undefined): string {
  if (!code) return 'upgrade_error_generic';
  if (code === 'iap_client_not_ready') return 'upgrade_error_iap_not_ready';
  if (code === 'subscription_failed') return 'upgrade_error_subscription_failed';
  if (code === 'activate_failed') return 'upgrade_error_activate_failed';
  if (code === 'restore_failed') return 'upgrade_error_restore_failed';
  if (code === 'stripe_not_ready') return 'upgrade_error_stripe_not_ready';
  if (code === 'stripe_not_supported') return 'upgrade_error_stripe_not_supported';
  return 'upgrade_error_generic';
}

export const UpgradePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlanType>('monthly');
  const [loadingAction, setLoadingAction] = useState<'purchase' | 'restore' | null>(null);
  const plans = useMemo(() => listPlans(), []);
  const paymentSource = getPaymentSource();

  const selectedPlanInfo = plans.find((plan) => plan.id === selectedPlan);

  const handlePurchase = async () => {
    setLoadingAction('purchase');
    try {
      const result = await purchase(selectedPlan);
      if (!result.success) {
        window.alert(t(resolvePaymentResultKey(result.code)));
        return;
      }
      await useAuthStore.getState().initialize();
      window.alert(t('upgrade_purchase_success'));
      navigate('/profile');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRestore = async () => {
    setLoadingAction('restore');
    try {
      const result = await restorePurchase();
      if (!result.success) {
        window.alert(t(resolvePaymentResultKey(result.code)));
        return;
      }
      await useAuthStore.getState().initialize();
      window.alert(t('upgrade_restore_success'));
      navigate('/profile');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="relative flex h-full items-center justify-center bg-transparent px-0 md:px-8">
      <div className="app-mobile-page-frame app-scroll-container relative h-full w-full max-w-[430px] text-slate-900 [box-shadow:0_0_0_1px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.1)] md:h-[calc(100%-24px)] md:max-w-[760px] md:rounded-[30px] md:border md:border-white/70 md:bg-[#fcfaf7]/85 md:[box-shadow:0_0_0_1px_rgba(255,255,255,0.45),0_24px_64px_rgba(15,23,42,0.12)]">
        <header
          className="app-mobile-page-header sticky top-0 z-10 px-4 pb-3 pt-11"
          style={{
            background: 'rgba(252,250,247,0.6)',
            backdropFilter: 'blur(14px) saturate(150%)',
            WebkitBackdropFilter: 'blur(14px) saturate(150%)',
          }}
        >
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="rounded-full p-1.5 active:opacity-70" aria-label={t('upgrade_back')}>
              <ChevronLeft size={24} strokeWidth={1.5} />
            </button>
            <h1 className="text-2xl font-extrabold text-[#1e293b]" style={{ letterSpacing: '-0.02em' }}>
              {t('upgrade_title')}
            </h1>
          </div>
        </header>

        <div className="space-y-4 px-4 py-4 pb-28">
          <section className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">{t('upgrade_plan_label')}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(['monthly', 'annual'] as PaymentPlanType[]).map((plan) => {
                const active = plan === selectedPlan;
                return (
                  <button
                    key={plan}
                    onClick={() => setSelectedPlan(plan)}
                    className="rounded-xl border px-3 py-3 text-left transition active:scale-[0.98]"
                    style={{
                      borderColor: active ? '#5a67d8' : 'rgba(148, 163, 184, 0.35)',
                      background: active ? 'linear-gradient(145deg, rgba(90,103,216,0.12), rgba(14,165,233,0.12))' : 'rgba(255,255,255,0.7)',
                    }}
                  >
                    <p className="text-xs font-semibold text-[#475569]">{t(`upgrade_plan_${plan}`)}</p>
                    <p className="mt-1 text-base font-extrabold text-[#1e293b]">
                      {plan === 'monthly' ? t('upgrade_price_monthly') : t('upgrade_price_annual')}
                    </p>
                    {plan === 'monthly' ? (
                      <p className="mt-1 text-xs text-[#64748b]">{t('upgrade_price_monthly_note')}</p>
                    ) : (
                      <p className="mt-1 text-xs text-[#64748b]">{t('upgrade_price_annual_note')}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">{t('upgrade_feature_label')}</p>
            <div className="mt-3 space-y-2">
              {MEMBERSHIP_FEATURES.map((feature) => (
                <div key={feature.labelKey} className="flex items-center gap-2 text-sm text-[#334155]">
                  <Check size={16} strokeWidth={1.5} className="text-[#4f46e5]" />
                  <span>{t(feature.labelKey)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm">
            <p className="text-xs text-[#64748b]">{t('upgrade_payment_source', { source: paymentSource.toUpperCase() })}</p>
            <button
              onClick={handlePurchase}
              disabled={loadingAction !== null}
              className="mt-3 w-full rounded-xl min-h-[44px] bg-[#4f46e5] px-4 py-3 text-sm font-bold text-white transition disabled:opacity-50 active:scale-[0.99]"
            >
              {loadingAction === 'purchase'
                ? t('upgrade_processing')
                : t('upgrade_continue_button', { price: selectedPlanInfo?.priceLabel || '' })}
            </button>

            {canRestorePurchase() ? (
              <button
                onClick={handleRestore}
                disabled={loadingAction !== null}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl min-h-[44px] border border-[#cbd5e1] bg-white px-4 py-2.5 text-xs font-semibold text-[#475569] transition disabled:opacity-50 active:scale-[0.99]"
              >
                <RefreshCw size={16} strokeWidth={1.5} />
                {loadingAction === 'restore' ? t('upgrade_processing') : t('upgrade_restore_button')}
              </button>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
};
