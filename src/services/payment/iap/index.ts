// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/MEMBERSHIP_SPEC.md
import { callSubscriptionAPI, isApiClientError } from '../../../api/client';
import type { PaymentActionResult, PaymentPlan, PaymentPlanType } from '../types';

const IAP_PLANS: PaymentPlan[] = [
  { id: 'monthly', priceLabel: '$7.99', description: 'Intro monthly', isIntro: true },
  { id: 'annual', priceLabel: '$99.99', description: 'Annual plan' },
];

const IAP_PRODUCT_IDS: Record<PaymentPlanType, string> = {
  monthly: import.meta.env.VITE_IAP_PRODUCT_MONTHLY || 'seeday.pro.monthly',
  annual: import.meta.env.VITE_IAP_PRODUCT_ANNUAL || 'seeday.pro.annual',
};

const PURCHASE_BRIDGE_TIMEOUT_MS = 25_000;
const RESTORE_BRIDGE_TIMEOUT_MS = 10_000;

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

interface CapacitorRuntimeLike {
  Plugins?: Record<string, unknown>;
  nativePromise?: (pluginId: string, methodName: string, options?: Record<string, unknown>) => Promise<unknown>;
}

const NATIVE_PLUGIN_IDS = ['SeedayIAP', 'SeedayIAPPlugin', 'IAP'] as const;

function readCapacitorRuntime(): CapacitorRuntimeLike | null {
  const globalAny = window as unknown as { Capacitor?: CapacitorRuntimeLike };
  return globalAny.Capacitor ?? null;
}

function isPluginMissingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();
  return (
    normalized.includes('not implemented') ||
    normalized.includes('is not implemented') ||
    normalized.includes('does not have an implementation') ||
    normalized.includes('plugin is not implemented') ||
    normalized.includes('no such plugin') ||
    normalized.includes('unable to find plugin')
  );
}

async function callNativeBridge(
  methodName: 'purchaseProduct' | 'restorePurchases',
  options?: Record<string, unknown>,
): Promise<unknown> {
  const capacitor = readCapacitorRuntime();
  const nativePromise = capacitor?.nativePromise;
  if (typeof nativePromise !== 'function') return null;

  let lastError: unknown = null;
  for (const pluginId of NATIVE_PLUGIN_IDS) {
    try {
      return await nativePromise(pluginId, methodName, options ?? {});
    } catch (error) {
      lastError = error;
      if (!isPluginMissingError(error)) {
        throw error;
      }
    }
  }

  if (lastError) throw lastError;
  return null;
}

function getBridge(): IapBridge | null {
  const capacitor = readCapacitorRuntime();
  const plugins = capacitor?.Plugins;
  if (!plugins) return null;

  const pluginBridge = (
    plugins.SeedayIAP ||
    plugins.SeedayIAPPlugin ||
    plugins.IAP ||
    null
  ) as IapBridge | null;

  if (pluginBridge?.purchaseProduct || pluginBridge?.restorePurchases) {
    return pluginBridge;
  }

  // Fallback: call Capacitor native bridge directly even when plugin JS proxy
  // was not injected into window.Capacitor.Plugins due registration timing.
  return {
    purchaseProduct: async (params) => {
      const raw = await callNativeBridge('purchaseProduct', params as unknown as Record<string, unknown>);
      return raw as IapTransactionLike | null | undefined;
    },
    restorePurchases: async () => {
      const raw = await callNativeBridge('restorePurchases');
      return raw as
        | IapTransactionLike
        | { transactions?: IapTransactionLike[] }
        | null
        | undefined;
    },
  };
}

