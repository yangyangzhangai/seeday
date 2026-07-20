// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/auth/README.md
import { create } from 'zustand';
import { supabase } from '../api/supabase';
import { callDeleteAccountAPI } from '../api/client';
import { getSupabaseSession } from '../lib/supabase-utils';
import { formatUserFacingDiagnostic, logDiagnostic } from '../lib/diagnostics';
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
import type { AuthState, UserPreferences } from './authStoreTypes';
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
  clearPendingAccountStateWrite,
  deriveLegacyAccountState,
  getPendingAccountStateWrite,
  preserveAccountStateForSameUser,
  resolveEffectiveAccountState,
} from './authAccountStateHelpers';
import {
  ensureCloudUserAccountState,
  fetchCloudUserAccountState,
  flushPendingAccountStateWriteToCloud,
} from './authAccountStateCloudStore';
import {
  getPendingProfileWrite,
  preserveProfileForSameUser,
  profileStateFromMeta,
} from './authProfileHelpers';
import type { UserAccountState } from '../types/userAccountState';
import type { UserProfileV2 } from '../types/userProfile';
import { fetchActivityStreak, updateLoginStreak } from './authStreakHelpers';
import {
  applyCloudAvatarToUser,
  readCachedAvatarUrl,
  fetchCloudUserProfileState,
  flushPendingProfileWriteToCloud,
  migrateMetadataProfileToCloud,
} from './authProfileCloudStore';
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
  refreshDomainStoresForSession,
  rehydrateAllDomainPersistStores,
  resolveMembershipState,
  setScopeForAuthUser,
  syncAnnotationStateWithPreferences,
} from './authStoreRuntimeHelpers';

type AuthSet = (patch: Partial<AuthState>) => void;
type MigrationDecision = ReturnType<typeof resolveLocalDataMigrationDecision>;

let authStateListenerRegistered = false;

async function checkAndHandlePendingDeletion(user: { id: string; user_metadata?: Record<string, unknown> }): Promise<void> {
  const pendingAt = user.user_metadata?.pending_deletion_at;
  if (!pendingAt || typeof pendingAt !== 'string') return;
  const deletionTime = new Date(pendingAt).getTime();
  const now = Date.now();
  if (now < deletionTime) {
    return;
  }
  try {
    await callDeleteAccountAPI();
    await supabase.auth.signOut({ scope: 'global' });
  } catch {
    // Keep pending flag for next sign-in retry.
  }
}

function membershipSourceToAccountPlanSource(source: ReturnType<typeof resolveMembershipState>['source']): UserAccountState['planSource'] {
  switch (source) {
    case 'metadata':
      return 'legacy_metadata';
    case 'trial':
      return 'trial';
    default:
      return 'default_free';
  }
}

