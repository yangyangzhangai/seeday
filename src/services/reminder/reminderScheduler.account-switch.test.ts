import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../notifications/localNotificationService', () => ({
  scheduleBatchNotifications: vi.fn(async () => true),
  cancelAllNotifications: vi.fn(async () => {}),
  getPendingNotificationIds: vi.fn(async () => []),
}));

import {
  cancelAllNotifications,
  scheduleBatchNotifications,
} from '../notifications/localNotificationService';
import { scheduleRemindersForToday } from './reminderScheduler';

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

describe('reminderScheduler account switch isolation', () => {
  beforeEach(() => {
    const storage = createMemoryStorage();
    (globalThis as { localStorage?: Storage }).localStorage = storage;
    (globalThis as { window?: Window }).window = { localStorage: storage } as Window;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 25, 9, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    delete (globalThis as { localStorage?: Storage }).localStorage;
    delete (globalThis as { window?: Window }).window;
  });

  it('keeps reminder schedule markers isolated across user scopes', async () => {
    vi.stubEnv('VITE_MULTI_ACCOUNT_ISOLATION_V2', 'true');

    const baseOptions = {
      manual: {},
      aiMode: 'van',
      countryCode: 'CN',
      getCopyFn: () => 'copy',
    };

    await scheduleRemindersForToday({ ...baseOptions, storageUserId: 'user-a' });
    await scheduleRemindersForToday({ ...baseOptions, storageUserId: 'user-b' });

    expect(localStorage.getItem('seeday:v2:user:user-a:local:reminder_scheduled_date')).toBe('2026-04-25');
    expect(localStorage.getItem('seeday:v2:user:user-b:local:reminder_scheduled_date')).toBe('2026-04-25');
    expect(localStorage.getItem('seeday:v2:user:user-a:local:reminder_today_count')).toBe('3');
    expect(localStorage.getItem('seeday:v2:user:user-b:local:reminder_today_count')).toBe('3');
    expect(localStorage.getItem('reminder_scheduled_date')).toBeNull();
    expect(localStorage.getItem('reminder_today_count')).toBeNull();
    expect(cancelAllNotifications).toHaveBeenCalledTimes(2);
    expect(scheduleBatchNotifications).toHaveBeenCalledTimes(2);
  });
});
