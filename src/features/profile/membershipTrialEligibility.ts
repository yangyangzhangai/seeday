type MetaLike = Record<string, any>;

export type MembershipPopularPlanId = 'monthly' | 'yearly';
export type MembershipPurchaseSegment = 'never_trialed' | 'trialed_not_purchased' | 'purchased_legacy';

const PLUS_PLAN_ALIASES = new Set(['plus', 'pro', 'premium', 'vip', 'member', 'paid', 'true', '1', 'yes']);

function hasNonEmptyValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length > 0;
  return value != null;
}

function hasPlusPlanSignal(meta: MetaLike): boolean {
  const planCandidates = [
    meta.membership_plan,
    meta.plan,
    meta.subscription_plan,
    meta.membership_tier,
    meta.tier,
    meta.membership?.plan,
    meta.subscription?.plan,
  ];
  for (const candidate of planCandidates) {
    if (typeof candidate === 'boolean') {
      if (candidate) return true;
      continue;
    }
    if (typeof candidate !== 'string') continue;
    if (PLUS_PLAN_ALIASES.has(candidate.trim().toLowerCase())) return true;
  }

  const directBooleanSignals = [meta.is_plus, meta.plus_member, meta.vip];
  return directBooleanSignals.some((signal) => signal === true);
}

function hasPaidHistorySignal(meta: MetaLike): boolean {
  if (hasPlusPlanSignal(meta)) return true;
  const paidHistoryFields = [
    meta.ever_plus,
    meta.ever_paid,
    meta.has_paid,
    meta.has_subscribed,
    meta.subscription_count,
    meta.membership_purchase_count,
    meta.pro_activated_at,
    meta.first_paid_at,
    meta.subscription_started_at,
    meta.last_purchase_at,
    meta.membership_started_at,
    meta.subscription?.started_at,
    meta.membership?.started_at,
  ];
  return paidHistoryFields.some((field) => hasNonEmptyValue(field));
}

function hasTrialHistorySignal(meta: MetaLike): boolean {
  const trialFields = [
    meta.trial_started_at,
    meta.trial_ended_at,
    meta.trial_consumed_at,
    meta.trial_used,
    meta.has_trialed,
    meta.trial_completed,
    meta.trial?.started_at,
    meta.trial?.ended_at,
    meta.trial?.consumed_at,
  ];
  return trialFields.some((field) => hasNonEmptyValue(field));
}

export function resolveMembershipPurchaseSegment(user: any | null | undefined, isPlus: boolean): MembershipPurchaseSegment {
  const userMeta = (user?.user_metadata || {}) as MetaLike;
  const appMeta = (user?.app_metadata || {}) as MetaLike;

  if (isPlus || hasPaidHistorySignal(userMeta) || hasPaidHistorySignal(appMeta)) {
    return 'purchased_legacy';
  }
  if (hasTrialHistorySignal(userMeta) || hasTrialHistorySignal(appMeta)) {
    return 'trialed_not_purchased';
  }
  return 'never_trialed';
}

export function getMembershipPopularPlanId(user: any | null | undefined, isPlus: boolean): MembershipPopularPlanId {
  const segment = resolveMembershipPurchaseSegment(user, isPlus);
  return segment === 'purchased_legacy' ? 'yearly' : 'monthly';
}

export function isEligibleForMembershipTrial(user: any | null | undefined, isPlus: boolean): boolean {
  return resolveMembershipPurchaseSegment(user, isPlus) === 'never_trialed';
}
