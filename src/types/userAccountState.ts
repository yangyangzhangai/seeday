// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/README.md

export type AccountStatus = 'active' | 'pending_deletion' | 'deleted';

export type OnboardingStatus = 'required' | 'in_progress' | 'completed' | 'skipped';

export type AccountPlanSnapshot = 'free' | 'plus';

export type AccountPlanSource = 'trial' | 'stripe' | 'iap' | 'admin' | 'legacy_metadata' | 'default_free' | null;

export type AccountDeletionStatus = 'none' | 'requested' | 'processing';

export interface UserAccountState {
  accountStatus: AccountStatus;
  onboardingStatus: OnboardingStatus;
  onboardingCompletedAt?: string;
  onboardingVersion?: string;
  onboardingLastStep?: number;
  onboardingStartedAt?: string;
  onboardingUpdatedAt?: string;
  onboardingReentryAllowed: boolean;
  planSnapshot: AccountPlanSnapshot;
  planSource: AccountPlanSource;
  planExpiresAt?: string;
  trialStartedAt?: string;
  trialEndsAt?: string;
  deletionStatus: AccountDeletionStatus;
  deletionRequestedAt?: string;
  deletionEffectiveAt?: string;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
}
