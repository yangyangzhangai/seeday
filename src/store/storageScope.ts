// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/persistKeys.ts
import { PERSIST_DOMAINS, getV1PersistKey, type PersistDomain } from './persistKeys';

const STORAGE_SCOPE_KEY = 'seeday:active-storage-scope:v2';
const PERSIST_V2_PREFIX = 'seeday:v2';

export type StorageScope =
  | { type: 'unresolved'; userId: null }
  | { type: 'anonymous'; userId: null }
  | { type: 'user'; userId: string };

type SerializedStorageScope = {
  type?: string;
  userId?: unknown;
};

export function isMultiAccountIsolationV2Enabled(): boolean {
  const raw = String(import.meta.env.VITE_MULTI_ACCOUNT_ISOLATION_V2 ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on';
}

export function resolveStorageScopeForUser(userId?: string | null): StorageScope {
  const trimmed = typeof userId === 'string' ? userId.trim() : '';
  if (trimmed) return { type: 'user', userId: trimmed };
  return { type: 'anonymous', userId: null };
}

function parseStorageScope(raw: string | null): StorageScope {
  if (!raw) return { type: 'unresolved', userId: null };
  try {
    const parsed = JSON.parse(raw) as SerializedStorageScope;
    if (parsed.type === 'anonymous') {
      return { type: 'anonymous', userId: null };
    }
    if (parsed.type === 'user' && typeof parsed.userId === 'string' && parsed.userId.trim()) {
      return { type: 'user', userId: parsed.userId.trim() };
    }
  } catch {
    return { type: 'unresolved', userId: null };
  }
  return { type: 'unresolved', userId: null };
}

export function readActiveStorageScope(): StorageScope {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { type: 'unresolved', userId: null };
  }
  return parseStorageScope(window.localStorage.getItem(STORAGE_SCOPE_KEY));
}

export function setActiveStorageScope(scope: StorageScope): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const payload = scope.type === 'user'
    ? { type: 'user', userId: scope.userId }
    : { type: scope.type, userId: null };
  try {
    window.localStorage.setItem(STORAGE_SCOPE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage write errors
  }
}

export function getScopedPersistKey(domain: PersistDomain, scope: StorageScope): string {
  if (!isMultiAccountIsolationV2Enabled()) {
    return getV1PersistKey(domain);
  }

  if (scope.type === 'user') {
    return `${PERSIST_V2_PREFIX}:user:${scope.userId}:${domain}`;
  }

  if (scope.type === 'anonymous' || scope.type === 'unresolved') {
    return `${PERSIST_V2_PREFIX}:anon:${domain}`;
  }

  return getV1PersistKey(domain);
}

export function getScopedDomainPersistKeys(scope: StorageScope): string[] {
  return PERSIST_DOMAINS.map((domain) => getScopedPersistKey(domain, scope));
}

export function clearScopedDomainPersistKeys(scope: StorageScope): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  for (const key of getScopedDomainPersistKeys(scope)) {
    window.localStorage.removeItem(key);
  }
}

export function getScopedClientStorageKey(baseKey: string, scope?: StorageScope): string {
  const normalized = baseKey.trim();
  if (!normalized) return baseKey;
  if (!isMultiAccountIsolationV2Enabled()) return normalized;

  const resolvedScope = scope ?? readActiveStorageScope();
  if (resolvedScope.type === 'user') {
    return `${PERSIST_V2_PREFIX}:user:${resolvedScope.userId}:local:${normalized}`;
  }
  return `${PERSIST_V2_PREFIX}:anon:local:${normalized}`;
}

export function logStorageScopeEvent(event: string, detail?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.log('[StorageScope]', event, detail ?? {});
}
