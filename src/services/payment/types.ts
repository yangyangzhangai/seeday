// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/MEMBERSHIP_SPEC.md
export type PaymentPlanType = 'monthly' | 'annual';
export type PaymentSource = 'iap' | 'stripe';
export type SubscriptionAction = 'activate' | 'restore' | 'cancel';

export interface SubscriptionPayload {
  transactionId: string;
  productId: string;
  originalTransactionId?: string;
}

export interface PaymentPlan {
  id: PaymentPlanType;
  priceLabel: string;
  description: string;
  isIntro?: boolean;
}

export interface PaymentActionResult {
  success: boolean;
  code?: string;
  plan?: 'free' | 'plus';
  expiresAt?: string | null;
  message?: string;
}