function toActionResult(error: unknown): PaymentActionResult {
  const rawMessage = error instanceof Error ? error.message : String(error ?? 'subscription_failed');
  const normalized = rawMessage.toLowerCase();

  if (isApiClientError(error) && error.code === 'unauthorized') {
    return {
      success: false,
      code: 'auth_required',
      message: 'Unauthorized: please sign in again and retry.',
    };
  }

  if (normalized.includes('currently subscribed') || normalized.includes('already subscribed')) {
    return {
      success: false,
      code: 'already_subscribed',
      message: rawMessage,
    };
  }

  if (normalized.includes('user cancelled')) {
    return {
      success: false,
      code: 'user_cancelled',
      message: rawMessage,
    };
  }

  if (normalized.includes('pending parental approval')) {
    return {
      success: false,
      code: 'purchase_pending',
      message: rawMessage,
    };
  }

  if (normalized.includes('timeout')) {
    return {
      success: false,
      code: 'iap_client_not_ready',
      message: rawMessage,
    };
  }

  return {
    success: false,
    code: 'subscription_failed',
    message: rawMessage,
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

const MONTHLY_PRODUCT_ID_ALIASES = new Set([
  IAP_PRODUCT_IDS.monthly,
  'seeday.pro.monthly',
  'seeday.pro.monthly.intro',
]);

const ANNUAL_PRODUCT_ID_ALIASES = new Set([
  IAP_PRODUCT_IDS.annual,
  'seeday.pro.annual',
]);

function detectPlanTypeByProductId(productId: string | undefined, fallback: PaymentPlanType): PaymentPlanType {
  if (!productId) return fallback;
  if (ANNUAL_PRODUCT_ID_ALIASES.has(productId)) return 'annual';
  if (MONTHLY_PRODUCT_ID_ALIASES.has(productId)) return 'monthly';
  if (productId.includes('.annual')) return 'annual';
  if (productId.includes('.monthly')) return 'monthly';
  return fallback;
}

function isSupportedProductId(productId: string | undefined): boolean {
  if (!productId) return false;
  return MONTHLY_PRODUCT_ID_ALIASES.has(productId) || ANNUAL_PRODUCT_ID_ALIASES.has(productId);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error(`${label}_timeout`));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeout);
        reject(error);
      });
  });
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
    if (!isSupportedProductId(restored.productId)) return null;
    return normalizeTransaction(restored, restored.productId || IAP_PRODUCT_IDS.monthly);
  }
  const transactions = Array.isArray(restored.transactions) ? restored.transactions : [];
  const latest = [...transactions]
    .reverse()
    .find((item) => (
      typeof item?.transactionId === 'string'
      && item.transactionId.trim()
      && isSupportedProductId(item.productId)
    ));
  return latest ? normalizeTransaction(latest, latest.productId || IAP_PRODUCT_IDS.monthly) : null;
}

async function runBridgePurchaseWithRecovery(plan: PaymentPlanType): Promise<IapTransactionLike | null> {
  try {
    const purchased = await withTimeout(runBridgePurchase(plan), PURCHASE_BRIDGE_TIMEOUT_MS, 'purchaseProduct');
    if (purchased) return purchased;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[IAP] purchase bridge timeout/failure, fallback to restorePurchases', error);
    }
  }

  try {
    return await withTimeout(runBridgeRestore(), RESTORE_BRIDGE_TIMEOUT_MS, 'restorePurchases');
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[IAP] restore fallback timeout/failure', error);
    }
    return null;
  }
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
    const transaction = await runBridgePurchaseWithRecovery(plan);
    if (!transaction) {
      return { success: false, code: 'iap_client_not_ready', message: 'iap_client_not_ready' };
    }

    const resolvedPlanType = detectPlanTypeByProductId(transaction.productId, plan);
    const resolvedProductId = transaction.productId || IAP_PRODUCT_IDS[resolvedPlanType];

    const response = await callSubscriptionAPI({
      action: 'activate',
      source: 'iap',
      planType: resolvedPlanType,
      transactionId: transaction.transactionId,
      originalTransactionId: transaction.originalTransactionId,
      productId: resolvedProductId,
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
    const transaction = await withTimeout(runBridgeRestore(), RESTORE_BRIDGE_TIMEOUT_MS, 'restorePurchases');
    if (!transaction) {
      return { success: false, code: 'iap_client_not_ready', message: 'iap_client_not_ready' };
    }

    const productId = transaction.productId || IAP_PRODUCT_IDS.monthly;
    const planType = detectPlanTypeByProductId(productId, 'monthly');
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
