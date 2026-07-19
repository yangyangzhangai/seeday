// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/README.md
import { describe, expect, it } from 'vitest';
import type { UserProfileV2 } from '../types/userProfile';
import { preserveProfileForSameUser } from './authProfileHelpers';

const completedProfile: UserProfileV2 = {
  manual: {},
  onboardingCompleted: true,
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
};

describe('preserveProfileForSameUser', () => {
  it('keeps the profile during refreshes for the same account', () => {
    expect(preserveProfileForSameUser({
      previousUserId: 'user-a',
      currentUserId: 'user-a',
      profile: completedProfile,
    })).toBe(completedProfile);
  });

  it('drops the previous profile when the account changes', () => {
    expect(preserveProfileForSameUser({
      previousUserId: 'user-a',
      currentUserId: 'user-b',
      profile: completedProfile,
    })).toBeNull();
  });

  it('does not preserve a profile when there is no previous account', () => {
    expect(preserveProfileForSameUser({
      previousUserId: null,
      currentUserId: 'user-b',
      profile: completedProfile,
    })).toBeNull();
  });
});