function applyUserSnapshot(
  set: AuthSet,
  user: any | null,
  options: {
    loading?: boolean;
    initializationStage?: string | null;
    preservedAvatarUrl?: string | null;
    preservedProfile?: UserProfileV2 | null;
    preservedAccountState?: UserAccountState | null;
  } = {},
): {
  meta: Record<string, any>;
  rawPreferences: UserPreferences;
  profileState: ReturnType<typeof profileStateFromMeta>;
  membership: ReturnType<typeof resolveMembershipState>;
  nextPreferences: UserPreferences;
  pendingProfile: ReturnType<typeof getPendingProfileWrite>;
  pendingAccountState: ReturnType<typeof getPendingAccountStateWrite>;
  accountState: UserAccountState | null;
} {
  const cachedAvatarUrl = user?.id ? readCachedAvatarUrl(user.id) : null;
  const safeUser = applyCloudAvatarToUser(user, options.preservedAvatarUrl ?? cachedAvatarUrl ?? null);
  const meta = safeUser?.user_metadata || {};
  const rawPreferences = safeUser ? preferencesFromMeta(meta) : DEFAULT_PREFERENCES;
  const profileState = profileStateFromMeta(meta);
  const membership = resolveMembershipState(safeUser);
  const nextPreferences = normalizePreferencesForMembership(rawPreferences, membership.isPlus);
  syncI18nLanguageFromMeta(meta);
  syncAnnotationStateWithPreferences(nextPreferences, membership.isPlus);
  const pendingProfile = safeUser ? getPendingProfileWrite(safeUser.id) : null;
  const pendingAccountState = safeUser ? getPendingAccountStateWrite(safeUser.id) : null;
  const resolvedProfile = safeUser
    ? (profileState.userProfileV2 ?? pendingProfile ?? options.preservedProfile ?? null)
    : null;
  const fallbackAccountState = safeUser
    ? deriveLegacyAccountState({
      user: safeUser,
      userProfile: resolvedProfile,
      pendingProfile,
      membershipPlan: membership.plan,
      membershipSource: membershipSourceToAccountPlanSource(membership.source),
    })
    : null;
  const resolvedAccountState = safeUser
    ? resolveEffectiveAccountState({
      fallbackState: fallbackAccountState,
      pendingState: pendingAccountState ?? options.preservedAccountState ?? null,
    })
    : null;

  set({
    user: safeUser,
    ...(options.loading !== undefined ? { loading: options.loading } : {}),
    ...(options.initializationStage !== undefined ? { initializationStage: options.initializationStage } : {}),
    preferences: nextPreferences,
    longTermProfileEnabled: profileState.longTermProfileEnabled,
    userProfileV2: resolvedProfile,
    accountState: resolvedAccountState,
    membershipPlan: membership.plan,
    membershipSource: membership.source,
    isPlus: membership.isPlus,
  });

  return {
    meta,
    rawPreferences,
    profileState,
    membership,
    nextPreferences,
    pendingProfile,
    pendingAccountState,
    accountState: resolvedAccountState,
  };
}

function queuePreferenceSnapshotIfNeeded(snapshot: {
  rawPreferences: UserPreferences;
  nextPreferences: UserPreferences;
}): void {
  if (
    snapshot.rawPreferences.aiMode !== snapshot.nextPreferences.aiMode
    || snapshot.rawPreferences.annotationDropRate !== snapshot.nextPreferences.annotationDropRate
  ) {
    queuePreferenceSnapshot(snapshot.nextPreferences);
  }
}

function runAuthBackgroundTask(label: string, task: () => Promise<void>): void {
  const startedAt = Date.now();
  logDiagnostic('info', `auth.background.${label}.start`);
  void task()
    .then(() => {
      logDiagnostic('info', `auth.background.${label}.success`, {
        elapsedMs: Date.now() - startedAt,
      });
    })
    .catch((error) => {
      logDiagnostic('error', `auth.background.${label}.failed`, {
        elapsedMs: Date.now() - startedAt,
        error,
        userFacing: formatUserFacingDiagnostic(`后台认证任务 ${label}`, error, {
          path: label,
          elapsedMs: Date.now() - startedAt,
        }),
      });
    });
}

