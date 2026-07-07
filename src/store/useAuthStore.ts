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

function applyUserSnapshot(
  set: AuthSet,
  user: any | null,
  options: { loading?: boolean; initializationStage?: string | null } = {},
): {
  meta: Record<string, any>;
  rawPreferences: UserPreferences;
  profileState: ReturnType<typeof profileStateFromMeta>;
  membership: ReturnType<typeof resolveMembershipState>;
  nextPreferences: UserPreferences;
  pendingProfile: ReturnType<typeof getPendingProfileWrite>;
} {
  const meta = user?.user_metadata || {};
  const rawPreferences = user ? preferencesFromMeta(meta) : DEFAULT_PREFERENCES;
  const profileState = profileStateFromMeta(meta);
  const membership = resolveMembershipState(user);
  const nextPreferences = normalizePreferencesForMembership(rawPreferences, membership.isPlus);
  syncI18nLanguageFromMeta(meta);
  syncAnnotationStateWithPreferences(nextPreferences, membership.isPlus);
  const pendingProfile = user ? getPendingProfileWrite(user.id) : null;
  const resolvedProfile = profileState.userProfileV2 ?? pendingProfile;

  set({
    user,
    ...(options.loading !== undefined ? { loading: options.loading } : {}),
    ...(options.initializationStage !== undefined ? { initializationStage: options.initializationStage } : {}),
    preferences: nextPreferences,
    longTermProfileEnabled: profileState.longTermProfileEnabled,
    userProfileV2: resolvedProfile,
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
    const freshSnapshot = applyUserSnapshot(set, data.user);
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
      set({ user: updatedLanguageUser });
    }

    const activeUser = get().user ?? updatedLanguageUser;
    const activeProfileState = profileStateFromMeta(activeUser.user_metadata || {});
    const pendingProfile = getPendingProfileWrite(activeUser.id);
    if (pendingProfile && !activeProfileState.userProfileV2) {
      const { user: updatedUser, error } = await patchUserMetadata({
        [USER_PROFILE_METADATA_KEY]: {
          ...pendingProfile,
          updatedAt: new Date().toISOString(),
        },
      });
      if (error) throw error;
      if (updatedUser) {
        const synced = profileStateFromMeta(updatedUser.user_metadata || {});
        set({ user: updatedUser, userProfileV2: synced.userProfileV2 });
        clearPendingProfileWrite(activeUser.id);
      }
    }

    if (localSnapshot) {
      queuePreferenceSnapshotIfNeeded(localSnapshot);
    }
  });

  if (migrationDecision?.action === 'sync_local_to_cloud') {
    runAuthBackgroundTask(`${source}.local_to_cloud`, async () => {
      await syncLocalDataToSupabase(userId, {
        currentUser: get().user ?? user,
        onUserUpdated: (updatedUser) => set({ user: updatedUser }),
      });
    });
  }

  if (migrationDecision?.action !== 'block_unknown_owner') {
    runAuthBackgroundTask(`${source}.annotation_local_sync`, async () => {
      await useAnnotationStore.getState().syncLocalAnnotations(userId);
    });
  }

  runAuthBackgroundTask(`${source}.domain_refresh`, async () => {
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
    const previousUser = get().user;
    const currentUser = session?.user || null;
    const snapshot = applyUserSnapshot(set, currentUser, {
      loading: false,
      initializationStage: null,
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
      localSnapshot = applyUserSnapshot(set, session?.user ?? null, {
        loading: false,
        initializationStage: null,
      });

      if (session?.user) {
        markGrowthDailyLoginSession(session.user.id);
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
