// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
type MembershipPlan = 'free' | 'plus';

interface StripeCheckoutSession {
  id: string;
  url?: string;
  status?: string;
  payment_status?: string;
  subscription?: string | { id?: string } | null;
  metadata?: Record<string, string>;
}

interface StripeSubscription {
  id: string;
  status?: string;
  current_period_end?: number;
  items?: {
    data?: Array<{
      price?: {
        id?: string;
      };
    }>;
  };
}

export interface StripeVerifiedMembership {
  plan: MembershipPlan;
  expiresAt: string | null;
  productId: string | null;
  transactionId: string | null;
  originalTransactionId: string | null;
  sessionUserId: string | null;
  environment: 'production' | 'sandbox' | 'unknown';
}

function toIsoSeconds(value: number | undefined): string | null {
  if (!Number.isFinite(value)) return null;
  const date = new Date((value as number) * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function resolveSubscriptionId(raw: string | { id?: string } | null | undefined): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw.id === 'string' && raw.id.trim()) return raw.id.trim();
  return null;
}

async function callStripeApi<T>(
  secretKey: string,
  method: 'GET' | 'POST',
  path: string,
  body?: URLSearchParams,
): Promise<T> {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: body?.toString(),
  });

  const json = (await response.json()) as { error?: { message?: string } } & T;
  if (!response.ok) {
    const detail = json?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Stripe API failed: ${detail}`);
  }
  return json as T;
}

export async function createStripeCheckoutSession(params: {
  secretKey: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId: string;
  userEmail?: string | null;
  planType: 'monthly' | 'annual';
}): Promise<string> {
  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('line_items[0][price]', params.priceId);
  body.set('line_items[0][quantity]', '1');
  body.set('success_url', params.successUrl);
  body.set('cancel_url', params.cancelUrl);
  body.set('metadata[userId]', params.userId);
  body.set('metadata[planType]', params.planType);
  body.set('metadata[priceId]', params.priceId);
  if (params.userEmail) {
    body.set('customer_email', params.userEmail);
  }

  const session = await callStripeApi<StripeCheckoutSession>(
    params.secretKey,
    'POST',
    '/v1/checkout/sessions',
    body,
  );

  if (!session.id) {
    throw new Error('Stripe checkout session missing id');
  }
  if (!session.url) {
    throw new Error('Stripe checkout session missing url');
  }

  return session.url;
}

async function fetchStripeCheckoutSession(secretKey: string, sessionId: string): Promise<StripeCheckoutSession> {
  const encoded = encodeURIComponent(sessionId);
  const query = '?expand[]=subscription';
  return callStripeApi<StripeCheckoutSession>(secretKey, 'GET', `/v1/checkout/sessions/${encoded}${query}`);
}

async function fetchStripeSubscription(secretKey: string, subscriptionId: string): Promise<StripeSubscription> {
  const encoded = encodeURIComponent(subscriptionId);
  return callStripeApi<StripeSubscription>(secretKey, 'GET', `/v1/subscriptions/${encoded}`);
}

function isStripeSubscriptionActive(status: string | undefined): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

export async function verifyStripeMembershipBySession(params: {
  secretKey: string;
  sessionId: string;
}): Promise<StripeVerifiedMembership> {
  const session = await fetchStripeCheckoutSession(params.secretKey, params.sessionId);
  const subscriptionId = resolveSubscriptionId(session.subscription);
  if (!subscriptionId) {
    throw new Error('Stripe checkout session missing subscription');
  }

  const subscription = await fetchStripeSubscription(params.secretKey, subscriptionId);
  const expiresAt = toIsoSeconds(subscription.current_period_end);
  const productId = subscription.items?.data?.[0]?.price?.id || session.metadata?.priceId || null;
  const plan = isStripeSubscriptionActive(subscription.status) ? 'plus' : 'free';

  return {
    plan,
    expiresAt,
    productId,
    transactionId: session.id || params.sessionId,
    originalTransactionId: subscription.id || subscriptionId,
    sessionUserId: session.metadata?.userId || null,
    environment: 'unknown',
  };
}
