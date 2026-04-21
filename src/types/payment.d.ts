// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/MEMBERSHIP_SPEC.md
declare module '@payment' {
  import type { PaymentActionResult, PaymentPlan, PaymentPlanType } from '../services/payment/types';

  export function listPlans(): PaymentPlan[];
  export function getPaymentSource(): 'iap' | 'stripe';
  export function canRestorePurchase(): boolean;
  export function getPendingCheckoutSessionId(): string | null;
  export function clearPendingCheckoutSession(): void;
  export function finalizePendingCheckout(sessionId: string): Promise<PaymentActionResult>;
  export function purchase(plan: PaymentPlanType): Promise<PaymentActionResult>;
  export function restorePurchase(): Promise<PaymentActionResult>;
}
