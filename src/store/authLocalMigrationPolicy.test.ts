import { describe, expect, it } from 'vitest';
import {
  canAutoMigrateLegacyV1Persist,
  resolveLocalDataMigrationDecision,
} from './authLocalMigrationPolicy';

describe('authLocalMigrationPolicy', () => {
  it('blocks unknown owner in v2 safety mode', () => {
    const decision = resolveLocalDataMigrationDecision({
      owner: { type: 'unknown', userId: null },
      hasLocalData: true,
      currentUserId: 'user-a',
      isolationV2Enabled: true,
    });

    expect(decision).toEqual({
      action: 'block_unknown_owner',
      reason: 'unknown_owner_v2_safe_mode',
    });
  });

  it('keeps unknown owner migration in v1 compatibility mode', () => {
    const decision = resolveLocalDataMigrationDecision({
      owner: { type: 'unknown', userId: null },
      hasLocalData: true,
      currentUserId: 'user-a',
      isolationV2Enabled: false,
    });

    expect(decision).toEqual({
      action: 'sync_local_to_cloud',
      reason: 'unknown_owner_v1_compat',
    });
  });

  it('clears local data when owner is another account', () => {
    const decision = resolveLocalDataMigrationDecision({
      owner: { type: 'user', userId: 'user-b' },
      hasLocalData: true,
      currentUserId: 'user-a',
      isolationV2Enabled: true,
    });

    expect(decision).toEqual({
      action: 'clear_local',
      reason: 'cross_account_owner',
    });
  });

  it('allows auto legacy persist migration only for trusted owner', () => {
    expect(canAutoMigrateLegacyV1Persist({
      owner: { type: 'anonymous', userId: null },
      currentUserId: 'user-a',
      isolationV2Enabled: true,
    })).toBe(true);

    expect(canAutoMigrateLegacyV1Persist({
      owner: { type: 'user', userId: 'user-a' },
      currentUserId: 'user-a',
      isolationV2Enabled: true,
    })).toBe(true);

    expect(canAutoMigrateLegacyV1Persist({
      owner: { type: 'unknown', userId: null },
      currentUserId: 'user-a',
      isolationV2Enabled: true,
    })).toBe(false);
  });
});
