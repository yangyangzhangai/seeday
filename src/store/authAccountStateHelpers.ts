// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/types/userAccountState.ts
import type { UserProfileV2 } from '../types/userProfile';
import type {
  AccountDeletionStatus,
  AccountPlanSnapshot,
  AccountPlanSource,
  AccountStatus,
  OnboardingStatus,
  UserAccountState,
} from '../types/userAccountState';

const ACCOUNT_STATUS_VALUES = new Set<AccountStatus>(['active', 'pending_deletion', 'deleted']);
const ONBOARDING_STATUS_VALUES = new Set<OnboardingStatus>(['required', 'in_progress', 'completed', 'skipped']);
const PLAN_SNAPSHOT_VALUES = new Set<AccountPlanSnapshot>(['free', 'plus']);
const PLAN_SOURCE_VALUES = new Set<Exclude<AccountPlanSource, null>>([
  'trial',
  'stripe',
  'iap',
  'admin',
  'legacy_metadata',
  'default_free',
]);
const DELETION_STATUS_VALUES = new Set<AccountDeletionStatus>(['none', 'requested', 'processing']);

const PENDING_ACCOUNT_STATE_PREFIX = 'seeday_pending_account_state_v1_';
const LEGACY_LOCAL_ONBOARDING_FLAG_PREFIX = 'seeday_onboarded_';

function normalizeIsoString(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function normalizeInteger(raw: unknown): number | undefined {
  const value = Number(raw);
  if (!Number.isFinite(value)) return undefined;
  const rounded = Math.floor(value);
  if (rounded < 0) return undefined;
  return rounded;
}

function normalizeBool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}

function normalizeEnum<T extends string>(raw: unknown, allowed: Set<T>, fallback: T): T {
  return typeof raw === 'string' && allowed.has(raw as T) ? (raw as T) : fallback;
}

export function parseUserAccountState(raw: unknown): UserAccountState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const nowIso = new Date().toISOString();
  return {
    accountStatus: normalizeEnum(value.accountStatus, ACCOUNT_STATUS_VALUES, 'active'),
    onboardingStatus: normalizeEnum(value.onboardingStatus, ONBOARDING_STATUS_VALUES, 'required'),
    ...(normalizeIsoString(value.onboardingCompletedAt) ? { onboardingCompletedAt: normalizeIsoString(value.onboardingCompletedAt) } : {}),
    ...(typeof value.onboardingVersion === 'string' && value.onboardingVersion.trim()
      ? { onboardingVersion: value.onboardingVersion.trim() }
      : {}),
    ...(normalizeInteger(value.onboardingLastStep) !== undefined
      ? { onboardingLastStep: normalizeInteger(value.onboardingLastStep) }
      : {}),
    ...(normalizeIsoString(value.onboardingStartedAt) ? { onboardingStartedAt: normalizeIsoString(value.onboardingStartedAt) } : {}),
    ...(normalizeIsoString(value.onboardingUpdatedAt) ? { onboardingUpdatedAt: normalizeIsoString(value.onboardingUpdatedAt) } : {}),
    onboardingReentryAllowed: normalizeBool(value.onboardingReentryAllowed, false),
    planSnapshot: normalizeEnum(value.planSnapshot, PLAN_SNAPSHOT_VALUES, 'free'),
    planSource: typeof value.planSource === 'string' && PLAN_SOURCE_VALUES.has(value.planSource as Exclude<AccountPlanSource, null>)
      ? (value.planSource as Exclude<AccountPlanSource, null>)
      : null,
    ...(normalizeIsoString(value.planExpiresAt) ? { planExpiresAt: normalizeIsoString(value.planExpiresAt) } : {}),
    ...(normalizeIsoString(value.trialStartedAt) ? { trialStartedAt: normalizeIsoString(value.trialStartedAt) } : {}),
    ...(normalizeIsoString(value.trialEndsAt) ? { trialEndsAt: normalizeIsoString(value.trialEndsAt) } : {}),
    deletionStatus: normalizeEnum(value.deletionStatus, DELETION_STATUS_VALUES, 'none'),
    ...(normalizeIsoString(value.deletionRequestedAt) ? { deletionRequestedAt: normalizeIsoString(value.deletionRequestedAt) } : {}),
    ...(normalizeIsoString(value.deletionEffectiveAt) ? { deletionEffectiveAt: normalizeIsoString(value.deletionEffectiveAt) } : {}),
    ...(normalizeIsoString(value.lastActiveAt) ? { lastActiveAt: normalizeIsoString(value.lastActiveAt) } : {}),
    createdAt: normalizeIsoString(value.createdAt) || nowIso,
    updatedAt: normalizeIsoString(value.updatedAt) || nowIso,
  };
}

function readLegacyLocalOnboardingCompleted(userId: string): boolean {
  try {
    return window.localStorage.getItem(LEGACY_LOCAL_ONBOARDING_FLAG_PREFIX + userId) === '1';
  } catch {
    return false;
  }
}

