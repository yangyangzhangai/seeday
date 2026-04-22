import { createClient } from '@supabase/supabase-js';

const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c2J1a29maXBlb2lraXJreXl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzMwNTYsImV4cCI6MjA4NTg0OTA1Nn0.IqVYxwU7r45Mj4kSuJlrI3gFw2rfjr-K48lwJbFq5oQ';
const DEFAULT_SUPABASE_URL = 'https://oxsbukofipeoikirkyyy.supabase.co';

function decodeBase64Url(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    if (typeof atob === 'function') {
      return atob(padded);
    }
    return Buffer.from(padded, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

function resolveSupabaseUrl(): string {
  const raw = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  if (!raw) return DEFAULT_SUPABASE_URL;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return DEFAULT_SUPABASE_URL;
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  const looksLikeProxy = /(^|\/)supabase-proxy$/.test(normalizedPath);
  if (!looksLikeProxy) return raw;

  const payloadSeg = SUPABASE_KEY.split('.')[1];
  if (!payloadSeg) return raw;
  const payloadRaw = decodeBase64Url(payloadSeg);
  if (!payloadRaw) return raw;

  try {
    const payload = JSON.parse(payloadRaw) as { ref?: unknown };
    const ref = typeof payload.ref === 'string' ? payload.ref.trim() : '';
    if (!ref) return raw;
    return `https://${ref}.supabase.co`;
  } catch {
    return raw;
  }
}

const SUPABASE_URL = resolveSupabaseUrl();

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
