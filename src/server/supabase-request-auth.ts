import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { jsonError } from './http.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || requireEnv('SUPABASE_URL');
}

export function getSupabaseAnonKey(): string {
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || requireEnv('SUPABASE_ANON_KEY');
}

export function getSupabaseServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export function getBearerToken(req: VercelRequest): string | null {
  const raw = req.headers.authorization;
  if (!raw) return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function createAuthedSupabaseClient(url: string, key: string, token?: string): SupabaseClient {
  return createClient(url, key, {
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
  });
}

export async function requireSupabaseRequestAuth(
  req: VercelRequest,
  res: VercelResponse,
): Promise<{
  user: User;
  token: string;
  userClient: SupabaseClient;
  adminClient: SupabaseClient | null;
} | null> {
  const token = getBearerToken(req);
  if (!token) {
    jsonError(res, 401, 'Unauthorized');
    return null;
  }

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const userClient = createAuthedSupabaseClient(url, anonKey, token);
  const { data, error } = await userClient.auth.getUser(token);

  if (error || !data.user) {
    jsonError(res, 401, 'Unauthorized');
    return null;
  }

  const serviceRoleKey = getSupabaseServiceRoleKey();
  const adminClient = serviceRoleKey ? createClient(url, serviceRoleKey) : null;

  return {
    user: data.user,
    token,
    userClient,
    adminClient,
  };
}

function hasAdminRole(raw: unknown): boolean {
  if (typeof raw === 'string') {
    return ['admin', 'owner', 'staff', 'internal', 'super_admin'].includes(raw.trim().toLowerCase());
  }

  if (Array.isArray(raw)) {
    return raw.some((item) => hasAdminRole(item));
  }

  return false;
}

function csvToSet(raw: string | undefined): Set<string> {
  return new Set(
    (raw || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isLiveInputAdminUser(user: User): boolean {
  if (
    hasAdminRole(user.app_metadata?.role)
    || hasAdminRole(user.user_metadata?.role)
    || hasAdminRole(user.app_metadata?.roles)
    || hasAdminRole(user.user_metadata?.roles)
  ) {
    return true;
  }

  const allowedEmails = csvToSet(process.env.LIVE_INPUT_ADMIN_EMAILS);
  if (user.email && allowedEmails.has(user.email.toLowerCase())) {
    return true;
  }

  const allowedUserIds = csvToSet(process.env.LIVE_INPUT_ADMIN_USER_IDS);
  return allowedUserIds.has(user.id.toLowerCase());
}
