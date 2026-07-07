// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/MEMBERSHIP_SPEC.md
import { callStripeCheckoutAPI, callStripeFinalizeAPI } from '../../../api/client';
import { formatUserFacingDiagnostic, logDiagnostic } from '../../../lib/diagnostics';
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

export function getPendingCheckoutSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const source = params.get('payment_source');
  const sessionId = params.get('stripe_session_id');
  if (source !== 'stripe' || !sessionId) return null;
  return sessionId.trim() || null;
}

export function clearPendingCheckoutSession(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('payment_source');
  url.searchParams.delete('stripe_session_id');
  url.searchParams.delete('stripe_cancelled');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export async function purchase(plan: PaymentPlanType): Promise<PaymentActionResult> {
  const startedAt = Date.now();
  logDiagnostic('info', 'stripe.checkout.start', { plan });
  try {
    const response = await callStripeCheckoutAPI(plan);
    logDiagnostic(response.success ? 'info' : 'warn', 'stripe.checkout.done', {
      plan,
      elapsedMs: Date.now() - startedAt,
      success: response.success,
      hasCheckoutUrl: Boolean(response.checkoutUrl),
    });
    if (!response.success || !response.checkoutUrl) {
      return { success: false, code: 'activate_failed', message: 'activate_failed' };
    }

    window.location.assign(response.checkoutUrl);
    return { success: false, code: 'payment_redirect', message: 'payment_redirect' };
  } catch (error) {
    const message = formatUserFacingDiagnostic('Stripe checkout', error, {
      path: 'stripe.checkout',
      elapsedMs: Date.now() - startedAt,
    });
    logDiagnostic('error', 'stripe.checkout.failed', {
      plan,
      elapsedMs: Date.now() - startedAt,
      error,
      userFacing: message,
    });
    return { success: false, code: 'subscription_failed', message };
  }
}

export async function finalizePendingCheckout(sessionId: string): Promise<PaymentActionResult> {
  const startedAt = Date.now();
  logDiagnostic('info', 'stripe.finalize.start', {
    hasSessionId: Boolean(sessionId),
  });
  try {
    const response = await callStripeFinalizeAPI(sessionId);
    logDiagnostic(response.success ? 'info' : 'warn', 'stripe.finalize.done', {
      elapsedMs: Date.now() - startedAt,
      success: response.success,
      plan: response.plan,
      expiresAt: response.expiresAt,
    });
    return {
      success: response.success,
      plan: response.plan,
      expiresAt: response.expiresAt,
      code: response.success ? 'ok' : 'activate_failed',
      message: response.success ? undefined : 'activate_failed',
    };
  } catch (error) {
    const message = formatUserFacingDiagnostic('Stripe finalize', error, {
      path: 'stripe.finalize',
      elapsedMs: Date.now() - startedAt,
    });
    logDiagnostic('error', 'stripe.finalize.failed', {
      elapsedMs: Date.now() - startedAt,
      error,
      userFacing: message,
    });
    return { success: false, code: 'subscription_failed', message };
  }
}

export async function restorePurchase(): Promise<PaymentActionResult> {
  return { success: false, code: 'stripe_not_supported', message: 'coming_soon' };
}
