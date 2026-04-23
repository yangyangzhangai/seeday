import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearScopedDomainPersistKeys,
  getScopedClientStorageKey,
  getScopedPersistKey,
  resolveStorageScopeForUser,
  setActiveStorageScope,
  readActiveStorageScope,
} from './storageScope';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => Array.from(map.keys())[index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, String(value));
    },
  };
}

describe('storageScope', () => {
  beforeEach(() => {
    (globalThis as { window?: Window }).window = {
      localStorage: createMemoryStorage(),
    } as Window;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as { window?: Window }).window;
  });

  it('returns v1 key when isolation feature is disabled', () => {
    vi.stubEnv('VITE_MULTI_ACCOUNT_ISOLATION_V2', 'false');
    const key = getScopedPersistKey('chat', { type: 'user', userId: 'u-1' });
    expect(key).toBe('seeday:v1:chat');
  });

  it('returns v2 scoped keys when isolation feature is enabled', () => {
    vi.stubEnv('VITE_MULTI_ACCOUNT_ISOLATION_V2', 'true');
    expect(getScopedPersistKey('todo', { type: 'user', userId: 'u-1' })).toBe('seeday:v2:user:u-1:todo');
    expect(getScopedPersistKey('todo', { type: 'anonymous', userId: null })).toBe('seeday:v2:anon:todo');
    expect(getScopedClientStorageKey('chat_input_draft', { type: 'user', userId: 'u-1' }))
      .toBe('seeday:v2:user:u-1:local:chat_input_draft');
  });

  it('persists and reads active storage scope', () => {
    setActiveStorageScope(resolveStorageScopeForUser('u-2'));
    expect(readActiveStorageScope()).toEqual({ type: 'user', userId: 'u-2' });
  });

  it('clears only scoped v2 keys', () => {
    vi.stubEnv('VITE_MULTI_ACCOUNT_ISOLATION_V2', 'true');
    globalThis.window.localStorage.setItem('seeday:v2:user:u-1:chat', '{"state":{}}');
    globalThis.window.localStorage.setItem('seeday:v2:user:u-2:chat', '{"state":{}}');
    clearScopedDomainPersistKeys({ type: 'user', userId: 'u-1' });
    expect(globalThis.window.localStorage.getItem('seeday:v2:user:u-1:chat')).toBeNull();
    expect(globalThis.window.localStorage.getItem('seeday:v2:user:u-2:chat')).toBe('{"state":{}}');
  });
});
