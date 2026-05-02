// DOC-DEPS: LLM.md -> docs/SEEDAY_DEV_SPEC.md -> src/store/storageScope.ts
//
// Storage architecture on iOS (two intentional APFS paths):
//   Path A — Preferences / NSUserDefaults plist (Library/Preferences/):
//     Used by this module for auth-session tokens and reminder-scheduler state.
//     Survives WKWebView cache eviction; subject to NSFileProtectionComplete.
//   Path B — WKWebView localStorage / SQLite (Library/WebKit/):
//     Used by Zustand persist (12 domains) and ephemeral UI state (drafts, flags).
//     Subject to WebKit storage-quota eviction; subject to NSFileProtectionComplete.
//
// Zustand persist cannot be moved to Preferences without making all store
// hydration async, so the split is intentional. Both paths are encrypted under
// the same APFS per-file key class declared in App.entitlements.
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function isNativeStorageAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

export async function getPersistentItem(key: string): Promise<string | null> {
  if (isNativeStorageAvailable()) {
    const { value } = await Preferences.get({ key });
    if (value !== null) return value;
    if (canUseLocalStorage()) {
      const legacyValue = window.localStorage.getItem(key);
      if (legacyValue !== null) {
        await Preferences.set({ key, value: legacyValue });
        window.localStorage.removeItem(key);
        return legacyValue;
      }
    }
    return null;
  }
  if (!canUseLocalStorage()) return null;
  return window.localStorage.getItem(key);
}

export async function setPersistentItem(key: string, value: string): Promise<void> {
  if (isNativeStorageAvailable()) {
    await Preferences.set({ key, value });
    return;
  }
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(key, value);
}

export async function removePersistentItem(key: string): Promise<void> {
  if (isNativeStorageAvailable()) {
    await Preferences.remove({ key });
    return;
  }
  if (!canUseLocalStorage()) return;
  window.localStorage.removeItem(key);
}

export const persistentStorageAdapter = {
  getItem: getPersistentItem,
  setItem: setPersistentItem,
  removeItem: removePersistentItem,
};
