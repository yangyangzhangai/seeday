// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createPrivateKey, createSign } from 'node:crypto';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import { requireSupabaseRequestAuth } from '../src/server/supabase-request-auth.js';
import { createStripeCheckoutSession, verifyStripeMembershipBySession } from '../src/server/stripe-subscription.js';
import { sanitizeAuthMetadataForJwt } from '../src/lib/authMetadataSanitizer.js';

type RequestAuth = NonNullable<Awaited<ReturnType<typeof requireSupabaseRequestAuth>>>;
type RequestAdminClient = NonNullable<RequestAuth['adminClient']>;

type SubscriptionAction = 'activate' | 'restore' | 'cancel' | 'stripe_checkout' | 'stripe_finalize' | 'activate_trial';
type SubscriptionSource = 'iap' | 'stripe';
type PlanType = 'monthly' | 'annual';
type MembershipPlan = 'free' | 'plus';

interface SubscriptionRequestBody {
  action?: SubscriptionAction;
  source?: SubscriptionSource;
  planType?: PlanType;
  transactionId?: string;
  originalTransactionId?: string;
  productId?: string;
  sessionId?: string;
  returnPath?: string;
}

interface AppleTransactionPayload {
  productId?: string;
  expiresDate?: number | string;
  revocationDate?: number | string;
  bundleId?: string;
  transactionId?: string;
  originalTransactionId?: string;
}

interface VerifiedMembership {
  plan: MembershipPlan;
  expiresAt: string | null;
  productId: string | null;
  transactionId: string | null;
  originalTransactionId: string | null;
  sessionUserId?: string | null;
  environment: 'production' | 'sandbox' | 'unknown';
}

const APPLE_PROD_API_BASE = 'https://api.storekit.apple.com';
const APPLE_SANDBOX_API_BASE = 'https://api.storekit-sandbox.apple.com';
const ENABLE_VERBOSE_SUBSCRIPTION_LOGS = process.env.SUBSCRIPTION_VERBOSE_LOGS === 'true';

