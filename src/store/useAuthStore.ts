// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/auth/README.md
import { create } from 'zustand';
import { supabase } from '../api/supabase';
import { callDeleteAccountAPI } from '../api/client';
import { getSupabaseSession } from '../lib/supabase-utils';
import { useAnnotationStore } from './useAnnotationStore';
import { createAuthAccountActions } from './authStoreAccountActions';
import { syncLocalDataToSupabase } from './authDataSyncHelpers';
import {
  DEFAULT_PREFERENCES,
  normalizePreferencesForMembership,
  preferencesFromMeta,
  queuePreferenceSnapshot,
} from './authPreferenceHelpers';
import {
  ensureCloudLanguageMetadata,
  syncI18nLanguageFromMeta,
} from './authLanguageHelpers';
import type { AuthState } from './authStoreTypes';
export type {
  AnnotationDropRate,
  LocationMetadataInput,
  MembershipPlan,
  MembershipSource,
  MembershipState,
  UiLanguage,
  UserPreferences,
} from './authStoreTypes';
export {
  getAnnotationConfigFromPreferences,
  resolveMembershipState,
} from './authStoreRuntimeHelpers';
import {
  markLocalDataOwnerAnonymous,
  markLocalDataOwnerUser,
  readLocalDataOwner,
} from './authLocalOwnerHelpers';
import { resolveLocalDataMigrationDecision } from './authLocalMigrationPolicy';
import {
  clearPendingProfileWrite,
  getPendingProfileWrite,
  profileStateFromMeta,
  USER_PROFILE_METADATA_KEY,
} from './authProfileHelpers';
import { fetchActivityStreak, updateLoginStreak } from './authStreakHelpers';
import { patchUserMetadata } from './authMetadataQueue';
import {
  isMultiAccountIsolationV2Enabled,
  logStorageScopeEvent,
  resolveStorageScopeForUser,
} from './storageScope';
import {
  applyLegacyScopeMigrationIfAllowed,
  clearLocalDomainStores,
  DEFAULT_MEMBERSHIP_STATE,
  ensureTodayLoginDay,
  getAnnotationConfigFromPreferences,
  hasAnyLocalDataToMigrate,
  hasAnyPersistedDomainData,
  hydrateGrowthDailyGoalFromMeta,
  markGrowthDailyLoginSession,
  refreshDomainStoresForSession,
  rehydrateAllDomainPersistStores,
  resolveMembershipState,
  resolveOAuthRedirectUrl,
  setScopeForAuthUser,
  syncAnnotationStateWithPreferences,
} from './authStoreRuntimeHelpers';

