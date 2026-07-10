// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/README.md
import i18n from '../i18n';
import { supabase } from '../api/supabase';
import { isDataUrl, uploadAvatarToStorage } from '../lib/avatarStorage';
import { formatUserFacingDiagnostic, logDiagnostic } from '../lib/diagnostics';
import { applyCloudAvatarToUser, upsertCloudUserProfile } from './authProfileCloudStore';
import { persistLanguageToLocalStorage, normalizeUiLanguage } from './authLanguageHelpers';
import { markLocalDataOwnerAnonymous } from './authLocalOwnerHelpers';
import { patchUserMetadata } from './authMetadataQueue';
import {
  DEFAULT_PREFERENCES,
  normalizePreferencesForMembership,
  queuePreferenceSnapshot,
} from './authPreferenceHelpers';
import {
  clearPendingProfileWrite,
  LONG_TERM_PROFILE_ENABLED_KEY,
  mergeUserProfile,
  parseUserProfileV2,
  savePendingProfileWrite,
} from './authProfileHelpers';
import { fetchActivityStreak } from './authStreakHelpers';
import {
  clearLocalDomainStores,
  DEFAULT_MEMBERSHIP_STATE,
  rehydrateAllDomainPersistStores,
  resolveOAuthRedirectUrl,
  setScopeForAuthUser,
  syncAnnotationStateWithPreferences,
} from './authStoreRuntimeHelpers';
import type { AuthState } from './authStoreTypes';
import { resolveStorageScopeForUser } from './storageScope';

type AuthSet = (patch: Partial<AuthState>) => void;
type AuthGet = () => AuthState;

function toCloudAvatarUrl(value?: string | null): string | null {
  if (!value) return null;
  return isDataUrl(value) ? null : value;
}

function decorateAuthError(operation: string, error: any, elapsedMs: number): any {
  if (!error) return null;
  const detailed = formatUserFacingDiagnostic(`Supabase Auth ${operation}`, error, {
    path: operation,
    status: typeof error.status === 'number' ? error.status : undefined,
    code: typeof error.code === 'string' || typeof error.code === 'number' ? error.code : undefined,
    elapsedMs,
  });
  const nextError = new Error(detailed);
  Object.assign(nextError, {
    originalMessage: error.message,
    status: error.status,
    code: error.code,
    name: error.name || 'SupabaseAuthError',
  });
  return nextError;
}

async function runAuthAction<T>(
  operation: string,
  fn: () => Promise<{ data?: T; error: any }>,
): Promise<{ data?: T; error: any }> {
  const startedAt = Date.now();
  logDiagnostic('info', 'auth.action.start', { operation });
  try {
    const result = await fn();
    const elapsedMs = Date.now() - startedAt;
    if (result.error) {
      const decorated = decorateAuthError(operation, result.error, elapsedMs);
      logDiagnostic('warn', 'auth.action.failed', {
        operation,
        elapsedMs,
        error: result.error,
        userFacing: decorated?.message,
      });
      return { ...result, error: decorated };
    }
    logDiagnostic('info', 'auth.action.success', { operation, elapsedMs });
    return result;
  } catch (error: any) {
    const elapsedMs = Date.now() - startedAt;
    const decorated = decorateAuthError(operation, error, elapsedMs);
    logDiagnostic('error', 'auth.action.threw', {
      operation,
      elapsedMs,
      error,
      userFacing: decorated?.message,
    });
    return { error: decorated ?? error };
  }
}

type AccountActionKeys =
  | 'signIn'
  | 'signInWithGoogle'
  | 'signInWithApple'
  | 'signUp'
  | 'verifySignUpCode'
  | 'resendSignUpCode'
  | 'signOut'
  | 'updateAvatar'
  | 'updateDisplayName'
  | 'updateLocationMetadata'
  | 'updateLongTermProfileEnabled'
  | 'updateUserProfile'
  | 'updatePreferences'
  | 'updateLanguagePreference'
  | 'refreshActivityStreak';

