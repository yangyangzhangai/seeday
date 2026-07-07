// DOC-DEPS: LLM.md -> docs/DATA_STORAGE_AUDIT_REPORT.md -> src/store/README.md
import { supabase } from '../api/supabase';
import { formatUserFacingDiagnostic, logDiagnostic } from '../lib/diagnostics';
import type { UserProfileV2 } from '../types/userProfile';
import {
  getPendingProfileWrite,
  clearPendingProfileWrite,
  LONG_TERM_PROFILE_ENABLED_KEY,
  parseUserProfileV2,
  USER_PROFILE_METADATA_KEY,
} from './authProfileHelpers';

export interface CloudUserProfileState {
  longTermProfileEnabled: boolean;
  userProfileV2: UserProfileV2 | null;
  source: 'cloud' | 'metadata_fallback';
}

const LOGIN_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeLoginDays(rawDays: unknown): string[] {
  if (!Array.isArray(rawDays)) return [];
  const uniq = new Set(
    rawDays.filter((d): d is string => typeof d === 'string' && LOGIN_DAY_PATTERN.test(d)),
  );
  return Array.from(uniq).sort();
}

function profileStateFromMetadata(user: any): CloudUserProfileState {
  const meta = user?.user_metadata || {};
  return {
    longTermProfileEnabled: meta[LONG_TERM_PROFILE_ENABLED_KEY] === true,
    userProfileV2: parseUserProfileV2(meta[USER_PROFILE_METADATA_KEY]),
    source: 'metadata_fallback',
  };
}

export async function fetchCloudUserProfileState(user: any): Promise<CloudUserProfileState> {
  const startedAt = Date.now();
  const fallback = profileStateFromMetadata(user);
  if (!user?.id) return fallback;

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('profile,long_term_profile_enabled')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return fallback;

    const state: CloudUserProfileState = {
      longTermProfileEnabled: data.long_term_profile_enabled === true,
      userProfileV2: parseUserProfileV2(data.profile),
      source: 'cloud',
    };
    logDiagnostic('info', 'auth.profile_cloud.fetch.success', {
      userId: user.id,
      elapsedMs: Date.now() - startedAt,
      hasProfile: Boolean(state.userProfileV2),
      enabled: state.longTermProfileEnabled,
    });
    return state;
  } catch (error) {
    logDiagnostic('warn', 'auth.profile_cloud.fetch.failed_using_metadata', {
      userId: user.id,
      elapsedMs: Date.now() - startedAt,
      error,
      userFacing: formatUserFacingDiagnostic('Supabase user_profiles fetch', error, {
        path: 'user_profiles.select',
        elapsedMs: Date.now() - startedAt,
      }),
    });
    return fallback;
  }
}

export async function upsertCloudUserProfile(
  userId: string,
  patch: { profile?: UserProfileV2 | null; longTermProfileEnabled?: boolean },
): Promise<void> {
  const startedAt = Date.now();
  const row: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if ('profile' in patch) row.profile = patch.profile;
  if ('longTermProfileEnabled' in patch) row.long_term_profile_enabled = patch.longTermProfileEnabled;

  const { error } = await supabase
    .from('user_profiles')
    .upsert(row, { onConflict: 'user_id' });

  if (error) {
    logDiagnostic('error', 'auth.profile_cloud.upsert.failed', {
      userId,
      elapsedMs: Date.now() - startedAt,
      hasProfilePatch: 'profile' in patch,
      hasEnabledPatch: 'longTermProfileEnabled' in patch,
      error,
      userFacing: formatUserFacingDiagnostic('Supabase user_profiles upsert', error, {
        path: 'user_profiles.upsert',
        elapsedMs: Date.now() - startedAt,
      }),
    });
    throw error;
  }

  logDiagnostic('info', 'auth.profile_cloud.upsert.success', {
    userId,
    elapsedMs: Date.now() - startedAt,
    hasProfilePatch: 'profile' in patch,
    hasEnabledPatch: 'longTermProfileEnabled' in patch,
  });
}

export async function ensureTodayLoginDayInCloud(user: any, today: string): Promise<void> {
  const startedAt = Date.now();
  if (!user?.id) return;
  const { error } = await supabase
    .from('user_login_days')
    .upsert(
      { user_id: user.id, login_date: today },
      { onConflict: 'user_id,login_date' },
    );

  if (error) {
    logDiagnostic('warn', 'auth.login_days_cloud.upsert.failed', {
      userId: user.id,
      today,
      elapsedMs: Date.now() - startedAt,
      error,
      userFacing: formatUserFacingDiagnostic('Supabase user_login_days upsert', error, {
        path: 'user_login_days.upsert',
        elapsedMs: Date.now() - startedAt,
      }),
    });
    throw error;
  }

  logDiagnostic('info', 'auth.login_days_cloud.upsert.success', {
    userId: user.id,
    today,
    elapsedMs: Date.now() - startedAt,
  });
}

export async function migrateMetadataProfileToCloud(user: any): Promise<CloudUserProfileState> {
  const fallback = profileStateFromMetadata(user);
  if (!user?.id || (!fallback.userProfileV2 && fallback.longTermProfileEnabled !== true)) {
    return fallback;
  }

  const cloudState = await fetchCloudUserProfileState(user);
  if (cloudState.source === 'cloud' && (cloudState.userProfileV2 || cloudState.longTermProfileEnabled)) {
    return cloudState;
  }

  await upsertCloudUserProfile(user.id, {
    profile: fallback.userProfileV2,
    longTermProfileEnabled: fallback.longTermProfileEnabled,
  });
  return { ...fallback, source: 'cloud' };
}

export async function flushPendingProfileWriteToCloud(userId: string): Promise<UserProfileV2 | null> {
  const pendingProfile = getPendingProfileWrite(userId);
  if (!pendingProfile) return null;
  await upsertCloudUserProfile(userId, {
    profile: {
      ...pendingProfile,
      updatedAt: new Date().toISOString(),
    },
  });
  clearPendingProfileWrite(userId);
  return pendingProfile;
}