async function checkAndHandlePendingDeletion(user: { id: string; user_metadata?: Record<string, unknown> }): Promise<void> {
  const pendingAt = user.user_metadata?.pending_deletion_at;
  if (!pendingAt || typeof pendingAt !== 'string') return;
  const deletionTime = new Date(pendingAt).getTime();
  const now = Date.now();
  if (now < deletionTime) {
    await supabase.auth.updateUser({ data: { pending_deletion_at: null } });
    return;
  }
  try {
    await callDeleteAccountAPI();
  } catch {
    // noop
  } finally {
    await supabase.auth.signOut({ scope: 'global' });
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  preferences: DEFAULT_PREFERENCES,
  longTermProfileEnabled: false,
  userProfileV2: null,
  membershipPlan: DEFAULT_MEMBERSHIP_STATE.plan,
  membershipSource: DEFAULT_MEMBERSHIP_STATE.source,
  isPlus: DEFAULT_MEMBERSHIP_STATE.isPlus,
  activityStreak: null,

  initialize: async () => {
    // Get initial session
    const session = await getSupabaseSession();
    const owner = readLocalDataOwner();
    const hasPersistedDomainData = hasAnyPersistedDomainData();
    const initialScope = setScopeForAuthUser(session?.user?.id, 'initialize:start');
    if (session?.user?.id) {
      applyLegacyScopeMigrationIfAllowed(initialScope, 'initialize:start', session.user.id);
    }
    await rehydrateAllDomainPersistStores();
    // getSession() reads the local JWT which may be stale after server-side metadata updates.
    // getUser() makes a server round-trip and returns the current raw_user_meta_data / raw_app_meta_data,
    // which is required for membership resolution to reflect the latest subscription state.
    let sessionUser = session?.user ?? null;
    if (session?.user) {
      try {
        const { data: freshUser } = await supabase.auth.getUser();
        if (freshUser?.user) sessionUser = freshUser.user;
      } catch {
        // fall back to JWT user on network error
      }
    }
    // Fire metadata writes in the background — don't block loading screen
    if (sessionUser) {
      void ensureTodayLoginDay(sessionUser)
        .then((u) => ensureCloudLanguageMetadata(u))
        .then((u) => { if (u !== sessionUser) set({ user: u }); })
        .catch(() => {});
    }
    const meta = sessionUser?.user_metadata || {};
    const rawPreferences = sessionUser ? preferencesFromMeta(meta) : DEFAULT_PREFERENCES;
    const profileState = profileStateFromMeta(meta);
    const membership = resolveMembershipState(sessionUser);
    const nextPreferences = normalizePreferencesForMembership(rawPreferences, membership.isPlus);
    syncI18nLanguageFromMeta(meta);
    syncAnnotationStateWithPreferences(nextPreferences, membership.isPlus);
    // Apply locally-cached profile if Supabase metadata is missing/stale
    const pendingProfile = sessionUser ? getPendingProfileWrite(sessionUser.id) : null;
    const resolvedProfile = profileState.userProfileV2 ?? pendingProfile;
    set({
      user: sessionUser,
      loading: false,
      preferences: nextPreferences,
      longTermProfileEnabled: profileState.longTermProfileEnabled,
      userProfileV2: resolvedProfile,
      membershipPlan: membership.plan,
      membershipSource: membership.source,
      isPlus: membership.isPlus,
    });
    // Retry syncing pending profile write to Supabase in the background
    if (sessionUser && pendingProfile && !profileState.userProfileV2) {
      const retryPatch = {
        [USER_PROFILE_METADATA_KEY]: {
          ...pendingProfile,
          updatedAt: new Date().toISOString(),
        },
      };
      patchUserMetadata(retryPatch).then(({ user: updatedUser, error }) => {
        if (!error && updatedUser) {
          const synced = profileStateFromMeta(updatedUser.user_metadata || {});
          set({ user: updatedUser, userProfileV2: synced.userProfileV2 });
          clearPendingProfileWrite(sessionUser!.id);
        }
      }).catch(() => { /* stay silent — will retry on next init */ });
    }

    if (import.meta.env.DEV && sessionUser) {
      console.log('[Membership] resolved membership:', {
        userId: sessionUser.id,
        plan: membership.plan,
        source: membership.source,
      });
    }
    if (
      sessionUser
      && (
        rawPreferences.aiMode !== nextPreferences.aiMode
        || rawPreferences.annotationDropRate !== nextPreferences.annotationDropRate
      )
    ) {
      queuePreferenceSnapshot(nextPreferences);
    }
    if (session?.user) {
      const hasLocalData = hasAnyLocalDataToMigrate();
      const migrationDecision = resolveLocalDataMigrationDecision({
        owner,
        hasLocalData,
        currentUserId: session.user.id,
        isolationV2Enabled: isMultiAccountIsolationV2Enabled(),
      });
      if (migrationDecision.action === 'clear_local') {
        clearLocalDomainStores(initialScope);
      } else if (migrationDecision.action === 'sync_local_to_cloud') {
        await syncLocalDataToSupabase(session.user.id, {
          currentUser: sessionUser,
          onUserUpdated: (user) => set({ user }),
        });
      } else if (migrationDecision.action === 'block_unknown_owner') {
        logStorageScopeEvent('unknown_owner_migration_blocked', {
          source: 'initialize',
          userId: session.user.id,
        });
      }
      markGrowthDailyLoginSession(session.user.id);
      hydrateGrowthDailyGoalFromMeta(meta);
      // Non-blocking background sync: local persist data shows immediately,
      // cloud data merges in silently when ready.
      void updateLoginStreak(session.user.id).catch(() => {});
      fetchActivityStreak(session.user.id)
        .then((streak) => set({ activityStreak: streak }))
        .catch(() => {});
      refreshDomainStoresForSession(session.user.id);
      markLocalDataOwnerUser(session.user.id);
    } else {
      if (owner.type === 'unknown' && !hasPersistedDomainData) {
        markLocalDataOwnerAnonymous();
      }
    }
    // Listen for changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      const previousUser = get().user;
      let currentUser = session?.user || null;
      if (event === 'SIGNED_IN' && currentUser) {
        const capturedUser = currentUser;
        void ensureTodayLoginDay(capturedUser)
          .then((u) => ensureCloudLanguageMetadata(u))
          .then((u) => { if (u !== capturedUser) set({ user: u }); })
          .catch(() => {});
      }
      const rawPreferences = currentUser
        ? preferencesFromMeta(currentUser.user_metadata || {})
        : DEFAULT_PREFERENCES;
      const profileState = profileStateFromMeta(currentUser?.user_metadata || {});
      const membership = resolveMembershipState(currentUser);
      const nextPreferences = normalizePreferencesForMembership(rawPreferences, membership.isPlus);
      syncI18nLanguageFromMeta(currentUser?.user_metadata || {});
      syncAnnotationStateWithPreferences(nextPreferences, membership.isPlus);
      // Fall back to localStorage pending write if cloud metadata is still empty
      const pendingProfile = currentUser ? getPendingProfileWrite(currentUser.id) : null;
      const resolvedProfile = profileState.userProfileV2 ?? pendingProfile;
      set({
        user: currentUser,
        loading: false,
        preferences: nextPreferences,
        longTermProfileEnabled: profileState.longTermProfileEnabled,
        userProfileV2: resolvedProfile,
        membershipPlan: membership.plan,
        membershipSource: membership.source,
        isPlus: membership.isPlus,
      });
      if (import.meta.env.DEV && currentUser) {
        console.log('[Membership] resolved membership:', {
          userId: currentUser.id,
          plan: membership.plan,
          source: membership.source,
        });
      }
      if (
        currentUser
        && (
          rawPreferences.aiMode !== nextPreferences.aiMode
          || rawPreferences.annotationDropRate !== nextPreferences.annotationDropRate
        )
      ) {
        queuePreferenceSnapshot(nextPreferences);
      }
      if (event === 'SIGNED_IN' && currentUser) {
        const meta = currentUser.user_metadata || {};
        hydrateGrowthDailyGoalFromMeta(meta);
      }
      const isNewOrSwitchedAccount =
        event === 'SIGNED_IN' && currentUser && (!previousUser || previousUser.id !== currentUser.id);
      if (isNewOrSwitchedAccount && currentUser) {
        const signedInScope = setScopeForAuthUser(currentUser.id, 'onAuthStateChange:signed-in');
        applyLegacyScopeMigrationIfAllowed(signedInScope, 'onAuthStateChange:signed-in', currentUser.id);
        await rehydrateAllDomainPersistStores();
        markGrowthDailyLoginSession(currentUser.id);
        const owner = readLocalDataOwner();
        const hasLocalData = hasAnyLocalDataToMigrate();
        const migrationDecision = resolveLocalDataMigrationDecision({
          owner,
          hasLocalData,
          currentUserId: currentUser.id,
          isolationV2Enabled: isMultiAccountIsolationV2Enabled(),
        });
        if (migrationDecision.action === 'clear_local') {
          clearLocalDomainStores(signedInScope);
        } else if (migrationDecision.action === 'sync_local_to_cloud') {
          if (import.meta.env.DEV) console.log('[AuthStore] syncing local data to cloud...');
          await syncLocalDataToSupabase(currentUser.id, {
            currentUser,
            onUserUpdated: (user) => set({ user }),
          });
        } else if (migrationDecision.action === 'block_unknown_owner') {
          logStorageScopeEvent('unknown_owner_migration_blocked', {
            source: 'onAuthStateChange',
            userId: currentUser.id,
          });
        }
        // 更新连续登录天数（后台写，不阻塞 UI）
        void updateLoginStreak(currentUser.id).catch(() => {});
        // 先同步本地 annotation 到云端，再后台拉取所有云端数据
        if (migrationDecision.action !== 'block_unknown_owner') {
          void useAnnotationStore.getState().syncLocalAnnotations(currentUser.id).catch(() => {});
        }
        fetchActivityStreak(currentUser.id)
          .then((streak) => set({ activityStreak: streak }))
          .catch(() => {});
        refreshDomainStoresForSession(currentUser.id);
        markLocalDataOwnerUser(currentUser.id);
        // Pending deletion check: restore or execute hard delete
        void checkAndHandlePendingDeletion(currentUser).catch(() => {});
      }
      else if (event === 'SIGNED_OUT') {
        console.log('User signed out. Clearing local state...');
        const signedOutScope = resolveStorageScopeForUser(previousUser?.id || null);
        setScopeForAuthUser(null, 'onAuthStateChange:signed-out');
        clearLocalDomainStores(signedOutScope);
        await rehydrateAllDomainPersistStores();
        markLocalDataOwnerAnonymous();
        set({
          preferences: DEFAULT_PREFERENCES,
          longTermProfileEnabled: false,
          userProfileV2: null,
          membershipPlan: DEFAULT_MEMBERSHIP_STATE.plan,
          membershipSource: DEFAULT_MEMBERSHIP_STATE.source,
          isPlus: DEFAULT_MEMBERSHIP_STATE.isPlus,
          activityStreak: null,
        });
      }
    });
  },

  ...createAuthAccountActions(set, get),
}));