export function createAuthAccountActions(set: AuthSet, get: AuthGet): Pick<AuthState, AccountActionKeys> {
  return {
    signIn: async (email, password) => {
      const { error } = await runAuthAction('signInWithPassword', () => supabase.auth.signInWithPassword({ email, password }));
      return { error };
    },

    signInWithGoogle: async () => {
      const redirectTo = resolveOAuthRedirectUrl();
      const { error } = await runAuthAction('signInWithOAuth:google', () => supabase.auth.signInWithOAuth({
          provider: 'google',
          options: redirectTo ? { redirectTo } : undefined,
      }));
      return { error };
    },

    signInWithApple: async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        try {
          const nativeStartedAt = Date.now();
          logDiagnostic('info', 'auth.apple.native_authorize.start');
          const redirectTo = resolveOAuthRedirectUrl();
          if (!redirectTo || /placeholder\.seeday\.app/i.test(redirectTo)) {
            return { error: new Error('Invalid Apple OAuth redirect URI') };
          }
          const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
          const result = await SignInWithApple.authorize({
            clientId: 'com.seeday.app',
            redirectURI: redirectTo,
            scopes: 'email name',
          });
          logDiagnostic('info', 'auth.apple.native_authorize.success', {
            elapsedMs: Date.now() - nativeStartedAt,
            hasIdentityToken: Boolean(result.response?.identityToken),
          });
          const identityToken = result.response?.identityToken;
          if (!identityToken) return { error: new Error('No identity token') };
          const { error } = await runAuthAction('signInWithIdToken:apple', () => supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: identityToken,
          }));
          return { error };
        } catch (e: any) {
          const decorated = decorateAuthError('Apple native authorize', e, 0);
          logDiagnostic('error', 'auth.apple.native_authorize.failed', {
            error: e,
            userFacing: decorated?.message,
          });
          return { error: decorated ?? e };
        }
      }
      const redirectTo = resolveOAuthRedirectUrl();
      const { error } = await runAuthAction('signInWithOAuth:apple', () => supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: redirectTo ? { redirectTo } : undefined,
      }));
      return { error };
    },

    signUp: async (email, password, nickname, avatarDataUrl) => {
      const { error } = await runAuthAction('signUp', () => supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: nickname || email.split('@')[0],
            avatar_url: toCloudAvatarUrl(avatarDataUrl),
          },
        },
      }));
      return { error };
    },

    verifySignUpCode: async (email, code) => {
      const normalizedEmail = email.trim();
      const normalizedCode = code.trim();
      if (!normalizedEmail || !normalizedCode) {
        return { error: new Error('Invalid verification code') };
      }
      const { error } = await runAuthAction('verifyOtp:signup', () => supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedCode,
        type: 'signup',
      }));
      return { error };
    },

    resendSignUpCode: async (email) => {
      const normalizedEmail = email.trim();
      if (!normalizedEmail) {
        return { error: new Error('Invalid email') };
      }
      const { error } = await runAuthAction('resendOtp:signup', () => supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
      }));
      return { error };
    },

    signOut: async () => {
      const previousUserId = get().user?.id || null;
      setScopeForAuthUser(null, 'signOut:action');
      clearLocalDomainStores(resolveStorageScopeForUser(previousUserId));
      await rehydrateAllDomainPersistStores();
      markLocalDataOwnerAnonymous();
      set({
        user: null,
        preferences: DEFAULT_PREFERENCES,
        longTermProfileEnabled: false,
        userProfileV2: null,
        membershipPlan: DEFAULT_MEMBERSHIP_STATE.plan,
        membershipSource: DEFAULT_MEMBERSHIP_STATE.source,
        isPlus: DEFAULT_MEMBERSHIP_STATE.isPlus,
        activityStreak: null,
      });
      try {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
            localStorage.removeItem(key);
          }
        });
      } catch {
        // storage unavailable
      }
      supabase.auth.signOut({ scope: 'global' }).catch(() => {});
    },

    updateAvatar: async (avatarDataUrl: string) => {
      const currentUser = get().user;
      if (!currentUser) {
        return { error: new Error('Not signed in') };
      }

      if (!isDataUrl(avatarDataUrl)) {
        set({
          user: {
            ...currentUser,
            user_metadata: {
              ...(currentUser.user_metadata || {}),
              avatar_url: avatarDataUrl,
            },
          },
        });
      }

      try {
        const cloudAvatarUrl = isDataUrl(avatarDataUrl)
          ? await uploadAvatarToStorage(currentUser.id, avatarDataUrl)
          : avatarDataUrl;
        await upsertCloudUserProfile(currentUser.id, { avatarUrl: cloudAvatarUrl });
        set({
          user: {
            ...currentUser,
            user_metadata: {
              ...(currentUser.user_metadata || {}),
              avatar_url: cloudAvatarUrl,
            },
          },
        });
        logDiagnostic('info', 'auth.avatar_update.cloud_synced', {
          userId: currentUser.id,
          avatarUrlChars: cloudAvatarUrl.length,
          target: 'user_profiles.avatar_url',
        });
        return { error: null };
      } catch (error) {
        logDiagnostic('error', 'auth.avatar_update.cloud_sync_failed', {
          userId: currentUser.id,
          error,
          note: 'Auth metadata was not updated with a data URL.',
        });
        if (import.meta.env.DEV) {
          console.warn('[auth] updateAvatar cloud sync failed (local saved):', error);
        }
        return { error };
      }
    },

    updateDisplayName: async (displayName: string) => {
      const currentUser = get().user;
      if (!currentUser) {
        return { error: new Error('Not signed in') };
      }

      set({
        user: {
          ...currentUser,
          user_metadata: {
            ...(currentUser.user_metadata || {}),
            display_name: displayName,
          },
        },
      });

      void patchUserMetadata({ display_name: displayName })
        .then(({ user, error }) => {
          if (!error && user) {
            set({ user: applyCloudAvatarToUser(user, get().user?.user_metadata?.avatar_url ?? null) });
            return;
          }
          if (import.meta.env.DEV && error) {
            console.warn('[auth] updateDisplayName cloud sync failed (local saved):', error);
          }
        })
        .catch((error) => {
          if (import.meta.env.DEV) {
            console.warn('[auth] updateDisplayName cloud sync failed (local saved):', error);
          }
        });

      return { error: null };
    },

    updateLocationMetadata: async (input) => {
      const currentUser = get().user;
      if (!currentUser) {
        return { error: new Error('Not signed in') };
      }

      const normalizedCountryCode = input.countryCode.trim().toUpperCase();
      const latitude = Number(input.latitude);
      const longitude = Number(input.longitude);
      if (!/^[A-Z]{2}$/.test(normalizedCountryCode) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return { error: new Error('Invalid location metadata') };
      }

      const patch = {
        country_code: normalizedCountryCode,
        latitude: Number(latitude.toFixed(6)),
        longitude: Number(longitude.toFixed(6)),
        location_label: typeof input.locationLabel === 'string' && input.locationLabel.trim()
          ? input.locationLabel.trim()
          : null,
        location_source: input.source || 'manual_geocode',
        location_updated_at: new Date().toISOString(),
      };

      set({
        user: {
          ...currentUser,
          user_metadata: {
            ...(currentUser.user_metadata || {}),
            ...patch,
          },
        },
      });

      void patchUserMetadata(patch)
        .then(({ user, error }) => {
          if (!error && user) {
            set({ user: applyCloudAvatarToUser(user, get().user?.user_metadata?.avatar_url ?? null) });
            return;
          }
          if (import.meta.env.DEV && error) {
            console.warn('[auth] updateLocationMetadata cloud sync failed (local saved):', error);
          }
        });

      return { error: null };
    },

    updateLongTermProfileEnabled: async (enabled) => {
      const currentUser = get().user;
      if (!currentUser) {
        return { error: new Error('Not signed in') };
      }

      set({
        user: {
          ...currentUser,
          user_metadata: {
            ...(currentUser.user_metadata || {}),
            [LONG_TERM_PROFILE_ENABLED_KEY]: enabled,
          },
        },
        longTermProfileEnabled: enabled,
      });

      void upsertCloudUserProfile(currentUser.id, { longTermProfileEnabled: enabled })
        .catch((error) => {
          logDiagnostic('error', 'auth.profile_cloud.enabled_update.failed', {
            userId: currentUser.id,
            enabled,
            error,
          });
          if (import.meta.env.DEV) {
            console.warn('[auth] updateLongTermProfileEnabled cloud sync failed (local saved):', error);
          }
        });

      return { error: null };
    },

    updateUserProfile: async (updater) => {
      const currentUser = get().user;
      if (!currentUser) {
        return { error: new Error('Not signed in') };
      }

      const baseMeta: Record<string, any> = currentUser.user_metadata || {};
      const prev = get().userProfileV2 ?? parseUserProfileV2(baseMeta.user_profile_v2);
      const nextProfile = typeof updater === 'function'
        ? updater(prev)
        : mergeUserProfile(prev, updater);

      set({ userProfileV2: nextProfile });
      savePendingProfileWrite(currentUser.id, nextProfile);

      const profileToSave = {
        ...nextProfile,
        updatedAt: new Date().toISOString(),
        createdAt: nextProfile.createdAt || new Date().toISOString(),
      };
      const userId = currentUser.id;
      upsertCloudUserProfile(userId, { profile: profileToSave }).then(() => {
        set({ userProfileV2: profileToSave });
        clearPendingProfileWrite(userId);
      }).catch((error) => {
        logDiagnostic('error', 'auth.profile_cloud.profile_update.failed', {
          userId,
          error,
        });
      });
      return { error: null };
    },

    updatePreferences: async (partial) => {
      const merged = { ...get().preferences, ...partial };
      const normalized = normalizePreferencesForMembership(merged, get().isPlus);
      set({ preferences: normalized });
      syncAnnotationStateWithPreferences(normalized, get().isPlus);
      queuePreferenceSnapshot(normalized);
    },

    updateLanguagePreference: async (language: string) => {
      const normalized = normalizeUiLanguage(language);
      await i18n.changeLanguage(normalized);
      persistLanguageToLocalStorage(normalized);
      const currentUser = get().user;
      if (!currentUser) {
        return { error: null };
      }
      set({
        user: {
          ...currentUser,
          user_metadata: {
            ...(currentUser.user_metadata || {}),
            i18nextLng: normalized,
          },
        },
      });
      void patchUserMetadata({ i18nextLng: normalized })
        .then(({ user, error }) => {
          if (!error && user) {
            set({ user: applyCloudAvatarToUser(user, get().user?.user_metadata?.avatar_url ?? null) });
            return;
          }
          if (import.meta.env.DEV && error) {
            console.warn('[auth] updateLanguagePreference cloud sync failed (local saved):', error);
          }
        })
        .catch((error) => {
          if (import.meta.env.DEV) {
            console.warn('[auth] updateLanguagePreference cloud sync failed (local saved):', error);
          }
        });
      return { error: null };
    },

    refreshActivityStreak: async () => {
      const userId = get().user?.id;
      if (!userId) return;
      const streak = await fetchActivityStreak(userId, true);
      set({ activityStreak: streak });
    },
  };
}