function runSignedInBackgroundTasks(params: {
  user: any;
  set: AuthSet;
  get: () => AuthState;
  migrationDecision: MigrationDecision | null;
  localSnapshot?: ReturnType<typeof applyUserSnapshot> | null;
  source: string;
}): void {
  const { user, set, get, migrationDecision, localSnapshot, source } = params;
  const userId = user.id;

  runAuthBackgroundTask(`${source}.fresh_user_metadata`, async () => {
    const startedAt = Date.now();
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data?.user) return;
    const currentState = get();
    const freshSnapshot = applyUserSnapshot(set, data.user, {
      preservedAvatarUrl: currentState.user?.user_metadata?.avatar_url ?? null,
      preservedProfile: preserveProfileForSameUser({
        previousUserId: currentState.user?.id,
        currentUserId: data.user.id,
        profile: currentState.userProfileV2,
      }),
      preservedAccountState: preserveAccountStateForSameUser({
        previousUserId: currentState.user?.id,
        currentUserId: data.user.id,
        accountState: currentState.accountState,
      }),
    });
    const cloudProfileState = await fetchCloudUserProfileState(data.user);
    const cloudAccountState = await fetchCloudUserAccountState(data.user.id);
    const userWithCloudAvatar = applyCloudAvatarToUser(data.user, cloudProfileState.avatarUrl);
    set({
      user: userWithCloudAvatar,
      longTermProfileEnabled: cloudProfileState.longTermProfileEnabled,
      userProfileV2: cloudProfileState.userProfileV2,
      accountState: resolveEffectiveAccountState({
        fallbackState: freshSnapshot.accountState,
        pendingState: freshSnapshot.pendingAccountState,
        cloudState: cloudAccountState,
      }),
    });
    hydrateGrowthDailyGoalFromMeta(freshSnapshot.meta);
    queuePreferenceSnapshotIfNeeded(freshSnapshot);
    logDiagnostic('info', 'auth.store.get_user.background_done', {
      elapsedMs: Date.now() - startedAt,
      userId: data.user.id,
      source,
    });
  });

  runAuthBackgroundTask(`${source}.metadata_maintenance`, async () => {
    const currentUser = get().user ?? user;
    const updatedLoginUser = await ensureTodayLoginDay(currentUser);
    const updatedLanguageUser = await ensureCloudLanguageMetadata(updatedLoginUser);
    if (updatedLanguageUser !== currentUser) {
      set({ user: applyCloudAvatarToUser(updatedLanguageUser, currentUser?.user_metadata?.avatar_url ?? null) });
    }

    const activeUser = get().user ?? updatedLanguageUser;
    const migratedProfileState = await migrateMetadataProfileToCloud(activeUser);
    const localAccountState = get().accountState ?? localSnapshot?.accountState ?? null;
    if (localAccountState) {
      const ensuredAccountState = await ensureCloudUserAccountState(activeUser.id, localAccountState);
      set({ accountState: resolveEffectiveAccountState({ fallbackState: localAccountState, cloudState: ensuredAccountState }) });
    }
    set({
      user: applyCloudAvatarToUser(activeUser, migratedProfileState.avatarUrl),
      longTermProfileEnabled: migratedProfileState.longTermProfileEnabled,
      userProfileV2: migratedProfileState.userProfileV2,
    });

    const flushedProfile = await flushPendingProfileWriteToCloud(activeUser.id);
    if (flushedProfile) {
      set({ userProfileV2: flushedProfile });
    }
    const flushedAccountState = await flushPendingAccountStateWriteToCloud(activeUser.id);
    if (flushedAccountState) {
      clearPendingAccountStateWrite(activeUser.id);
      set({ accountState: flushedAccountState });
    }

    if (localSnapshot) {
      queuePreferenceSnapshotIfNeeded(localSnapshot);
    }
  });

  runAuthBackgroundTask(`${source}.cloud_profile_refresh`, async () => {
    const activeUser = get().user ?? user;
    const cloudProfileState = await fetchCloudUserProfileState(activeUser);
    const cloudAccountState = await fetchCloudUserAccountState(activeUser.id);
    const currentAccountState = get().accountState ?? localSnapshot?.accountState ?? null;
    const pendingAccountState = getPendingAccountStateWrite(activeUser.id);
    set({
      user: applyCloudAvatarToUser(activeUser, cloudProfileState.avatarUrl),
      longTermProfileEnabled: cloudProfileState.longTermProfileEnabled,
      userProfileV2: cloudProfileState.userProfileV2,
      accountState: resolveEffectiveAccountState({
        fallbackState: currentAccountState,
        pendingState: pendingAccountState,
        cloudState: cloudAccountState,
      }),
    });
  });

  runAuthBackgroundTask(`${source}.data_sync`, async () => {
    if (migrationDecision?.action === 'sync_local_to_cloud') {
      await syncLocalDataToSupabase(userId, {
        currentUser: get().user ?? user,
        onUserUpdated: (updatedUser) => set({ user: applyCloudAvatarToUser(updatedUser, get().user?.user_metadata?.avatar_url ?? null) }),
      });
    }

    if (migrationDecision?.action !== 'block_unknown_owner') {
      await useAnnotationStore.getState().syncLocalAnnotations(userId);
    }

    await refreshDomainStoresForSession(userId);
  });

  runAuthBackgroundTask(`${source}.activity_streak`, async () => {
    await updateLoginStreak(userId);
    const streak = await fetchActivityStreak(userId);
    set({ activityStreak: streak });
  });

  runAuthBackgroundTask(`${source}.pending_deletion_check`, async () => {
    await checkAndHandlePendingDeletion(get().user ?? user);
  });
}

