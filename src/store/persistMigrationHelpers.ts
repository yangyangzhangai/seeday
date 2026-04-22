// DOC-DEPS: LLM.md -> docs/DATA_STORAGE_AUDIT_REPORT.md -> src/store/persistKeys.ts
type PersistEnvelope<T> = {
  state?: T;
  version?: number;
};

function unwrapPersistEnvelope<T>(value: unknown): Partial<T> | null {
  if (!value || typeof value !== 'object') return null;
  const envelope = value as PersistEnvelope<T>;
  if (envelope.state && typeof envelope.state === 'object') {
    return envelope.state as Partial<T>;
  }
  return value as Partial<T>;
}

export function readLegacyPersistedState<T>(keys: readonly string[]): Partial<T> | null {
  if (typeof window === 'undefined') return null;

  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const state = unwrapPersistEnvelope<T>(parsed);
      window.localStorage.removeItem(key);
      if (state) return state;
    } catch {
      window.localStorage.removeItem(key);
    }
  }

  return null;
}

export function clearPersistedKeys(keys: readonly string[]): void {
  if (typeof window === 'undefined') return;
  for (const key of keys) {
    window.localStorage.removeItem(key);
  }
}
