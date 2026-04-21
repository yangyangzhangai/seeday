// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/auth/README.md
import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import i18n from '../i18n';
import { useChatStore } from './useChatStore';
import { useTodoStore } from './useTodoStore';
import { useReportStore } from './useReportStore';
import { useAnnotationStore } from './useAnnotationStore';
import { useStardustStore } from './useStardustStore';
import { useMoodStore } from './useMoodStore';
import { useGrowthStore } from './useGrowthStore';
import { useFocusStore } from './useFocusStore';
import { isLegacyChatActivityType } from '../lib/activityType';
import type { AiCompanionMode } from '../lib/aiCompanion';
import type { UserProfileV2 } from '../types/userProfile';
import { syncLocalDataToSupabase } from './authDataSyncHelpers';
import {
  DEFAULT_PREFERENCES,
  normalizePreferencesForMembership,
  preferencesFromMeta,
  queuePreferenceSnapshot,
} from './authPreferenceHelpers';
import {
  ensureCloudLanguageMetadata,
  normalizeUiLanguage,
  persistLanguageToLocalStorage,
  syncI18nLanguageFromMeta,
  type SupportedUiLanguage,
} from './authLanguageHelpers';
import {
  markLocalDataOwnerAnonymous,
  markLocalDataOwnerUser,
  readLocalDataOwner,
} from './authLocalOwnerHelpers';
import {
  clearPendingProfileWrite,
  getPendingProfileWrite,
  LONG_TERM_PROFILE_ENABLED_KEY,
  mergeUserProfile,
  parseUserProfileV2,
  profileStateFromMeta,
  savePendingProfileWrite,
  USER_PROFILE_METADATA_KEY,
} from './authProfileHelpers';
import { fetchActivityStreak, updateLoginStreak } from './authStreakHelpers';
import { patchUserMetadata } from './authMetadataQueue';

export type AnnotationDropRate = 'low' | 'medium' | 'high';
export type UiLanguage = SupportedUiLanguage;
export type MembershipPlan = 'free' | 'plus';
export type MembershipSource = 'metadata' | 'trial' | 'temporary_unlock' | 'default_free';

export interface UserPreferences {
  aiMode: AiCompanionMode;
  aiModeEnabled: boolean;
  dailyGoalEnabled: boolean;
  annotationDropRate: AnnotationDropRate;
}

export interface MembershipState {
  plan: MembershipPlan;
  isPlus: boolean;
  source: MembershipSource;
}

export interface LocationMetadataInput {
  countryCode: string;
  latitude: number;
  longitude: number;
  locationLabel?: string;
  source?: 'manual_geocode' | 'device_gps';
}

const ANNOTATION_DAILY_LIMIT_BY_DROP_RATE: Record<AnnotationDropRate, number> = {
  low: 3,
  medium: 5,
  high: 8,
};

const MEMBERSHIP_TEMPORARY_UNLOCK_ENABLED = false;
const PLUS_ANNOTATION_DAILY_LIMIT = 9999;
const IOS_OAUTH_REDIRECT_URL =
  (import.meta.env.VITE_IOS_OAUTH_REDIRECT_URL || 'com.seeday.app://auth/callback').trim();
const PLUS_PLAN_ALIASES = new Set(['plus', 'pro', 'premium', 'vip', 'member', 'paid', 'true', '1', 'yes']);
const FREE_PLAN_ALIASES = new Set(['free', 'basic', 'trial', 'none', 'false', '0', 'no']);

const DEFAULT_MEMBERSHIP_STATE: MembershipState = MEMBERSHIP_TEMPORARY_UNLOCK_ENABLED
  ? { plan: 'plus', isPlus: true, source: 'temporary_unlock' }
  : { plan: 'free', isPlus: false, source: 'default_free' };

