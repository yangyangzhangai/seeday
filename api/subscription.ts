// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createPrivateKey, createSign } from 'node:crypto';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import { requireSupabaseRequestAuth } from '../src/server/supabase-request-auth.js';

type RequestAuth = NonNullable<Awaited<ReturnType<typeof requireSupabaseRequestAuth>>>;
type RequestAdminClient = NonNullable<RequestAuth['adminClient']>;

type SubscriptionAction = 'activate' | 'restore' | 'cancel';
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
  environment: 'production' | 'sandbox' | 'unknown';
}

const APPLE_PROD_API_BASE = 'https://api.storekit.itunes.apple.com';
const APPLE_SANDBOX_API_BASE = 'https://api.storekit-sandbox.itunes.apple.com';

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
  if (value === 'activate' || value === 'restore' || value === 'cancel') return value;
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
  const monthly = process.env.APPLE_IAP_PRODUCT_MONTHLY || 'com.seeday.app.plus.monthly';
  const annual = process.env.APPLE_IAP_PRODUCT_ANNUAL || 'com.seeday.app.plus.annual';
  return planType === 'annual' ? annual : monthly;
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

function buildAppleApiToken(bundleId: string): string {
  const issuerId = getEnv('APPLE_IAP_ISSUER_ID');
  const keyId = getEnv('APPLE_IAP_KEY_ID');
  const privateKeyRaw = getEnv('APPLE_IAP_PRIVATE_KEY').replace(/\\n/g, '\n');

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
  const signature = signer.sign(key);
  return `${unsigned}.${base64UrlEncode(signature)}`;
}

async function fetchAppleTransaction(
  apiBase: string,
  bearerToken: string,
  transactionId: string,
): Promise<{ payload: AppleTransactionPayload | null; notFound: boolean }> {
  const response = await fetch(`${apiBase}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 404) {
    return { payload: null, notFound: true };
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
    notFound: false,
  };
}

async function verifyIapMembership(params: {
  transactionId: string;
  productId: string;
  planType: PlanType;
  originalTransactionId: string | null;
}): Promise<VerifiedMembership> {
  const bypass = process.env.APPLE_IAP_VERIFY_BYPASS === 'true';
  if (bypass) {
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

  const bundleId = getEnv('APPLE_IAP_BUNDLE_ID');
  const expectedProductId = productIdByPlan(params.planType);
  if (params.productId !== expectedProductId) {
    throw new Error('Product ID does not match planType');
  }

  const token = buildAppleApiToken(bundleId);
  const prod = await fetchAppleTransaction(APPLE_PROD_API_BASE, token, params.transactionId);

  const env: 'production' | 'sandbox' = prod.notFound ? 'sandbox' : 'production';
  const source = prod.notFound
    ? await fetchAppleTransaction(APPLE_SANDBOX_API_BASE, token, params.transactionId)
    : prod;
  const payload = source.payload;

  if (!payload) {
    throw new Error('Transaction not found in Apple production/sandbox');
  }
  if (payload.bundleId && payload.bundleId !== bundleId) {
    throw new Error('Bundle ID mismatch');
  }
  if (payload.productId !== params.productId) {
    throw new Error('Purchased product does not match requested product');
  }

  const isActive = isActiveSubscription(payload);
  return {
    plan: isActive ? 'plus' : 'free',
    expiresAt: toIso(payload.expiresDate),
    productId: payload.productId || params.productId,
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
  const nextMeta: Record<string, unknown> = {
    ...currentMeta,
    membership_plan: params.membership.plan,
    membership_source: params.source,
    membership_expires_at: params.membership.expiresAt,
    membership_updated_at: new Date().toISOString(),
    membership_product_id: params.membership.productId,
    membership_transaction_id: params.membership.transactionId,
    membership_original_transaction_id: params.membership.originalTransactionId,
  };

  const updated = await params.adminClient.auth.admin.updateUserById(params.userId, {
    user_metadata: nextMeta,
  });
  if (updated.error) {
    throw new Error(`Failed to write membership metadata: ${updated.error.message}`);
  }

  return {
    plan: params.membership.plan,
    expiresAt: params.membership.expiresAt,
  };
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
  applyCors(res, ['POST']);
  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const auth = await requireSupabaseRequestAuth(req, res);
  if (!auth) return;
  if (!auth.adminClient) {
    jsonError(res, 500, 'Missing SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const body = (req.body || {}) as SubscriptionRequestBody;
  const action = normalizeAction(body.action);
  const source = normalizeSource(body.source);
  const planType = normalizePlanType(body.planType);

  if (!action || !source) {
    jsonError(res, 400, 'Invalid action or source');
    return;
  }
  if (source === 'stripe') {
    jsonError(res, 400, 'Stripe source is not enabled in this flow');
    return;
  }

  try {
    let membership: VerifiedMembership;

    if (action === 'cancel') {
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

    res.status(200).json({
      success: true,
      plan: persisted.plan,
      isPlus: persisted.plan === 'plus',
      expiresAt: persisted.expiresAt,
      verificationEnvironment: membership.environment,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subscription operation failed';
    jsonError(res, 400, 'Subscription operation failed', message);
  }
}
