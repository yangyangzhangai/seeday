// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/MEMBERSHIP_SPEC.md
import type { PaymentActionResult, PaymentPlan, PaymentPlanType } from '../types';

const STRIPE_PLANS: PaymentPlan[] = [
  { id: 'monthly', priceLabel: '$7.99', description: 'Intro monthly', isIntro: true },
  { id: 'annual', priceLabel: '$99.99', description: 'Annual plan' },
];

export function listPlans(): PaymentPlan[] {
  return STRIPE_PLANS;
}

export function getPaymentSource(): 'iap' | 'stripe' {
  return 'stripe';
}

export function canRestorePurchase(): boolean {
  return false;
}

export async function purchase(_plan: PaymentPlanType): Promise<PaymentActionResult> {
  return { success: false, code: 'stripe_not_ready', message: 'coming_soon' };
}

export async function restorePurchase(): Promise<PaymentActionResult> {
  return { success: false, code: 'stripe_not_supported', message: 'coming_soon' };
}
