import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheAvatarUrl, readCachedAvatarUrl } from './authProfileCloudStore';

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

describe('authProfileCloudStore avatar cache', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MULTI_ACCOUNT_ISOLATION_V2', 'true');
    (globalThis as { window?: Window }).window = {
      localStorage: createMemoryStorage(),
    } as Window;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as { window?: Window }).window;
  });

  it('stores and reads a cached avatar per user scope', () => {
    cacheAvatarUrl('u-1', 'https://cdn.example.com/avatar-a.jpg?v=1');
    cacheAvatarUrl('u-2', 'https://cdn.example.com/avatar-b.jpg?v=2');

    expect(readCachedAvatarUrl('u-1')).toBe('https://cdn.example.com/avatar-a.jpg?v=1');
    expect(readCachedAvatarUrl('u-2')).toBe('https://cdn.example.com/avatar-b.jpg?v=2');
  });

  it('ignores invalid data urls and clears the cached entry', () => {
    cacheAvatarUrl('u-1', 'https://cdn.example.com/avatar-a.jpg?v=1');
    cacheAvatarUrl('u-1', 'data:image/png;base64,AAAA');

    expect(readCachedAvatarUrl('u-1')).toBeNull();
  });
});