function logSubscriptionDebug(message: string, ...args: unknown[]): void {
  if (!ENABLE_VERBOSE_SUBSCRIPTION_LOGS) return;
  console.log(message, ...args);
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function normalizeString(value: unknown, maxLength = 200): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function normalizeAction(value: unknown): SubscriptionAction | null {
  if (
    value === 'activate'
    || value === 'restore'
    || value === 'cancel'
    || value === 'stripe_checkout'
    || value === 'stripe_finalize'
    || value === 'activate_trial'
  ) {
    return value;
  }
  return null;
}

function normalizeSource(value: unknown): SubscriptionSource | null {
  if (value === 'iap' || value === 'stripe') return value;
  return null;
}

function normalizePlanType(value: unknown): PlanType | null {
  if (value === 'monthly' || value === 'annual') return value;
  return null;
}

function toIso(value: number | string | undefined): string | null {
  if (value === undefined) return null;
  const rawMs = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(rawMs)) return null;
  const date = new Date(rawMs);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isActiveSubscription(payload: AppleTransactionPayload): boolean {
  if (payload.revocationDate !== undefined) return false;
  const expiresAt = toIso(payload.expiresDate);
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

function productIdByPlan(planType: PlanType): string {
  const monthly = process.env.APPLE_IAP_PRODUCT_MONTHLY || 'seeday.pro.monthly';
  const annual = process.env.APPLE_IAP_PRODUCT_ANNUAL || 'seeday.pro.annual';
  return planType === 'annual' ? annual : monthly;
}

function parseProductIdAliases(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function productIdsByPlan(planType: PlanType): string[] {
  const monthlyPrimary = process.env.APPLE_IAP_PRODUCT_MONTHLY || 'seeday.pro.monthly';
  const monthlyIntro = process.env.APPLE_IAP_PRODUCT_MONTHLY_INTRO || 'seeday.pro.monthly.intro';
  const annualPrimary = process.env.APPLE_IAP_PRODUCT_ANNUAL || 'seeday.pro.annual';
  const monthlyBuiltInAliases = [
    'seeday.pro.monthly',
    'seeday.pro.monthly.intro',
  ];
  const annualBuiltInAliases = [
    'seeday.pro.annual',
  ];
  const monthlyAliases = parseProductIdAliases(process.env.APPLE_IAP_PRODUCT_MONTHLY_ALIASES);
  const annualAliases = parseProductIdAliases(process.env.APPLE_IAP_PRODUCT_ANNUAL_ALIASES);

  const list = planType === 'annual'
    ? [annualPrimary, ...annualBuiltInAliases, ...annualAliases]
    : [monthlyPrimary, monthlyIntro, ...monthlyBuiltInAliases, ...monthlyAliases];
  return Array.from(new Set(list.filter(Boolean)));
}

function bundleIdsForVerification(): string[] {
  const primary = (process.env.APPLE_IAP_BUNDLE_ID || 'com.seeday.app').trim();
  const aliases = parseProductIdAliases(process.env.APPLE_IAP_BUNDLE_ID_ALIASES);
  const builtInAliases = ['com.seeday.app'];
  return Array.from(new Set([primary, ...builtInAliases, ...aliases].filter(Boolean)));
}

function stripePriceIdByPlan(planType: PlanType): string {
  const monthly = process.env.STRIPE_PRICE_MONTHLY;
  const annual = process.env.STRIPE_PRICE_ANNUAL;
  const resolved = planType === 'annual' ? annual : monthly;
  if (!resolved) {
    throw new Error(`Missing env: ${planType === 'annual' ? 'STRIPE_PRICE_ANNUAL' : 'STRIPE_PRICE_MONTHLY'}`);
  }
  return resolved;
}

function resolveRequestOrigin(req: VercelRequest): string {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host) {
    throw new Error('Missing request host');
  }
  return `${proto}://${host}`;
}

function resolveReturnPath(value: unknown): string {
  if (typeof value !== 'string') return '/upgrade';
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return '/upgrade';
  return trimmed;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payloadPart = parts[1];
  const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

export function buildAppleApiToken(bundleId: string): string {
  const issuerId = getEnv('APPLE_IAP_ISSUER_ID').trim();
  const keyId = getEnv('APPLE_IAP_KEY_ID').trim();
  const privateKeyRaw = getEnv('APPLE_IAP_PRIVATE_KEY').trim().replace(/\\n/g, '\n');

  const nowSec = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'ES256',
    kid: keyId,
    typ: 'JWT',
  };
  const payload = {
    iss: issuerId,
    iat: nowSec,
    exp: nowSec + 300,
    aud: 'appstoreconnect-v1',
    bid: bundleId,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;

  const key = createPrivateKey(privateKeyRaw);
  const signer = createSign('SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign({ key, dsaEncoding: 'ieee-p1363' });
  return `${unsigned}.${base64UrlEncode(signature)}`;
}

async function fetchAppleTransaction(
  apiBase: string,
  bearerToken: string,
  transactionId: string,
): Promise<{ payload: AppleTransactionPayload | null; status: number }> {
  const response = await fetch(`${apiBase}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 401 || response.status === 404) {
    return { payload: null, status: response.status };
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apple verify failed: HTTP ${response.status} ${text.slice(0, 120)}`);
  }

  const data = (await response.json()) as { signedTransactionInfo?: string };
  if (!data.signedTransactionInfo) {
    throw new Error('Apple verify failed: missing signedTransactionInfo');
  }

  return {
    payload: decodeJwtPayload<AppleTransactionPayload>(data.signedTransactionInfo),
    status: response.status,
  };
}

export async function fetchAppleTransactionAcrossEnvironments(
  bundleId: string,
  transactionId: string,
): Promise<{ payload: AppleTransactionPayload; environment: 'production' | 'sandbox' } | null> {
  const endpoints = [
    { apiBase: APPLE_PROD_API_BASE, environment: 'production' as const },
    { apiBase: APPLE_SANDBOX_API_BASE, environment: 'sandbox' as const },
  ];
  const statuses: number[] = [];

  for (const endpoint of endpoints) {
    const token = buildAppleApiToken(bundleId);
    const result = await fetchAppleTransaction(endpoint.apiBase, token, transactionId);
    statuses.push(result.status);
    if (result.payload) {
      return { payload: result.payload, environment: endpoint.environment };
    }
  }

  if (statuses.every((status) => status === 401)) {
    throw new Error('Apple verify failed: HTTP 401 in production and sandbox');
  }
  return null;
}

async function verifyIapMembership(params: {
  transactionId: string;
  productId: string;
  planType: PlanType;
  originalTransactionId: string | null;
}): Promise<VerifiedMembership> {
  logSubscriptionDebug('[IAP] verifyIapMembership start', {
    transactionId: params.transactionId,
    productId: params.productId,
    planType: params.planType,
  });

  const bypass = process.env.APPLE_IAP_VERIFY_BYPASS === 'true';
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (bypass && isProduction) {
    throw new Error('APPLE_IAP_VERIFY_BYPASS must be false in production');
  }
  if (bypass) {
    logSubscriptionDebug('[IAP] bypass mode enabled, skipping Apple verification');
    const defaultExpire = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return {
      plan: 'plus',
      expiresAt: defaultExpire,
      productId: params.productId,
      transactionId: params.transactionId,
      originalTransactionId: params.originalTransactionId,
      environment: 'unknown',
    };
  }

  const allowedBundleIds = bundleIdsForVerification();
  const allowedProductIds = productIdsByPlan(params.planType);
  const expectedProductId = productIdByPlan(params.planType);

  logSubscriptionDebug('[IAP] allowedBundleIds:', allowedBundleIds);
  logSubscriptionDebug('[IAP] allowedProductIds:', allowedProductIds);

  const hasIssuerId = !!process.env.APPLE_IAP_ISSUER_ID;
  const hasKeyId = !!process.env.APPLE_IAP_KEY_ID;
  const hasPrivateKey = !!process.env.APPLE_IAP_PRIVATE_KEY;
  logSubscriptionDebug('[IAP] env check — ISSUER_ID:', hasIssuerId, 'KEY_ID:', hasKeyId, 'PRIVATE_KEY:', hasPrivateKey);

  let payload: AppleTransactionPayload | null = null;
  let env: 'production' | 'sandbox' = 'production';
  let lastError: Error | null = null;

  for (const bundleId of allowedBundleIds) {
    try {
      logSubscriptionDebug('[IAP] building token for bundleId:', bundleId);
      const source = await fetchAppleTransactionAcrossEnvironments(bundleId, params.transactionId);
      if (!source) {
        logSubscriptionDebug('[IAP] no payload from Apple for bundleId:', bundleId);
        continue;
      }
      const candidate = source.payload;
      logSubscriptionDebug('[IAP] Apple payload bundleId:', candidate.bundleId, 'productId:', candidate.productId);
      if (candidate.bundleId && !allowedBundleIds.includes(candidate.bundleId)) {
        throw new Error(`Bundle ID mismatch: ${candidate.bundleId}`);
      }
      payload = candidate;
      env = source.environment;
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error('[IAP] error for bundleId:', bundleId, lastError.message);
    }
  }

  if (!payload) {
    const msg = (lastError || new Error('Transaction not found in Apple production/sandbox')).message;
    console.error('[IAP] verification failed — no valid payload. lastError:', msg);
    throw lastError || new Error('Transaction not found in Apple production/sandbox');
  }
  if (!payload.productId) {
    console.error('[IAP] Apple payload missing productId');
    throw new Error('Apple payload missing productId');
  }
  if (!allowedProductIds.includes(payload.productId)) {
    console.error('[IAP] product mismatch — got:', payload.productId, 'allowed:', allowedProductIds);
    throw new Error('Purchased product does not match requested plan');
  }

  const isActive = isActiveSubscription(payload);
  logSubscriptionDebug('[IAP] verification success — isActive:', isActive, 'env:', env);
  return {
    plan: isActive ? 'plus' : 'free',
    expiresAt: toIso(payload.expiresDate),
    productId: payload.productId || params.productId || expectedProductId,
    transactionId: payload.transactionId || params.transactionId,
    originalTransactionId: payload.originalTransactionId || params.originalTransactionId,
    environment: env,
  };
}

async function persistMembershipMetadata(params: {
  userId: string;
  source: SubscriptionSource;
  membership: VerifiedMembership;
  adminClient: RequestAdminClient;
}): Promise<{ plan: MembershipPlan; expiresAt: string | null }> {
  const fetched = await params.adminClient.auth.admin.getUserById(params.userId);
  if (fetched.error || !fetched.data.user) {
    throw new Error('Failed to fetch auth user before metadata write');
  }

  const currentMeta = (fetched.data.user.user_metadata || {}) as Record<string, unknown>;
  const currentAppMeta = (fetched.data.user.app_metadata || {}) as Record<string, unknown>;
  const membershipFields: Record<string, unknown> = {
    membership_plan: params.membership.plan,
    membership_source: params.source,
    membership_expires_at: params.membership.expiresAt,
    membership_updated_at: new Date().toISOString(),
    membership_product_id: params.membership.productId,
    membership_transaction_id: params.membership.transactionId,
    membership_original_transaction_id: params.membership.originalTransactionId,
  };
  const nextMeta: Record<string, unknown> = sanitizeAuthMetadataForJwt({ ...currentMeta, ...membershipFields }).metadata;
  const nextAppMeta: Record<string, unknown> = { ...currentAppMeta, ...membershipFields };

  const updated = await params.adminClient.auth.admin.updateUserById(params.userId, {
    user_metadata: nextMeta,
    app_metadata: nextAppMeta,
  });
  if (updated.error) {
    throw new Error(`Failed to write membership metadata: ${updated.error.message}`);
  }

  return {
    plan: params.membership.plan,
    expiresAt: params.membership.expiresAt,
  };
}

async function persistAccountStateSnapshot(params: {
  userId: string;
  adminClient: RequestAdminClient;
  plan: MembershipPlan;
  planSource: 'trial' | 'stripe' | 'iap' | 'legacy_metadata' | 'default_free';
  planExpiresAt?: string | null;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const row: Record<string, unknown> = {
    user_id: params.userId,
    plan_snapshot: params.plan,
    plan_source: params.planSource,
    plan_expires_at: params.planExpiresAt ?? null,
    updated_at: nowIso,
  };
  if ('trialStartedAt' in params) row.trial_started_at = params.trialStartedAt ?? null;
  if ('trialEndsAt' in params) row.trial_ends_at = params.trialEndsAt ?? null;
  const { error } = await params.adminClient.from('user_account_state').upsert(row, { onConflict: 'user_id' });
  if (error) {
    throw new Error(`Failed to write user_account_state snapshot: ${error.message}`);
  }
}

function resolveCancelMembership(): VerifiedMembership {
  return {
    plan: 'free',
    expiresAt: null,
    productId: null,
    transactionId: null,
    originalTransactionId: null,
    environment: 'unknown',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const requestStartedAt = Date.now();
  const requestId = String(req.headers['x-tshine-request-id'] || `subscription-${Date.now().toString(36)}`);
  applyCors(res, ['POST']);
  res.setHeader('X-Tshine-Request-Id', requestId);
  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  console.info('[subscription] request.start', {
    requestId,
    method: req.method,
    url: req.url,
    hasAuthorization: Boolean(req.headers.authorization),
  });

  const auth = await requireSupabaseRequestAuth(req, res);
  if (!auth) {
    console.warn('[subscription] request.auth_failed', {
      requestId,
      elapsedMs: Date.now() - requestStartedAt,
    });
    return;
  }
  if (!auth.adminClient) {
    console.error('[subscription] request.missing_service_role', {
      requestId,
      elapsedMs: Date.now() - requestStartedAt,
      userId: auth.user.id,
    });
    jsonError(res, 500, 'Missing SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const body = (req.body || {}) as SubscriptionRequestBody;
  const action = normalizeAction(body.action);
  const source = normalizeSource(body.source);
  const planType = normalizePlanType(body.planType);
  console.info('[subscription] request.parsed', {
    requestId,
    elapsedMs: Date.now() - requestStartedAt,
    userId: auth.user.id,
    action,
    source,
    planType,
    hasTransactionId: Boolean(normalizeString(body.transactionId)),
    productId: normalizeString(body.productId),
  });

  logSubscriptionDebug('[subscription] request — action:', action, 'source:', source, 'planType:', planType,
    'transactionId:', normalizeString(body.transactionId)?.slice(0, 20),
    'productId:', normalizeString(body.productId));

  if (action === 'activate_trial') {
    const fetched = await auth.adminClient.auth.admin.getUserById(auth.user.id);
    if (fetched.error || !fetched.data.user) {
      jsonError(res, 500, 'Failed to fetch user');
      return;
    }
    const appMeta = (fetched.data.user.app_metadata || {}) as Record<string, unknown>;
    if (appMeta.trial_started_at) {
      res.status(200).json({ success: false, alreadyUsed: true });
      return;
    }
    const trialStartedAt = new Date().toISOString();
    const updated = await auth.adminClient.auth.admin.updateUserById(auth.user.id, {
      app_metadata: { ...appMeta, trial_started_at: trialStartedAt },
    });
    if (updated.error) {
      jsonError(res, 500, 'Failed to activate trial');
      return;
    }
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await persistAccountStateSnapshot({
      userId: auth.user.id,
      adminClient: auth.adminClient,
      plan: 'plus',
      planSource: 'trial',
      planExpiresAt: trialEndsAt,
      trialStartedAt,
      trialEndsAt,
    });
    res.status(200).json({ success: true, alreadyUsed: false });
    console.info('[subscription] trial.success', {
      requestId,
      elapsedMs: Date.now() - requestStartedAt,
      userId: auth.user.id,
    });
    return;
  }

  if (!action || !source) {
    jsonError(res, 400, 'Invalid action or source');
    return;
  }
  try {
    let membership: VerifiedMembership;

    if (source === 'stripe' && action === 'stripe_checkout') {
      const plan = planType;
      if (!plan) {
        jsonError(res, 400, 'Missing planType');
        return;
      }

      const stripeSecret = getEnv('STRIPE_SECRET_KEY');
      const priceId = stripePriceIdByPlan(plan);
      const origin = resolveRequestOrigin(req);
      const returnPath = resolveReturnPath(body.returnPath);
      const successUrl = `${origin}${returnPath}?payment_source=stripe&stripe_session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}${returnPath}?payment_source=stripe&stripe_cancelled=1`;
      const checkoutUrl = await createStripeCheckoutSession({
        secretKey: stripeSecret,
        priceId,
        successUrl,
        cancelUrl,
        userId: auth.user.id,
        userEmail: auth.user.email,
        planType: plan,
      });

      res.status(200).json({ success: true, checkoutUrl });
      console.info('[subscription] stripe_checkout.success', {
        requestId,
        elapsedMs: Date.now() - requestStartedAt,
        userId: auth.user.id,
        plan,
      });
      return;
    }

    if (source === 'stripe' && action === 'stripe_finalize') {
      const sessionId = normalizeString(body.sessionId, 120);
      if (!sessionId) {
        jsonError(res, 400, 'Missing sessionId');
        return;
      }

      const stripeSecret = getEnv('STRIPE_SECRET_KEY');
      membership = await verifyStripeMembershipBySession({
        secretKey: stripeSecret,
        sessionId,
      });
      if (membership.sessionUserId && membership.sessionUserId !== auth.user.id) {
        jsonError(res, 403, 'Stripe session does not belong to current user');
        return;
      }

      const persisted = await persistMembershipMetadata({
        userId: auth.user.id,
        source,
        membership,
        adminClient: auth.adminClient,
      });
      await persistAccountStateSnapshot({
        userId: auth.user.id,
        adminClient: auth.adminClient,
        plan: persisted.plan,
        planSource: source,
        planExpiresAt: persisted.expiresAt,
      });

      res.status(200).json({
        success: true,
        plan: persisted.plan,
        isPlus: persisted.plan === 'plus',
        expiresAt: persisted.expiresAt,
        verificationEnvironment: membership.environment,
      });
      console.info('[subscription] stripe_finalize.success', {
        requestId,
        elapsedMs: Date.now() - requestStartedAt,
        userId: auth.user.id,
        plan: persisted.plan,
        source,
      });
      return;
    }

    if (source === 'stripe') {
      if (action === 'cancel') {
        membership = resolveCancelMembership();
      } else {
        jsonError(res, 400, 'Unsupported stripe action');
        return;
      }
    } else if (action === 'cancel') {
      membership = resolveCancelMembership();
    } else {
      const transactionId = normalizeString(body.transactionId, 120);
      const productId = normalizeString(body.productId, 200);
      const originalTransactionId = normalizeString(body.originalTransactionId, 120);
      if (!transactionId || !productId || !planType) {
        jsonError(res, 400, 'Missing transactionId, productId, or planType');
        return;
      }

      membership = await verifyIapMembership({
        transactionId,
        productId,
        planType,
        originalTransactionId,
      });
    }

    const persisted = await persistMembershipMetadata({
      userId: auth.user.id,
      source,
      membership,
      adminClient: auth.adminClient,
    });
    await persistAccountStateSnapshot({
      userId: auth.user.id,
      adminClient: auth.adminClient,
      plan: persisted.plan,
      planSource: membership.plan === 'free' ? 'default_free' : source,
      planExpiresAt: persisted.expiresAt,
    });

    res.status(200).json({
      success: true,
      plan: persisted.plan,
      isPlus: persisted.plan === 'plus',
      expiresAt: persisted.expiresAt,
      verificationEnvironment: membership.environment,
    });
    console.info('[subscription] request.success', {
      requestId,
      elapsedMs: Date.now() - requestStartedAt,
      userId: auth.user.id,
      source,
      action,
      plan: persisted.plan,
      verificationEnvironment: membership.environment,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subscription operation failed';
    console.error('[subscription] handler error:', {
      requestId,
      elapsedMs: Date.now() - requestStartedAt,
      action,
      source,
      planType,
      userId: auth.user.id,
      message,
      stackTop: error instanceof Error ? error.stack?.split('\n').slice(0, 3).join('\n') : undefined,
    });
    jsonError(res, 400, 'Subscription operation failed', message);
  }
}
