import type { Session } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';

export async function getSupabaseSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

export async function getSessionUserId(): Promise<string | null> {
  const session = await getSupabaseSession();
  return session?.user.id ?? null;
}

export async function withSession<T>(
  onSession: (session: Session) => Promise<T> | T,
  onNoSession?: () => Promise<T> | T,
): Promise<T | undefined> {
  const session = await getSupabaseSession();
  if (!session) {
    return onNoSession ? onNoSession() : undefined;
  }

  return onSession(session);
}
