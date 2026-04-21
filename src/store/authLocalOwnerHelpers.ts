const LOCAL_DATA_OWNER_KEY = 'seeday:local-data-owner:v1';

export type LocalDataOwner =
  | { type: 'anonymous'; userId: null }
  | { type: 'user'; userId: string }
  | { type: 'unknown'; userId: null };

function writeLocalDataOwner(owner: Exclude<LocalDataOwner, { type: 'unknown' }>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_DATA_OWNER_KEY, JSON.stringify(owner));
  } catch {
    // ignore storage write errors
  }
}

export function readLocalDataOwner(): LocalDataOwner {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { type: 'unknown', userId: null };
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_DATA_OWNER_KEY);
    if (!raw) return { type: 'unknown', userId: null };
    const parsed = JSON.parse(raw) as { type?: string; userId?: unknown };
    if (parsed.type === 'anonymous') {
      return { type: 'anonymous', userId: null };
    }
    if (parsed.type === 'user' && typeof parsed.userId === 'string' && parsed.userId.trim()) {
      return { type: 'user', userId: parsed.userId };
    }
    return { type: 'unknown', userId: null };
  } catch {
    return { type: 'unknown', userId: null };
  }
}

export function markLocalDataOwnerAnonymous(): void {
  writeLocalDataOwner({ type: 'anonymous', userId: null });
}

export function markLocalDataOwnerUser(userId: string): void {
  writeLocalDataOwner({ type: 'user', userId });
}
