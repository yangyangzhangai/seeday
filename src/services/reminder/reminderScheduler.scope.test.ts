import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getIsFreeDay } from './reminderScheduler';

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

describe('reminderScheduler freeDay cache scope', () => {
  beforeEach(() => {
    const storage = createMemoryStorage();
    (globalThis as { localStorage?: Storage }).localStorage = storage;
    (globalThis as { window?: Window }).window = { localStorage: storage } as Window;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    delete (globalThis as { localStorage?: Storage }).localStorage;
    delete (globalThis as { window?: Window }).window;
  });

  it('uses different freeDay cache keys per user in v2 mode', async () => {
    vi.stubEnv('VITE_MULTI_ACCOUNT_ISOLATION_V2', 'true');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ isFreeDay: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ isFreeDay: false }) });
    vi.stubGlobal('fetch', fetchMock);

    const date = new Date(2026, 3, 24, 12, 0, 0);

    const freeDayForA = await getIsFreeDay(date, 'CN', 'user-a');
    const freeDayForB = await getIsFreeDay(date, 'CN', 'user-b');

    expect(freeDayForA).toBe(true);
    expect(freeDayForB).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(globalThis.localStorage.getItem('seeday:v2:user:user-a:local:freeDay_2026-04-24')).toBe('true');
    expect(globalThis.localStorage.getItem('seeday:v2:user:user-b:local:freeDay_2026-04-24')).toBe('false');
  });

  it('keeps legacy freeDay key when v2 isolation is disabled', async () => {
    vi.stubEnv('VITE_MULTI_ACCOUNT_ISOLATION_V2', 'false');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ isFreeDay: true }) });
    vi.stubGlobal('fetch', fetchMock);

    const date = new Date(2026, 3, 24, 12, 0, 0);
    const freeDay = await getIsFreeDay(date, 'CN', 'user-a');

    expect(freeDay).toBe(true);
    expect(globalThis.localStorage.getItem('freeDay_2026-04-24')).toBe('true');
    expect(globalThis.localStorage.getItem('seeday:v2:user:user-a:local:freeDay_2026-04-24')).toBeNull();
  });

  it('migrates legacy freeDay key to scoped key when v2 isolation is enabled', async () => {
    vi.stubEnv('VITE_MULTI_ACCOUNT_ISOLATION_V2', 'true');
    globalThis.localStorage.setItem('freeDay_2026-04-24', 'true');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const date = new Date(2026, 3, 24, 12, 0, 0);
    const freeDay = await getIsFreeDay(date, 'CN', 'user-a');

    expect(freeDay).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(globalThis.localStorage.getItem('freeDay_2026-04-24')).toBeNull();
    expect(globalThis.localStorage.getItem('seeday:v2:user:user-a:local:freeDay_2026-04-24')).toBe('true');
  });
});
