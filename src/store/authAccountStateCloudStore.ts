// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/README.md
import { supabase } from '../api/supabase';
import { formatUserFacingDiagnostic, logDiagnostic } from '../lib/diagnostics';
import type { UserAccountState } from '../types/userAccountState';
import {
  clearPendingAccountStateWrite,
  getPendingAccountStateWrite,
  parseUserAccountState,
} from './authAccountStateHelpers';

type AccountStateRow = {
  account_status?: unknown;
  onboarding_status?: unknown;
  onboarding_completed_at?: unknown;
  onboarding_version?: unknown;
  onboarding_last_step?: unknown;
  onboarding_started_at?: unknown;
  onboarding_updated_at?: unknown;
  onboarding_reentry_allowed?: unknown;
  plan_snapshot?: unknown;
  plan_source?: unknown;
  plan_expires_at?: unknown;
  trial_started_at?: unknown;
  trial_ends_at?: unknown;
  deletion_status?: unknown;
  deletion_requested_at?: unknown;
  deletion_effective_at?: unknown;
  last_active_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

function rowToAccountState(row: AccountStateRow | null | undefined): UserAccountState | null {
  if (!row) return null;
  return parseUserAccountState({
    accountStatus: row.account_status,
    onboardingStatus: row.onboarding_status,
    onboardingCompletedAt: row.onboarding_completed_at,
    onboardingVersion: row.onboarding_version,
    onboardingLastStep: row.onboarding_last_step,
    onboardingStartedAt: row.onboarding_started_at,
    onboardingUpdatedAt: row.onboarding_updated_at,
    onboardingReentryAllowed: row.onboarding_reentry_allowed,
    planSnapshot: row.plan_snapshot,
    planSource: row.plan_source,
    planExpiresAt: row.plan_expires_at,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    deletionStatus: row.deletion_status,
    deletionRequestedAt: row.deletion_requested_at,
    deletionEffectiveAt: row.deletion_effective_at,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function buildAccountStateRow(userId: string, patch: Partial<UserAccountState>): Record<string, unknown> {
  const row: Record<string, unknown> = {
    user_id: userId,
    updated_at: patch.updatedAt || new Date().toISOString(),
  };
  if ('accountStatus' in patch) row.account_status = patch.accountStatus;
  if ('onboardingStatus' in patch) row.onboarding_status = patch.onboardingStatus;
  if ('onboardingCompletedAt' in patch) row.onboarding_completed_at = patch.onboardingCompletedAt ?? null;
  if ('onboardingVersion' in patch) row.onboarding_version = patch.onboardingVersion ?? null;
  if ('onboardingLastStep' in patch) row.onboarding_last_step = patch.onboardingLastStep ?? null;
  if ('onboardingStartedAt' in patch) row.onboarding_started_at = patch.onboardingStartedAt ?? null;
  if ('onboardingUpdatedAt' in patch) row.onboarding_updated_at = patch.onboardingUpdatedAt ?? null;
  if ('onboardingReentryAllowed' in patch) row.onboarding_reentry_allowed = patch.onboardingReentryAllowed;
  if ('planSnapshot' in patch) row.plan_snapshot = patch.planSnapshot;
  if ('planSource' in patch) row.plan_source = patch.planSource ?? null;
  if ('planExpiresAt' in patch) row.plan_expires_at = patch.planExpiresAt ?? null;
  if ('trialStartedAt' in patch) row.trial_started_at = patch.trialStartedAt ?? null;
  if ('trialEndsAt' in patch) row.trial_ends_at = patch.trialEndsAt ?? null;
  if ('deletionStatus' in patch) row.deletion_status = patch.deletionStatus;
  if ('deletionRequestedAt' in patch) row.deletion_requested_at = patch.deletionRequestedAt ?? null;
  if ('deletionEffectiveAt' in patch) row.deletion_effective_at = patch.deletionEffectiveAt ?? null;
  if ('lastActiveAt' in patch) row.last_active_at = patch.lastActiveAt ?? null;
  if ('createdAt' in patch) row.created_at = patch.createdAt;
  return row;
}

export async function fetchCloudUserAccountState(userId: string): Promise<UserAccountState | null> {
  const startedAt = Date.now();
  try {
    const { data, error } = await supabase
      .from('user_account_state')
      .select([
        'account_status',
        'onboarding_status',
        'onboarding_completed_at',
        'onboarding_version',
        'onboarding_last_step',
        'onboarding_started_at',
        'onboarding_updated_at',
        'onboarding_reentry_allowed',
        'plan_snapshot',
        'plan_source',
        'plan_expires_at',
        'trial_started_at',
        'trial_ends_at',
        'deletion_status',
        'deletion_requested_at',
        'deletion_effective_at',
        'last_active_at',
        'created_at',
        'updated_at',
      ].join(','))
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return rowToAccountState((data as AccountStateRow | null) ?? null);
  } catch (error) {
    logDiagnostic('warn', 'auth.account_state_cloud.fetch.failed', {
      userId,
      elapsedMs: Date.now() - startedAt,
      error,
      userFacing: formatUserFacingDiagnostic('Supabase user_account_state fetch', error, {
        path: 'user_account_state.select',
        elapsedMs: Date.now() - startedAt,
      }),
    });
    return null;
  }
}

export async function upsertCloudUserAccountState(userId: string, patch: Partial<UserAccountState>): Promise<void> {
  const startedAt = Date.now();
  const row = buildAccountStateRow(userId, patch);
  const { error } = await supabase
    .from('user_account_state')
    .upsert(row, { onConflict: 'user_id' });
  if (error) {
    logDiagnostic('error', 'auth.account_state_cloud.upsert.failed', {
      userId,
      elapsedMs: Date.now() - startedAt,
      patchKeys: Object.keys(patch),
      error,
      userFacing: formatUserFacingDiagnostic('Supabase user_account_state upsert', error, {
        path: 'user_account_state.upsert',
        elapsedMs: Date.now() - startedAt,
      }),
    });
    throw error;
  }
}

export async function ensureCloudUserAccountState(userId: string, fallbackState: UserAccountState): Promise<UserAccountState> {
  const existing = await fetchCloudUserAccountState(userId);
  if (existing) return existing;
  await upsertCloudUserAccountState(userId, fallbackState);
  return fallbackState;
}

export async function flushPendingAccountStateWriteToCloud(userId: string): Promise<UserAccountState | null> {
  const pendingState = getPendingAccountStateWrite(userId);
  if (!pendingState) return null;
  const stateToSave: UserAccountState = {
    ...pendingState,
    updatedAt: new Date().toISOString(),
  };
  await upsertCloudUserAccountState(userId, stateToSave);
  clearPendingAccountStateWrite(userId);
  return stateToSave;
}
