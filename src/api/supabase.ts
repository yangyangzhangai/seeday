import { createClient } from '@supabase/supabase-js';

const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c2J1a29maXBlb2lraXJreXl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzMwNTYsImV4cCI6MjA4NTg0OTA1Nn0.IqVYxwU7r45Mj4kSuJlrI3gFw2rfjr-K48lwJbFq5oQ';
const DEFAULT_SUPABASE_URL = 'https://oxsbukofipeoikirkyyy.supabase.co';
const SUPABASE_PROXY_PATH = '/supabase-proxy';

function getBrowserOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  if (!window.location.origin || window.location.origin === 'null') return null;
  return window.location.origin;
}

function shouldUseSameOriginProxy(raw: string): boolean {
  const origin = getBrowserOrigin();
  if (!origin) return false;

  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  if (isLocal) return false;

  try {
    const parsed = new URL(raw);
    return parsed.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

function resolveSupabaseUrl(): string {
  const raw = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const configured = raw || DEFAULT_SUPABASE_URL;

  if (configured.startsWith('/')) {
    const origin = getBrowserOrigin();
    return origin ? `${origin}${configured}` : DEFAULT_SUPABASE_URL;
  }

  if (shouldUseSameOriginProxy(configured)) {
    const origin = getBrowserOrigin();
    return origin ? `${origin}${SUPABASE_PROXY_PATH}` : configured;
  }

  return configured;
}

const SUPABASE_URL = resolveSupabaseUrl();

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
