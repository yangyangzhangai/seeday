// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/storageScope.ts
import { PERSIST_DOMAINS, getV1PersistKey } from './persistKeys';
import { getScopedPersistKey, isMultiAccountIsolationV2Enabled, type StorageScope } from './storageScope';

export type ScopedMigrationItem = {
  domain: string;
  fromKey: string;
  toKey: string;
  skipped: boolean;
  reason?: string;
};

export type ScopedMigrationResult = {
  moved: ScopedMigrationItem[];
  skipped: ScopedMigrationItem[];
};

export function migrateLegacyV1PersistToScope(scope: StorageScope, options?: { dryRun?: boolean }): ScopedMigrationResult {
  const dryRun = options?.dryRun ?? true;
  const moved: ScopedMigrationItem[] = [];
  const skipped: ScopedMigrationItem[] = [];

  if (typeof window === 'undefined' || !window.localStorage) {
    return { moved, skipped };
  }

  if (!isMultiAccountIsolationV2Enabled()) {
    return {
      moved,
      skipped: [{
        domain: 'all',
        fromKey: 'seeday:v1:*',
        toKey: 'seeday:v2:*',
        skipped: true,
        reason: 'feature_flag_disabled',
      }],
    };
  }

  for (const domain of PERSIST_DOMAINS) {
    const fromKey = getV1PersistKey(domain);
    const toKey = getScopedPersistKey(domain, scope);
    const raw = window.localStorage.getItem(fromKey);

    if (!raw) {
      skipped.push({ domain, fromKey, toKey, skipped: true, reason: 'source_missing' });
      continue;
    }

    if (fromKey === toKey) {
      skipped.push({ domain, fromKey, toKey, skipped: true, reason: 'same_key' });
      continue;
    }

    if (window.localStorage.getItem(toKey)) {
      skipped.push({ domain, fromKey, toKey, skipped: true, reason: 'target_exists' });
      continue;
    }

    moved.push({ domain, fromKey, toKey, skipped: false });
    if (dryRun) continue;

    try {
      window.localStorage.setItem(toKey, raw);
      window.localStorage.removeItem(fromKey);
    } catch {
      skipped.push({ domain, fromKey, toKey, skipped: true, reason: 'storage_write_failed' });
    }
  }

  return { moved, skipped };
}