function isRecentAccount(createdAt?: string | null, nowMs: number = Date.now()): boolean {
  if (!createdAt) return false;
  const createdAtMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) return false;
  return nowMs - createdAtMs < 72 * 60 * 60 * 1000;
}

export function createDefaultUserAccountState(params: {
  createdAt?: string | null;
  membershipPlan?: AccountPlanSnapshot;
  membershipSource?: AccountPlanSource;
  planExpiresAt?: string | null;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  legacyCompleted?: boolean;
  onboardingLastStep?: number;
  nowMs?: number;
}): UserAccountState {
  const nowIso = new Date(params.nowMs ?? Date.now()).toISOString();
  const recent = isRecentAccount(params.createdAt, params.nowMs);
  const completed = params.legacyCompleted === true;
  return {
    accountStatus: 'active',
    onboardingStatus: completed ? 'completed' : (recent ? 'required' : 'completed'),
    ...(completed ? { onboardingCompletedAt: nowIso } : {}),
    ...(params.onboardingLastStep !== undefined ? { onboardingLastStep: params.onboardingLastStep } : {}),
    onboardingReentryAllowed: false,
    planSnapshot: params.membershipPlan === 'plus' ? 'plus' : 'free',
    planSource: params.membershipSource ?? (params.membershipPlan === 'plus' ? 'legacy_metadata' : 'default_free'),
    ...(normalizeIsoString(params.planExpiresAt) ? { planExpiresAt: normalizeIsoString(params.planExpiresAt) } : {}),
    ...(normalizeIsoString(params.trialStartedAt) ? { trialStartedAt: normalizeIsoString(params.trialStartedAt) } : {}),
    ...(normalizeIsoString(params.trialEndsAt) ? { trialEndsAt: normalizeIsoString(params.trialEndsAt) } : {}),
    deletionStatus: 'none',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function deriveLegacyAccountState(params: {
  user: { id: string; created_at?: string | null; user_metadata?: Record<string, any>; app_metadata?: Record<string, any> } | null | undefined;
  userProfile: UserProfileV2 | null | undefined;
  pendingProfile?: UserProfileV2 | null;
  membershipPlan: AccountPlanSnapshot;
  membershipSource: AccountPlanSource;
  nowMs?: number;
}): UserAccountState | null {
  const { user, userProfile, pendingProfile, membershipPlan, membershipSource, nowMs } = params;
  if (!user?.id) return null;
  const trialStartedAt = typeof user.app_metadata?.trial_started_at === 'string'
    ? user.app_metadata.trial_started_at
    : typeof user.user_metadata?.trial_started_at === 'string'
      ? user.user_metadata.trial_started_at
      : null;
  const trialEndsAt = trialStartedAt
    ? new Date(new Date(trialStartedAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const legacyCompleted = userProfile?.onboardingCompleted === true
    || pendingProfile?.onboardingCompleted === true
    || readLegacyLocalOnboardingCompleted(user.id);
  return createDefaultUserAccountState({
    createdAt: user.created_at,
    membershipPlan,
    membershipSource,
    trialStartedAt,
    trialEndsAt,
    legacyCompleted,
    nowMs,
  });
}

export function mergeAccountState(
  prev: UserAccountState | null | undefined,
  partial: Partial<UserAccountState>,
): UserAccountState {
  const nowIso = new Date().toISOString();
  return {
    accountStatus: partial.accountStatus ?? prev?.accountStatus ?? 'active',
    onboardingStatus: partial.onboardingStatus ?? prev?.onboardingStatus ?? 'required',
    onboardingCompletedAt: partial.onboardingCompletedAt ?? prev?.onboardingCompletedAt,
    onboardingVersion: partial.onboardingVersion ?? prev?.onboardingVersion,
    onboardingLastStep: partial.onboardingLastStep ?? prev?.onboardingLastStep,
    onboardingStartedAt: partial.onboardingStartedAt ?? prev?.onboardingStartedAt,
    onboardingUpdatedAt: partial.onboardingUpdatedAt ?? prev?.onboardingUpdatedAt,
    onboardingReentryAllowed: partial.onboardingReentryAllowed ?? prev?.onboardingReentryAllowed ?? false,
    planSnapshot: partial.planSnapshot ?? prev?.planSnapshot ?? 'free',
    planSource: partial.planSource ?? prev?.planSource ?? 'default_free',
    planExpiresAt: partial.planExpiresAt ?? prev?.planExpiresAt,
    trialStartedAt: partial.trialStartedAt ?? prev?.trialStartedAt,
    trialEndsAt: partial.trialEndsAt ?? prev?.trialEndsAt,
    deletionStatus: partial.deletionStatus ?? prev?.deletionStatus ?? 'none',
    deletionRequestedAt: partial.deletionRequestedAt ?? prev?.deletionRequestedAt,
    deletionEffectiveAt: partial.deletionEffectiveAt ?? prev?.deletionEffectiveAt,
    lastActiveAt: partial.lastActiveAt ?? prev?.lastActiveAt,
    createdAt: prev?.createdAt ?? partial.createdAt ?? nowIso,
    updatedAt: partial.updatedAt ?? nowIso,
  };
}

function onboardingStatusRank(status: OnboardingStatus): number {
  switch (status) {
    case 'completed':
      return 4;
    case 'skipped':
      return 3;
    case 'in_progress':
      return 2;
    default:
      return 1;
  }
}

function resolveOnboardingConflict(
  cloudState: UserAccountState,
  localState: UserAccountState,
): Pick<UserAccountState, 'onboardingStatus' | 'onboardingCompletedAt' | 'onboardingVersion' | 'onboardingLastStep' | 'onboardingStartedAt' | 'onboardingUpdatedAt'> {
  const cloudRank = onboardingStatusRank(cloudState.onboardingStatus);
  const localRank = onboardingStatusRank(localState.onboardingStatus);
  if (localRank > cloudRank) {
    return {
      onboardingStatus: localState.onboardingStatus,
      onboardingCompletedAt: localState.onboardingCompletedAt,
      onboardingVersion: localState.onboardingVersion,
      onboardingLastStep: localState.onboardingLastStep,
      onboardingStartedAt: localState.onboardingStartedAt,
      onboardingUpdatedAt: localState.onboardingUpdatedAt,
    };
  }
  if (cloudRank > localRank) {
    return {
      onboardingStatus: cloudState.onboardingStatus,
      onboardingCompletedAt: cloudState.onboardingCompletedAt,
      onboardingVersion: cloudState.onboardingVersion,
      onboardingLastStep: cloudState.onboardingLastStep,
      onboardingStartedAt: cloudState.onboardingStartedAt,
      onboardingUpdatedAt: cloudState.onboardingUpdatedAt,
    };
  }

  const cloudStep = cloudState.onboardingLastStep ?? 0;
  const localStep = localState.onboardingLastStep ?? 0;
  if (localStep > cloudStep) {
    return {
      onboardingStatus: localState.onboardingStatus,
      onboardingCompletedAt: localState.onboardingCompletedAt,
      onboardingVersion: localState.onboardingVersion,
      onboardingLastStep: localState.onboardingLastStep,
      onboardingStartedAt: localState.onboardingStartedAt,
      onboardingUpdatedAt: localState.onboardingUpdatedAt,
    };
  }
  return {
    onboardingStatus: cloudState.onboardingStatus,
    onboardingCompletedAt: cloudState.onboardingCompletedAt,
    onboardingVersion: cloudState.onboardingVersion,
    onboardingLastStep: cloudState.onboardingLastStep,
    onboardingStartedAt: cloudState.onboardingStartedAt,
    onboardingUpdatedAt: cloudState.onboardingUpdatedAt,
  };
}

export function resolveEffectiveAccountState(params: {
  cloudState?: UserAccountState | null;
  pendingState?: UserAccountState | null;
  fallbackState?: UserAccountState | null;
}): UserAccountState | null {
  const { cloudState, pendingState, fallbackState } = params;
  const base = cloudState ?? fallbackState ?? pendingState ?? null;
  if (!base) return null;
  let merged = mergeAccountState(fallbackState ?? null, base);
  if (cloudState && pendingState) {
    merged = mergeAccountState(merged, resolveOnboardingConflict(cloudState, pendingState));
    return merged;
  }
  if (pendingState) {
    return mergeAccountState(merged, pendingState);
  }
  return merged;
}

export function shouldRequireOnboarding(accountState: UserAccountState | null | undefined): boolean {
  if (!accountState) return false;
  return accountState.onboardingStatus === 'required' || accountState.onboardingStatus === 'in_progress';
}

export function savePendingAccountStateWrite(userId: string, state: UserAccountState): void {
  try {
    window.localStorage.setItem(PENDING_ACCOUNT_STATE_PREFIX + userId, JSON.stringify(state));
  } catch {
    // storage unavailable
  }
}

export function getPendingAccountStateWrite(userId: string): UserAccountState | null {
  try {
    const raw = window.localStorage.getItem(PENDING_ACCOUNT_STATE_PREFIX + userId);
    return parseUserAccountState(raw ? JSON.parse(raw) : null);
  } catch {
    return null;
  }
}

export function clearPendingAccountStateWrite(userId: string): void {
  try {
    window.localStorage.removeItem(PENDING_ACCOUNT_STATE_PREFIX + userId);
  } catch {
    // storage unavailable
  }
}

export function preserveAccountStateForSameUser(params: {
  previousUserId?: string | null;
  currentUserId?: string | null;
  accountState: UserAccountState | null | undefined;
}): UserAccountState | null {
  const { previousUserId, currentUserId, accountState } = params;
  if (!previousUserId || previousUserId !== currentUserId) return null;
  return accountState ?? null;
}
