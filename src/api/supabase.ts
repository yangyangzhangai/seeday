import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { persistentStorageAdapter } from '../services/native/storageService';

const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c2J1a29maXBlb2lraXJreXl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzMwNTYsImV4cCI6MjA4NTg0OTA1Nn0.IqVYxwU7r45Mj4kSuJlrI3gFw2rfjr-K48lwJbFq5oQ';
const DEFAULT_SUPABASE_URL = 'https://oxsbukofipeoikirkyyy.supabase.co';

function resolveSupabaseUrl(): string {
  const raw = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  if (!raw) return DEFAULT_SUPABASE_URL;
  return raw;
}

const SUPABASE_URL = resolveSupabaseUrl();

const authLocks = new Map<string, Promise<unknown>>();

async function nativeAuthLock<R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  const previous = authLocks.get(_name) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const next = previous.catch(() => {}).then(() => current);

  authLocks.set(_name, next);

  await previous.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (authLocks.get(_name) === next) {
      authLocks.delete(_name);
    }
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: persistentStorageAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    lock: Capacitor.isNativePlatform() ? nativeAuthLock : undefined,
  },
});
