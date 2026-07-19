// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/README.md
import { describe, expect, it } from 'vitest';
import type { UserAccountState } from '../types/userAccountState';
import {
  createDefaultUserAccountState,
  preserveAccountStateForSameUser,
  resolveEffectiveAccountState,
  shouldRequireOnboarding,
} from './authAccountStateHelpers';

const baseState: UserAccountState = {
  accountStatus: 'active',
  onboardingStatus: 'required',
  onboardingReentryAllowed: false,
  planSnapshot: 'free',
  planSource: 'default_free',
  deletionStatus: 'none',
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
};

describe('authAccountStateHelpers', () => {
  it('treats local completed onboarding as stronger than cloud required', () => {
    const cloudState: UserAccountState = {
      ...baseState,
      onboardingStatus: 'required',
    };
    const pendingState: UserAccountState = {
      ...baseState,
      onboardingStatus: 'completed',
      onboardingCompletedAt: '2026-07-19T01:00:00.000Z',
      updatedAt: '2026-07-19T01:00:00.000Z',
    };

    const resolved = resolveEffectiveAccountState({ cloudState, pendingState, fallbackState: baseState });
    expect(resolved?.onboardingStatus).toBe('completed');
    expect(shouldRequireOnboarding(resolved)).toBe(false);
  });

  it('keeps the furthest onboarding step when both sides are in progress', () => {
    const cloudState: UserAccountState = {
      ...baseState,
      onboardingStatus: 'in_progress',
      onboardingLastStep: 2,
    };
    const pendingState: UserAccountState = {
      ...baseState,
      onboardingStatus: 'in_progress',
      onboardingLastStep: 5,
    };

    const resolved = resolveEffectiveAccountState({ cloudState, pendingState, fallbackState: baseState });
    expect(resolved?.onboardingLastStep).toBe(5);
  });

  it('creates recent users as onboarding-required by default', () => {
    const state = createDefaultUserAccountState({
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      membershipPlan: 'free',
      membershipSource: 'default_free',
    });
    expect(state.onboardingStatus).toBe('required');
    expect(shouldRequireOnboarding(state)).toBe(true);
  });

  it('preserves account state only for the same user id', () => {
    expect(preserveAccountStateForSameUser({
      previousUserId: 'user-a',
      currentUserId: 'user-a',
      accountState: baseState,
    })).toBe(baseState);

    expect(preserveAccountStateForSameUser({
      previousUserId: 'user-a',
      currentUserId: 'user-b',
      accountState: baseState,
    })).toBeNull();
  });
});
