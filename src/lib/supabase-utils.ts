import type { Session } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';

export async function getSupabaseSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}
