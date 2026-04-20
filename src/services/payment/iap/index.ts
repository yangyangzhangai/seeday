// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/MEMBERSHIP_SPEC.md
import { callSubscriptionAPI } from '../../../api/client';
import type { PaymentActionResult, PaymentPlan, PaymentPlanType } from '../types';

const IAP_PLANS: PaymentPlan[] = [
  { id: 'monthly', priceLabel: '$7.99', description: 'Intro monthly', isIntro: true },
  { id: 'annual', priceLabel: '$99.99', description: 'Annual plan' },
];

const IAP_PRODUCT_IDS: Record<PaymentPlanType, string> = {
  monthly: import.meta.env.VITE_IAP_PRODUCT_MONTHLY || 'seeday.pro.monthly',
  annual: import.meta.env.VITE_IAP_PRODUCT_ANNUAL || 'seeday.pro.annual',
};

interface IapTransactionLike {
  transactionId: string;
  originalTransactionId?: string;
  productId?: string;
}

interface IapBridge {
  purchaseProduct?: (params: { productId: string }) => Promise<IapTransactionLike | null | undefined>;
  restorePurchases?: () => Promise<
    IapTransactionLike
    | { transactions?: IapTransactionLike[] }
    | null
    | undefined
  >;
}

function getBridge(): IapBridge | null {
  const globalAny = window as unknown as {
    Capacitor?: { Plugins?: Record<string, unknown> };
  };
  const plugins = globalAny.Capacitor?.Plugins;
  if (!plugins) return null;
  return (plugins.SeedayIAP || plugins.IAP || null) as IapBridge | null;
}

function toActionResult(error: unknown): PaymentActionResult {
  const message = error instanceof Error ? error.message : 'subscription_failed';
  return {
    success: false,
    code: 'subscription_failed',
    message,
  };
}

function normalizeTransaction(raw: IapTransactionLike | null | undefined, fallbackProductId: string): IapTransactionLike | null {
  if (!raw || typeof raw.transactionId !== 'string' || !raw.transactionId.trim()) {
    return null;
  }
  return {
    transactionId: raw.transactionId.trim(),
    originalTransactionId: typeof raw.originalTransactionId === 'string' ? raw.originalTransactionId.trim() : undefined,
    productId: typeof raw.productId === 'string' && raw.productId.trim() ? raw.productId.trim() : fallbackProductId,
  };
}

async function runBridgePurchase(plan: PaymentPlanType): Promise<IapTransactionLike | null> {
  const bridge = getBridge();
  if (!bridge?.purchaseProduct) return null;
  const productId = IAP_PRODUCT_IDS[plan];
  const raw = await bridge.purchaseProduct({ productId });
  return normalizeTransaction(raw, productId);
}

async function runBridgeRestore(): Promise<IapTransactionLike | null> {
  const bridge = getBridge();
  if (!bridge?.restorePurchases) return null;
  const restored = await bridge.restorePurchases();
  if (!restored) return null;
  if ('transactionId' in restored) {
    return normalizeTransaction(restored, IAP_PRODUCT_IDS.monthly);
  }
  const transactions = Array.isArray(restored.transactions) ? restored.transactions : [];
  const latest = transactions.find((item) => typeof item?.transactionId === 'string' && item.transactionId.trim());
  return latest ? normalizeTransaction(latest, latest.productId || IAP_PRODUCT_IDS.monthly) : null;
}

export function listPlans(): PaymentPlan[] {
  return IAP_PLANS;
}

export function getPaymentSource(): 'iap' | 'stripe' {
  return 'iap';
}

export function canRestorePurchase(): boolean {
  return true;
}

export function getPendingCheckoutSessionId(): string | null {
  return null;
}

export function clearPendingCheckoutSession(): void {
  // no-op for iap build
}

export async function finalizePendingCheckout(): Promise<PaymentActionResult> {
  return { success: false, code: 'iap_client_not_ready', message: 'iap_client_not_ready' };
}

export async function purchase(plan: PaymentPlanType): Promise<PaymentActionResult> {
  try {
    const transaction = await runBridgePurchase(plan);
    if (!transaction) {
      return { success: false, code: 'iap_client_not_ready', message: 'iap_client_not_ready' };
    }
    const response = await callSubscriptionAPI({
      action: 'activate',
      source: 'iap',
      planType: plan,
      transactionId: transaction.transactionId,
      originalTransactionId: transaction.originalTransactionId,
      productId: transaction.productId || IAP_PRODUCT_IDS[plan],
    });
    return {
      success: response.success,
      plan: response.plan,
      expiresAt: response.expiresAt,
      code: response.success ? 'ok' : 'activate_failed',
      message: response.success ? undefined : 'activate_failed',
    };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function restorePurchase(): Promise<PaymentActionResult> {
  try {
    const transaction = await runBridgeRestore();
    if (!transaction) {
      return { success: false, code: 'iap_client_not_ready', message: 'iap_client_not_ready' };
    }

    const productId = transaction.productId || IAP_PRODUCT_IDS.monthly;
    const planType: PaymentPlanType = productId === IAP_PRODUCT_IDS.annual ? 'annual' : 'monthly';
    const response = await callSubscriptionAPI({
      action: 'restore',
      source: 'iap',
      planType,
      transactionId: transaction.transactionId,
      originalTransactionId: transaction.originalTransactionId,
      productId,
    });
    return {
      success: response.success,
      plan: response.plan,
      expiresAt: response.expiresAt,
      code: response.success ? 'ok' : 'restore_failed',
      message: response.success ? undefined : 'restore_failed',
    };
  } catch (error) {
    return toActionResult(error);
  }
}
