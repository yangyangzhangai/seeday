import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import { formatUserFacingDiagnostic, logDiagnostic } from '../lib/diagnostics';

type MetaPatch = Record<string, unknown>;

let metadataWriteChain: Promise<void> = Promise.resolve();
let cachedUserId: string | null = null;
let cachedMetadata: Record<string, unknown> | null = null;

export async function patchUserMetadata(patch: MetaPatch): Promise<{ user: any | null; error: any }> {
  let result: { user: any | null; error: any } = { user: null, error: null };

  metadataWriteChain = metadataWriteChain.then(async () => {
    const startedAt = Date.now();
    logDiagnostic('info', 'auth.metadata.patch.start', {
      patchKeys: Object.keys(patch),
    });
    const latestSession = await getSupabaseSession();
    const sessionUserId = latestSession?.user?.id ?? null;
    const sessionMeta = (latestSession?.user?.user_metadata || {}) as Record<string, unknown>;
    if (!sessionUserId) {
      cachedUserId = null;
      cachedMetadata = null;
      result = { user: null, error: new Error('No active session') };
      logDiagnostic('warn', 'auth.metadata.patch.no_session', {
        elapsedMs: Date.now() - startedAt,
        patchKeys: Object.keys(patch),
      });
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
    if (error) {
      logDiagnostic('warn', 'auth.metadata.patch.failed', {
        elapsedMs: Date.now() - startedAt,
        userId: sessionUserId,
        patchKeys: Object.keys(patch),
        error,
        userFacing: formatUserFacingDiagnostic('Supabase Auth updateUser metadata', error, {
          path: 'auth.updateUser',
          elapsedMs: Date.now() - startedAt,
        }),
      });
    } else {
      logDiagnostic('info', 'auth.metadata.patch.success', {
        elapsedMs: Date.now() - startedAt,
        userId: sessionUserId,
        patchKeys: Object.keys(patch),
      });
    }
  }).catch((error) => {
    result = { user: null, error };
    logDiagnostic('error', 'auth.metadata.patch.threw', {
      error,
      userFacing: formatUserFacingDiagnostic('Supabase Auth metadata queue', error, {
        path: 'authMetadataQueue',
      }),
    });
  });

  await metadataWriteChain;
  return result;
}
