// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/authLocalOwnerHelpers.ts
import type { LocalDataOwner } from './authLocalOwnerHelpers';

export type LocalDataMigrationDecision = {
  action: 'sync_local_to_cloud' | 'clear_local' | 'block_unknown_owner' | 'noop';
  reason:
    | 'owner_trusted'
    | 'cross_account_owner'
    | 'unknown_owner_v2_safe_mode'
    | 'unknown_owner_v1_compat'
    | 'no_local_data';
};

export function resolveLocalDataMigrationDecision(params: {
  owner: LocalDataOwner;
  hasLocalData: boolean;
  currentUserId: string;
  isolationV2Enabled: boolean;
}): LocalDataMigrationDecision {
  const { owner, hasLocalData, currentUserId, isolationV2Enabled } = params;
  if (!hasLocalData) return { action: 'noop', reason: 'no_local_data' };

  if (owner.type === 'user' && owner.userId !== currentUserId) {
    return { action: 'clear_local', reason: 'cross_account_owner' };
  }

  if (owner.type === 'unknown') {
    if (isolationV2Enabled) {
      return { action: 'block_unknown_owner', reason: 'unknown_owner_v2_safe_mode' };
    }
    return { action: 'sync_local_to_cloud', reason: 'unknown_owner_v1_compat' };
  }

  return { action: 'sync_local_to_cloud', reason: 'owner_trusted' };
}

export function canAutoMigrateLegacyV1Persist(params: {
  owner: LocalDataOwner;
  currentUserId: string;
  isolationV2Enabled: boolean;
}): boolean {
  const { owner, currentUserId, isolationV2Enabled } = params;
  if (!isolationV2Enabled) return false;
  if (owner.type === 'anonymous') return true;
  return owner.type === 'user' && owner.userId === currentUserId;
}
