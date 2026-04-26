// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/README.md
import i18n from '../i18n';
import { supabase } from '../api/supabase';
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
  profileStateFromMeta,
  savePendingProfileWrite,
  USER_PROFILE_METADATA_KEY,
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

type AccountActionKeys =
  | 'signIn'
  | 'signInWithGoogle'
  | 'signInWithApple'
  | 'signUp'
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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    },

    signInWithGoogle: async () => {
      try {
        const redirectTo = resolveOAuthRedirectUrl();
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: redirectTo ? { redirectTo } : undefined,
        });
        return { error };
      } catch (error: any) {
        return { error };
      }
    },

    signInWithApple: async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        try {
          const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
          const result = await SignInWithApple.authorize({
            clientId: 'com.seeday.app',
            redirectURI: 'https://placeholder.seeday.app',
            scopes: 'email name',
          });
          const identityToken = result.response?.identityToken;
          if (!identityToken) return { error: new Error('No identity token') };
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: identityToken,
          });
          return { error };
        } catch (e: any) {
          return { error: e };
        }
      }
      try {
        const redirectTo = resolveOAuthRedirectUrl();
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: redirectTo ? { redirectTo } : undefined,
        });
        return { error };
      } catch (error: any) {
        return { error };
      }
    },

    signUp: async (email, password, nickname, avatarDataUrl) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: nickname || email.split('@')[0],
            avatar_url: avatarDataUrl || null,
          },
        },
      });
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

      set({
        user: {
          ...currentUser,
          user_metadata: {
            ...(currentUser.user_metadata || {}),
            avatar_url: avatarDataUrl,
          },
        },
      });

      void patchUserMetadata({ avatar_url: avatarDataUrl })
        .then(({ user, error }) => {
          if (!error && user) {
            set({ user });
            return;
          }
          if (import.meta.env.DEV && error) {
            console.warn('[auth] updateAvatar cloud sync failed (local saved):', error);
          }
        })
        .catch((error) => {
          if (import.meta.env.DEV) {
            console.warn('[auth] updateAvatar cloud sync failed (local saved):', error);
          }
        });

      return { error: null };
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
            set({ user });
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
            set({ user });
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

      const patch = {
        [LONG_TERM_PROFILE_ENABLED_KEY]: enabled,
      };

      set({
        user: {
          ...currentUser,
          user_metadata: {
            ...(currentUser.user_metadata || {}),
            ...patch,
          },
        },
        longTermProfileEnabled: enabled,
      });

      void patchUserMetadata(patch)
        .then(({ user, error }) => {
          if (!error && user) {
            const profileState = profileStateFromMeta(user.user_metadata || {});
            set({
              user,
              longTermProfileEnabled: profileState.longTermProfileEnabled,
              userProfileV2: profileState.userProfileV2,
            });
            return;
          }
          if (import.meta.env.DEV && error) {
            console.warn('[auth] updateLongTermProfileEnabled cloud sync failed (local saved):', error);
          }
        })
        .catch((error) => {
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
      const prev = parseUserProfileV2(baseMeta[USER_PROFILE_METADATA_KEY]);
      const nextProfile = typeof updater === 'function'
        ? updater(prev)
        : mergeUserProfile(prev, updater);

      set({ userProfileV2: nextProfile });
      savePendingProfileWrite(currentUser.id, nextProfile);

      const patch = {
        [USER_PROFILE_METADATA_KEY]: {
          ...nextProfile,
          updatedAt: new Date().toISOString(),
          createdAt: nextProfile.createdAt || new Date().toISOString(),
        },
      };
      const userId = currentUser.id;
      patchUserMetadata(patch).then(({ user, error }) => {
        if (!error && user) {
          const profileState = profileStateFromMeta(user.user_metadata || {});
          set({
            user,
            longTermProfileEnabled: profileState.longTermProfileEnabled,
            userProfileV2: profileState.userProfileV2,
          });
          clearPendingProfileWrite(userId);
        }
      }).catch(() => {});
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
            set({ user });
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
