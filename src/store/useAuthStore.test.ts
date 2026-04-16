import { describe, expect, it } from 'vitest';
import { getAnnotationConfigFromPreferences, resolveMembershipState } from './useAuthStore';

describe('useAuthStore membership helpers', () => {
  it('reads plus membership from auth metadata', () => {
    const membership = resolveMembershipState(
      {
        app_metadata: { membership_plan: 'plus' },
        user_metadata: {},
      },
      { temporaryUnlockEnabled: false },
    );

    expect(membership).toEqual({
      plan: 'plus',
      isPlus: true,
      source: 'metadata',
    });
  });

  it('falls back to temporary plus unlock when membership backend is disabled', () => {
    const membership = resolveMembershipState(
      {
        app_metadata: {},
        user_metadata: {},
      },
      { temporaryUnlockEnabled: true },
    );

    expect(membership).toEqual({
      plan: 'plus',
      isPlus: true,
      source: 'temporary_unlock',
    });
  });

  it('falls back to free when there is no membership metadata and no unlock override', () => {
    const membership = resolveMembershipState(
      {
        app_metadata: {},
        user_metadata: {},
      },
      { temporaryUnlockEnabled: false },
    );

    expect(membership).toEqual({
      plan: 'free',
      isPlus: false,
      source: 'default_free',
    });
  });

  it('treats users inside 7-day trial window as plus', () => {
    const trialStart = new Date('2026-04-10T00:00:00.000Z').toISOString();
    const membership = resolveMembershipState(
      {
        app_metadata: {},
        user_metadata: { trial_started_at: trialStart },
      },
      { temporaryUnlockEnabled: false, nowMs: new Date('2026-04-16T00:00:00.000Z').getTime() },
    );

    expect(membership).toEqual({
      plan: 'plus',
      isPlus: true,
      source: 'trial',
    });
  });

  it('expires trial access after 7 days', () => {
    const trialStart = new Date('2026-04-01T00:00:00.000Z').toISOString();
    const membership = resolveMembershipState(
      {
        app_metadata: {},
        user_metadata: { trial_started_at: trialStart },
      },
      { temporaryUnlockEnabled: false, nowMs: new Date('2026-04-10T00:00:00.000Z').getTime() },
    );

    expect(membership).toEqual({
      plan: 'free',
      isPlus: false,
      source: 'default_free',
    });
  });

  it('gives plus users the expanded annotation quota', () => {
    expect(
      getAnnotationConfigFromPreferences(
        {
          aiModeEnabled: true,
          annotationDropRate: 'low',
        },
        true,
      ),
    ).toEqual({
      enabled: true,
      dailyLimit: 9999,
      dropRate: 'low',
    });
  });

  it('keeps free-user annotation quota tied to drop rate', () => {
    expect(
      getAnnotationConfigFromPreferences(
        {
          aiModeEnabled: true,
          annotationDropRate: 'medium',
        },
        false,
      ),
    ).toEqual({
      enabled: true,
      dailyLimit: 5,
      dropRate: 'medium',
    });
  });
});
