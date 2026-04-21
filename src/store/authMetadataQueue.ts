import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';

type MetaPatch = Record<string, unknown>;

let metadataWriteChain: Promise<void> = Promise.resolve();
let cachedUserId: string | null = null;
let cachedMetadata: Record<string, unknown> | null = null;

export async function patchUserMetadata(patch: MetaPatch): Promise<{ user: any | null; error: any }> {
  let result: { user: any | null; error: any } = { user: null, error: null };

  metadataWriteChain = metadataWriteChain.then(async () => {
    const latestSession = await getSupabaseSession();
    const sessionUserId = latestSession?.user?.id ?? null;
    const sessionMeta = (latestSession?.user?.user_metadata || {}) as Record<string, unknown>;
    if (!sessionUserId) {
      cachedUserId = null;
      cachedMetadata = null;
      result = { user: null, error: new Error('No active session') };
      return;
    }

    if (cachedUserId !== sessionUserId) {
      cachedUserId = sessionUserId;
      cachedMetadata = { ...sessionMeta };
    }

    const baseMeta = (cachedMetadata || sessionMeta) as Record<string, unknown>;
    const merged = { ...baseMeta, ...patch };
    const { data, error } = await supabase.auth.updateUser({ data: merged });
    if (!error && data?.user?.user_metadata) {
      cachedUserId = data.user.id;
      cachedMetadata = { ...(data.user.user_metadata as Record<string, unknown>) };
    }
    result = { user: data?.user ?? null, error };
  }).catch((error) => {
    result = { user: null, error };
  });

  await metadataWriteChain;
  return result;
}
