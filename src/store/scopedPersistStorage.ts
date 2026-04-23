// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/storageScope.ts
import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { getV1PersistKey, type PersistDomain } from './persistKeys';
import { getScopedPersistKey, isMultiAccountIsolationV2Enabled, readActiveStorageScope } from './storageScope';

function resolvePersistStorageKey(domain: PersistDomain, fallbackName: string): string {
  if (!isMultiAccountIsolationV2Enabled()) {
    return fallbackName || getV1PersistKey(domain);
  }
  return getScopedPersistKey(domain, readActiveStorageScope());
}

function createScopedStateStorage(domain: PersistDomain): StateStorage {
  return {
    getItem: (name) => {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage.getItem(resolvePersistStorageKey(domain, name));
    },
    setItem: (name, value) => {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(resolvePersistStorageKey(domain, name), value);
    },
    removeItem: (name) => {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.removeItem(resolvePersistStorageKey(domain, name));
    },
  };
}

export function createScopedJSONStorage<S>(domain: PersistDomain) {
  return createJSONStorage<S>(() => createScopedStateStorage(domain));
}