interface AuthState {
  user: any | null;
  loading: boolean;
  preferences: UserPreferences;
  longTermProfileEnabled: boolean;
  userProfileV2: UserProfileV2 | null;
  membershipPlan: MembershipPlan;
  membershipSource: MembershipSource;
  isPlus: boolean;
  /** Consecutive days with recorded activities, null = not yet fetched */
  activityStreak: number | null;
  initialize: () => Promise<void>;
  signIn: (email: string, pass: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithApple: () => Promise<{ error: any }>;
  signUp: (email: string, pass: string, nickname?: string, avatarDataUrl?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateAvatar: (avatarDataUrl: string) => Promise<{ error: any }>;
  updateLocationMetadata: (input: LocationMetadataInput) => Promise<{ error: any }>;
  updateLongTermProfileEnabled: (enabled: boolean) => Promise<{ error: any }>;
  updateUserProfile: (
    updater: Partial<UserProfileV2> | ((prev: UserProfileV2 | null) => UserProfileV2),
  ) => Promise<{ error: any }>;
  updatePreferences: (partial: Partial<UserPreferences>) => Promise<void>;
  updateLanguagePreference: (language: string) => Promise<{ error: any }>;
  /** Re-compute activityStreak from Supabase — call after recording a new activity */
  refreshActivityStreak: () => Promise<void>;
}

function toLocalDateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function clearLocalDomainStores(): void {
  useChatStore.setState({ messages: [], hasInitialized: false });
  useTodoStore.setState({
    todos: [],
    isLoading: false,
    hasHydrated: false,
    lastSyncError: null,
  });
  useReportStore.setState({ reports: [] });
  useAnnotationStore.setState((state) => ({
    annotations: [],
    currentAnnotation: null,
    todayStats: {
      date: toLocalDateStr(Date.now()),
      speakCount: 0,
      lastSpeakTime: 0,
      events: [],
    },
    config: {
      ...state.config,
      ...getAnnotationConfigFromPreferences(DEFAULT_PREFERENCES, DEFAULT_MEMBERSHIP_STATE.isPlus),
    },
  }));
  useMoodStore.getState().clear();
  useGrowthStore.setState({
    bottles: [],
    dailyGoal: '',
    goalDate: '',
    popupDisabled: false,
    isLoading: false,
    hasHydrated: false,
    lastSyncError: null,
  });
  useFocusStore.setState({ sessions: [], currentSession: null, activeMessageId: null, queue: [], queueIndex: -1 });
  useStardustStore.getState().clear();
}

function hasAnyLocalDataToMigrate(): boolean {
  const hasMessages = useChatStore.getState().messages.length > 0;
  const hasTodos = useTodoStore.getState().todos.length > 0;
  const hasReports = useReportStore.getState().reports.length > 0;
  const hasBottles = useGrowthStore.getState().bottles.length > 0;
  const hasFocusSessions = useFocusStore.getState().sessions.length > 0;
  const growth = useGrowthStore.getState();
  const hasDailyGoal = Boolean(growth.dailyGoal && growth.goalDate);
  const mood = useMoodStore.getState();
  const hasMoodData =
    Object.keys(mood.activityMood).length > 0
    || Object.keys(mood.customMoodLabel).length > 0
    || Object.keys(mood.customMoodApplied).length > 0
    || Object.keys(mood.moodNote).length > 0;

  return hasMessages || hasTodos || hasReports || hasBottles || hasFocusSessions || hasDailyGoal || hasMoodData;
}

function normalizeLoginDays(rawDays: unknown): string[] {
  if (!Array.isArray(rawDays)) return [];
  const uniq = new Set(
    rawDays.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
  );
  return Array.from(uniq).sort();
}

async function ensureTodayLoginDay(user: any): Promise<any> {
  const today = getTodayDateStr();
  const existingDays = normalizeLoginDays(user?.user_metadata?.login_days);
  if (existingDays.includes(today)) return user;

  const nextDays = [...existingDays, today].slice(-90);
  const { user: updatedUser, error } = await patchUserMetadata({ login_days: nextDays });

  if (error || !updatedUser) {
    console.warn('Failed to persist login_days:', error);
    return user;
  }

  return updatedUser;
}

function normalizeMembershipPlan(raw: unknown): MembershipPlan | null {
  if (typeof raw === 'boolean') {
    return raw ? 'plus' : 'free';
  }

  if (typeof raw !== 'string') return null;

  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  if (PLUS_PLAN_ALIASES.has(normalized)) return 'plus';
  if (FREE_PLAN_ALIASES.has(normalized)) return 'free';
  return null;
}

function resolveOAuthRedirectUrl(): string {
  if (Capacitor.isNativePlatform()) {
    return IOS_OAUTH_REDIRECT_URL;
  }
  return window.location.origin;
}

export function resolveMembershipState(
  user: { user_metadata?: Record<string, any>; app_metadata?: Record<string, any> } | null | undefined,
  options?: { temporaryUnlockEnabled?: boolean; nowMs?: number },
): MembershipState {
  const temporaryUnlockEnabled = options?.temporaryUnlockEnabled ?? MEMBERSHIP_TEMPORARY_UNLOCK_ENABLED;
  const nowMs = options?.nowMs ?? Date.now();
  const userMeta = user?.user_metadata || {};
  const appMeta = user?.app_metadata || {};
  const membershipCandidates = [
    appMeta.membership_plan,
    userMeta.membership_plan,
    appMeta.plan,
    userMeta.plan,
    appMeta.subscription_plan,
    userMeta.subscription_plan,
    appMeta.membership_tier,
    userMeta.membership_tier,
    appMeta.tier,
    userMeta.tier,
    appMeta.membership?.plan,
    userMeta.membership?.plan,
    appMeta.subscription?.plan,
    userMeta.subscription?.plan,
    appMeta.is_plus,
    userMeta.is_plus,
    appMeta.plus_member,
    userMeta.plus_member,
    appMeta.vip,
    userMeta.vip,
  ];

  for (const candidate of membershipCandidates) {
    const plan = normalizeMembershipPlan(candidate);
    if (plan) {
      return {
        plan,
        isPlus: plan === 'plus',
        source: 'metadata',
      };
    }
  }

  const trialStartedAtRaw = appMeta.trial_started_at ?? userMeta.trial_started_at;
  const trialStartedAtMs = typeof trialStartedAtRaw === 'string' || typeof trialStartedAtRaw === 'number'
    ? new Date(trialStartedAtRaw).getTime()
    : Number.NaN;
  const trialWindowMs = 7 * 24 * 60 * 60 * 1000;
  if (Number.isFinite(trialStartedAtMs) && trialStartedAtMs <= nowMs && nowMs - trialStartedAtMs < trialWindowMs) {
    return { plan: 'plus', isPlus: true, source: 'trial' };
  }

  if (temporaryUnlockEnabled) {
    return { plan: 'plus', isPlus: true, source: 'temporary_unlock' };
  }

  return { plan: 'free', isPlus: false, source: 'default_free' };
}

export function getAnnotationConfigFromPreferences(
  preferences: Pick<UserPreferences, 'aiModeEnabled' | 'annotationDropRate'>,
  isPlus = DEFAULT_MEMBERSHIP_STATE.isPlus,
): { enabled: boolean; dailyLimit: number; dropRate: AnnotationDropRate } {
  return {
    enabled: preferences.aiModeEnabled,
    dailyLimit: isPlus
      ? PLUS_ANNOTATION_DAILY_LIMIT
      : (ANNOTATION_DAILY_LIMIT_BY_DROP_RATE[preferences.annotationDropRate] ?? 3),
    dropRate: preferences.annotationDropRate,
  };
}

function syncAnnotationStateWithPreferences(preferences: UserPreferences, isPlus: boolean): void {
  const nextConfig = getAnnotationConfigFromPreferences(preferences, isPlus);
  useAnnotationStore.setState((state) => ({
    config: {
      ...state.config,
      ...nextConfig,
    },
    currentAnnotation: preferences.aiModeEnabled ? state.currentAnnotation : null,
  }));
  if (import.meta.env.DEV) {
    console.log('[Membership] synced annotation quota:', {
      isPlus,
      aiModeEnabled: preferences.aiModeEnabled,
      annotationDropRate: preferences.annotationDropRate,
      dailyLimit: nextConfig.dailyLimit,
    });
  }
}

function hydrateGrowthDailyGoalFromMeta(meta: Record<string, any>): void {
  const remoteGoal = typeof meta.daily_goal === 'string' ? meta.daily_goal : '';
  const remoteGoalDate = normalizeDailyGoalDate(meta.daily_goal_date);
  if (!remoteGoal && !remoteGoalDate) return;
  useGrowthStore.setState((state) => ({
    dailyGoal: remoteGoal || state.dailyGoal,
    goalDate: remoteGoalDate || state.goalDate,
  }));
}

function normalizeDailyGoalDate(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const value = raw.trim();
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const slash = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slash) {
    const [, y, m, d] = slash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return toLocalDateStr(parsed.getTime());
}

function markGrowthDailyLoginSession(userId: string): void {
  if (typeof window === 'undefined' || !window.localStorage || !window.sessionStorage) return;
  const today = toLocalDateStr(Date.now());
  const firstLoginDateKey = `growth:first-login-date:${userId}`;
  const sessionFlagKey = `growth:is-first-login:${userId}:${today}`;
  const hasLoggedInToday = window.localStorage.getItem(firstLoginDateKey) === today;

  if (hasLoggedInToday) {
    window.sessionStorage.setItem(sessionFlagKey, '0');
    return;
  }

  window.localStorage.setItem(firstLoginDateKey, today);
  window.sessionStorage.setItem(sessionFlagKey, '1');
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
    let sessionUser = session?.user ? await ensureTodayLoginDay(session.user) : null;
    sessionUser = await ensureCloudLanguageMetadata(sessionUser);
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
      const owner = readLocalDataOwner();
      const hasLocalData = hasAnyLocalDataToMigrate();
      const isCrossAccountData = owner.type === 'user' && owner.userId !== session.user.id;

      if (isCrossAccountData) {
        clearLocalDomainStores();
      } else if (hasLocalData) {
        // Existing-session restore path (app cold start / refresh):
        // push any local data first, then pull cloud state.
        // This avoids local-vs-cloud drift when the same account worked offline.
        await syncLocalDataToSupabase(session.user.id, {
          currentUser: sessionUser,
          onUserUpdated: (user) => set({ user }),
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
      void Promise.all([
        useAnnotationStore.getState().fetchAnnotations(),
        useChatStore.getState().fetchMessages(),
        useTodoStore.getState().fetchTodos(),
        useReportStore.getState().fetchReports(),
        useMoodStore.getState().fetchMoods(),
        useGrowthStore.getState().fetchBottles(),
        useFocusStore.getState().recoverSessionAfterHydration().then(() => useFocusStore.getState().fetchSessions()),
      ]).catch(() => {});
      void Promise.resolve().then(async () => {
        await useStardustStore.getState().syncPendingStardusts();
        await useStardustStore.getState().fetchStardusts();
      }).catch(() => {});
      markLocalDataOwnerUser(session.user.id);
    } else {
      const owner = readLocalDataOwner();
      if (owner.type === 'unknown' && !hasAnyLocalDataToMigrate()) {
        markLocalDataOwnerAnonymous();
      }
    }

    // Listen for changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      const previousUser = get().user;
      let currentUser = session?.user || null;

      if (event === 'SIGNED_IN' && currentUser) {
        currentUser = await ensureTodayLoginDay(currentUser);
        currentUser = await ensureCloudLanguageMetadata(currentUser);
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
        markGrowthDailyLoginSession(currentUser.id);

        const owner = readLocalDataOwner();
        const hasLocalData = hasAnyLocalDataToMigrate();
        const isCrossAccountData = owner.type === 'user' && owner.userId !== currentUser.id;
        const canMigrateAnonymousData = owner.type === 'anonymous' && hasLocalData;

        if (isCrossAccountData) {
          clearLocalDomainStores();
        } else if (canMigrateAnonymousData || (owner.type === 'unknown' && hasLocalData)) {
          // canMigrateAnonymousData: 明确的访客数据
          // unknown + hasLocalData: 老用户（owner 标记添加前就在用 app），同样迁移而非清空
          if (import.meta.env.DEV) console.log('[AuthStore] syncing local data to cloud...');
          await syncLocalDataToSupabase(currentUser.id, {
            currentUser,
            onUserUpdated: (user) => set({ user }),
          });
        }

        // 更新连续登录天数（后台写，不阻塞 UI）
        void updateLoginStreak(currentUser.id).catch(() => {});

        // 先同步本地 annotation 到云端，再后台拉取所有云端数据
        void useAnnotationStore.getState().syncLocalAnnotations(currentUser.id).catch(() => {});
        fetchActivityStreak(currentUser.id)
          .then((streak) => set({ activityStreak: streak }))
          .catch(() => {});
        void Promise.all([
          useChatStore.getState().fetchMessages(),
          useTodoStore.getState().fetchTodos(),
          useReportStore.getState().fetchReports(),
          useMoodStore.getState().fetchMoods(),
          useGrowthStore.getState().fetchBottles(),
          useFocusStore.getState().recoverSessionAfterHydration().then(() => useFocusStore.getState().fetchSessions()),
        ]).catch(() => {});
        void Promise.resolve().then(async () => {
          await useStardustStore.getState().syncPendingStardusts();
          await useStardustStore.getState().fetchStardusts();
        }).catch(() => {});
        markLocalDataOwnerUser(currentUser.id);
      }
      else if (event === 'SIGNED_OUT') {
        console.log('User signed out. Clearing local state...');
        clearLocalDomainStores();
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

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: resolveOAuthRedirectUrl() },
    });
    return { error };
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: resolveOAuthRedirectUrl() },
    });
    return { error };
  },

  signUp: async (email, password, nickname, avatarDataUrl) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: nickname || email.split('@')[0],
          avatar_url: avatarDataUrl || null,
          trial_started_at: new Date().toISOString(),
        },
      },
    });
    return { error };
  },

  signOut: async () => {
    // Reset store + local state immediately — no network required
    clearLocalDomainStores();
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
    // Clear Supabase local session keys so app doesn't restore session on reload
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
    } catch { /* storage unavailable */ }
    // Invalidate server-side token in background
    supabase.auth.signOut({ scope: 'global' }).catch(() => {});
  },

  updateAvatar: async (avatarDataUrl: string) => {
    const currentUser = get().user;
    if (!currentUser) {
      return { error: new Error('Not signed in') };
    }

    // Optimistic local update: reflect avatar immediately.
    set({
      user: {
        ...currentUser,
        user_metadata: {
          ...(currentUser.user_metadata || {}),
          avatar_url: avatarDataUrl,
        },
      },
    });

    // Sync to Supabase silently in background.
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

    const nextMetadata = {
      ...(currentUser.user_metadata || {}),
      ...patch,
    };

    // Save locally first to keep interaction instant.
    set({
      user: {
        ...currentUser,
        user_metadata: nextMetadata,
      },
    });

    // Sync to Supabase silently in background via serialized metadata queue.
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

    const { user, error } = await patchUserMetadata(patch);
    if (!error && user) {
      const profileState = profileStateFromMeta(user.user_metadata || {});
      set({
        user,
        longTermProfileEnabled: profileState.longTermProfileEnabled,
        userProfileV2: profileState.userProfileV2,
      });
    }

    return { error };
  },

  updateUserProfile: async (updater) => {
    const currentUser = get().user;
    if (!currentUser) {
      return { error: new Error('Not signed in') };
    }

    // Use cached user_metadata — no network call here
    const baseMeta: Record<string, any> = currentUser.user_metadata || {};
    const prev = parseUserProfileV2(baseMeta[USER_PROFILE_METADATA_KEY]);
    const nextProfile = typeof updater === 'function'
      ? updater(prev)
      : mergeUserProfile(prev, updater);

    // 1. Update store + localStorage immediately — user proceeds without waiting
    set({ userProfileV2: nextProfile });
    savePendingProfileWrite(currentUser.id, nextProfile);

    const patch = {
      [USER_PROFILE_METADATA_KEY]: {
        ...nextProfile,
        updatedAt: new Date().toISOString(),
        createdAt: nextProfile.createdAt || new Date().toISOString(),
      },
    };

    // 2. Sync to Supabase in background — don't block the caller
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
    }).catch(() => { /* will retry on next initialize() */ });

    return { error: null };
  },

  updatePreferences: async (partial: Partial<UserPreferences>) => {
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

    const { user, error } = await patchUserMetadata({ i18nextLng: normalized });
    if (!error && user) {
      set({ user });
    }
    return { error };
  },

  refreshActivityStreak: async () => {
    const userId = get().user?.id;
    if (!userId) return;
    const streak = await fetchActivityStreak(userId, true); // force bypass cache
    set({ activityStreak: streak });
  },
}));