function registerAuthStateListener(set: AuthSet, get: () => AuthState): void {
  if (authStateListenerRegistered) return;
  authStateListenerRegistered = true;

  supabase.auth.onAuthStateChange(async (event, session) => {
    const previousState = get();
    const previousUser = previousState.user;
    const currentUser = session?.user || null;
    const snapshot = applyUserSnapshot(set, currentUser, {
      loading: false,
      initializationStage: null,
      preservedAvatarUrl: previousUser?.user_metadata?.avatar_url ?? null,
      preservedProfile: preserveProfileForSameUser({
        previousUserId: previousUser?.id,
        currentUserId: currentUser?.id,
        profile: previousState.userProfileV2,
      }),
      preservedAccountState: preserveAccountStateForSameUser({
        previousUserId: previousUser?.id,
        currentUserId: currentUser?.id,
        accountState: previousState.accountState,
      }),
    });
    if (currentUser) {
      queuePreferenceSnapshotIfNeeded(snapshot);
    }
    if (event === 'SIGNED_IN' && currentUser) {
      hydrateGrowthDailyGoalFromMeta(snapshot.meta);
    }

    const isNewOrSwitchedAccount =
      event === 'SIGNED_IN' && currentUser && (!previousUser || previousUser.id !== currentUser.id);

    if (isNewOrSwitchedAccount && currentUser) {
      const signedInScope = setScopeForAuthUser(currentUser.id, 'onAuthStateChange:signed-in');
      applyLegacyScopeMigrationIfAllowed(signedInScope, 'onAuthStateChange:signed-in', currentUser.id);

      const rehydrateStartedAt = Date.now();
      await rehydrateAllDomainPersistStores();
      logDiagnostic('info', 'auth.store.auth_state.rehydrate.done', {
        elapsedMs: Date.now() - rehydrateStartedAt,
        userId: currentUser.id,
      });

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
      } else if (migrationDecision.action === 'block_unknown_owner') {
        logStorageScopeEvent('unknown_owner_migration_blocked', {
          source: 'onAuthStateChange',
          userId: currentUser.id,
        });
      }

      markLocalDataOwnerUser(currentUser.id);
      runSignedInBackgroundTasks({
        user: currentUser,
        set,
        get,
        migrationDecision,
        localSnapshot: snapshot,
        source: 'auth_state',
      });
    } else if (event === 'SIGNED_OUT') {
      const signedOutScope = resolveStorageScopeForUser(previousUser?.id || null);
      setScopeForAuthUser(null, 'onAuthStateChange:signed-out');
      clearLocalDomainStores(signedOutScope);
      await rehydrateAllDomainPersistStores();
      markLocalDataOwnerAnonymous();
      set({
        preferences: DEFAULT_PREFERENCES,
        longTermProfileEnabled: false,
        userProfileV2: null,
        accountState: null,
        membershipPlan: DEFAULT_MEMBERSHIP_STATE.plan,
        membershipSource: DEFAULT_MEMBERSHIP_STATE.source,
        isPlus: DEFAULT_MEMBERSHIP_STATE.isPlus,
        activityStreak: null,
      });
    }
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  initializationStage: 'boot',
  preferences: DEFAULT_PREFERENCES,
  longTermProfileEnabled: false,
  userProfileV2: null,
  accountState: null,
  membershipPlan: DEFAULT_MEMBERSHIP_STATE.plan,
  membershipSource: DEFAULT_MEMBERSHIP_STATE.source,
  isPlus: DEFAULT_MEMBERSHIP_STATE.isPlus,
  activityStreak: null,

  initialize: async () => {
    const initializeStartedAt = Date.now();
    let session: Awaited<ReturnType<typeof getSupabaseSession>> = null;
    let owner = readLocalDataOwner();
    let hasPersistedDomainData = false;
    let initialScope = resolveStorageScopeForUser(null);
    let migrationDecision: MigrationDecision | null = null;
    let localSnapshot: ReturnType<typeof applyUserSnapshot> | null = null;

    const setStage = (stage: string) => {
      set({ initializationStage: stage });
      logDiagnostic('info', 'auth.store.initialize.stage', {
        stage,
        elapsedMs: Date.now() - initializeStartedAt,
      });
    };

    try {
      setStage('session_restore');
      session = await getSupabaseSession('auth.initialize.local_first');
      logDiagnostic('info', 'auth.store.initialize.session.done', {
        elapsedMs: Date.now() - initializeStartedAt,
        hasSession: Boolean(session),
        userId: session?.user?.id ?? null,
      });

      setStage('storage_scope');
      owner = readLocalDataOwner();
      hasPersistedDomainData = hasAnyPersistedDomainData();
      initialScope = setScopeForAuthUser(session?.user?.id, 'initialize:local-first');
      if (session?.user?.id) {
        applyLegacyScopeMigrationIfAllowed(initialScope, 'initialize:local-first', session.user.id);
      }

      setStage('local_cache_restore');
      const rehydrateStartedAt = Date.now();
      await rehydrateAllDomainPersistStores();
      logDiagnostic('info', 'auth.store.initialize.rehydrate.done', {
        elapsedMs: Date.now() - rehydrateStartedAt,
        userId: session?.user?.id ?? null,
        ownerType: owner.type,
        hasPersistedDomainData,
      });

      if (session?.user) {
        const hasLocalData = hasAnyLocalDataToMigrate();
        migrationDecision = resolveLocalDataMigrationDecision({
          owner,
          hasLocalData,
          currentUserId: session.user.id,
          isolationV2Enabled: isMultiAccountIsolationV2Enabled(),
        });
        if (migrationDecision.action === 'clear_local') {
          setStage('clear_mismatched_local_data');
          clearLocalDomainStores(initialScope);
        } else if (migrationDecision.action === 'block_unknown_owner') {
          logStorageScopeEvent('unknown_owner_migration_blocked', {
            source: 'initialize',
            userId: session.user.id,
          });
        }
      } else if (owner.type === 'unknown' && !hasPersistedDomainData) {
        markLocalDataOwnerAnonymous();
      }

      setStage('open_local_app');
      const previousState = get();
      localSnapshot = applyUserSnapshot(set, session?.user ?? null, {
        loading: false,
        initializationStage: null,
        preservedProfile: preserveProfileForSameUser({
          previousUserId: previousState.user?.id,
          currentUserId: session?.user?.id,
          profile: previousState.userProfileV2,
        }),
        preservedAccountState: preserveAccountStateForSameUser({
          previousUserId: previousState.user?.id,
          currentUserId: session?.user?.id,
          accountState: previousState.accountState,
        }),
      });

      if (session?.user) {
        hydrateGrowthDailyGoalFromMeta(localSnapshot.meta);
        markLocalDataOwnerUser(session.user.id);
      }

      logDiagnostic('info', 'auth.store.initialize.local_first_ready', {
        elapsedMs: Date.now() - initializeStartedAt,
        userId: session?.user?.id ?? null,
        migrationAction: migrationDecision?.action ?? null,
      });
    } catch (error) {
      logDiagnostic('error', 'auth.store.initialize.local_first_failed', {
        elapsedMs: Date.now() - initializeStartedAt,
        error,
        userFacing: formatUserFacingDiagnostic('本地启动初始化', error, {
          path: 'auth.initialize.local_first',
          elapsedMs: Date.now() - initializeStartedAt,
        }),
      });
      set({
        user: null,
        loading: false,
        initializationStage: null,
        preferences: DEFAULT_PREFERENCES,
        longTermProfileEnabled: false,
        userProfileV2: null,
        accountState: null,
        membershipPlan: DEFAULT_MEMBERSHIP_STATE.plan,
        membershipSource: DEFAULT_MEMBERSHIP_STATE.source,
        isPlus: DEFAULT_MEMBERSHIP_STATE.isPlus,
        activityStreak: null,
      });
    }

    registerAuthStateListener(set, get);

    if (session?.user) {
      runSignedInBackgroundTasks({
        user: session.user,
        set,
        get,
        migrationDecision,
        localSnapshot,
        source: 'initialize',
      });
    }
  },

  ...createAuthAccountActions(set, get),
}));
