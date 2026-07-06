import type { Session } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';

const AUTH_SECRET_KEYS = new Set([
  'access_token',
  'refresh_token',
  'provider_token',
  'provider_refresh_token',
  'id_token',
  'token',
  'authorization',
]);

function redactString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+/g, '[jwt-redacted]');
}

function sanitizeAuthDebugValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack).split('\n').slice(0, 8).join('\n') : undefined,
      ...(typeof (value as any).status === 'number' ? { status: (value as any).status } : {}),
      ...(typeof (value as any).code === 'string' ? { code: redactString((value as any).code) } : {}),
      ...(typeof (value as any).isAcquireTimeout === 'boolean' ? { isAcquireTimeout: (value as any).isAcquireTimeout } : {}),
    };
  }
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuthDebugValue(item, seen));
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      AUTH_SECRET_KEYS.has(key.toLowerCase())
        ? '[redacted]'
        : sanitizeAuthDebugValue(entryValue, seen),
    ]),
  );
}

function getSessionDebugSummary(session: Session | null): Record<string, unknown> {
  if (!session) return { hasSession: false };
  const expiresInSeconds = session.expires_at
    ? Math.round(session.expires_at - Date.now() / 1000)
    : null;
  return {
    hasSession: true,
    userId: session.user?.id ?? null,
    expiresAt: session.expires_at ?? null,
    expiresInSeconds,
    hasAccessToken: Boolean(session.access_token),
    hasRefreshToken: Boolean(session.refresh_token),
    tokenType: session.token_type ?? null,
  };
}

export function logSupabaseAuthDebug(
  source: string,
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  console.warn(`[supabase-auth] ${source}`, sanitizeAuthDebugValue({
    error,
    ...extra,
  }));
}

export async function getSupabaseSession(context = 'getSupabaseSession'): Promise<Session | null> {
  const startedAt = Date.now();
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      logSupabaseAuthDebug(`${context}:getSession:error`, error, {
        durationMs: Date.now() - startedAt,
        session: getSessionDebugSummary(data.session),
      });
    }
    return data.session;
  } catch (error) {
    logSupabaseAuthDebug(`${context}:getSession:throw`, error, {
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

export async function refreshSupabaseSession(context = 'refreshSupabaseSession') {
  const startedAt = Date.now();
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      logSupabaseAuthDebug(`${context}:refreshSession:error`, error, {
        durationMs: Date.now() - startedAt,
        session: getSessionDebugSummary(data.session),
      });
    }
    return { data, error };
  } catch (error) {
    logSupabaseAuthDebug(`${context}:refreshSession:throw`, error, {
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}
