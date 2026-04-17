// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/profile/README.md
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { purchase } from '@payment';
import { useAuthStore } from '../../store/useAuthStore';
import { MembershipPurchaseModal } from '../../components/membership/MembershipPurchaseModal';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePurchase = async (planId: 'monthly' | 'yearly') => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const paymentPlan = planId === 'yearly' ? 'annual' : 'monthly';
      const result = await purchase(paymentPlan);
      if (!result.success) {
        window.alert(t(resolvePaymentResultKey(result.code)));
        return;
      }
      await useAuthStore.getState().initialize();
      window.alert(t('upgrade_purchase_success'));
      navigate('/profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative h-full w-full">
      <MembershipPurchaseModal
        isOpen
        onClose={() => navigate(-1)}
        onPurchase={handlePurchase}
        ctaLabel={isSubmitting ? t('upgrade_processing') : t('membership_purchase_cta')}
      />
    </div>
  );
};
