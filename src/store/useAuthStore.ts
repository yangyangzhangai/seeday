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
  LONG_TERM_PROFILE_ENABLED_KEY,
  mergeUserProfile,
  parseUserProfileV2,
  profileStateFromMeta,
  USER_PROFILE_METADATA_KEY,
} from './authProfileHelpers';

export type AnnotationDropRate = 'low' | 'medium' | 'high';
export type UiLanguage = 'zh' | 'en' | 'it';
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

const DEFAULT_PREFERENCES: UserPreferences = {
  aiMode: 'van',
  aiModeEnabled: true,
  dailyGoalEnabled: true,
  annotationDropRate: 'low',
};

const ANNOTATION_DAILY_LIMIT_BY_DROP_RATE: Record<AnnotationDropRate, number> = {
  low: 3,
  medium: 5,
  high: 8,
};

const MEMBERSHIP_TEMPORARY_UNLOCK_ENABLED = false;
const PLUS_ANNOTATION_DAILY_LIMIT = 9999;
const IOS_OAUTH_REDIRECT_URL = import.meta.env.VITE_IOS_OAUTH_REDIRECT_URL || 'com.tshine.app://auth/callback';
const PLUS_PLAN_ALIASES = new Set(['plus', 'pro', 'premium', 'vip', 'member', 'paid', 'true', '1', 'yes']);
const FREE_PLAN_ALIASES = new Set(['free', 'basic', 'trial', 'none', 'false', '0', 'no']);

const DEFAULT_MEMBERSHIP_STATE: MembershipState = MEMBERSHIP_TEMPORARY_UNLOCK_ENABLED
  ? { plan: 'plus', isPlus: true, source: 'temporary_unlock' }
  : { plan: 'free', isPlus: false, source: 'default_free' };

const LOCAL_DATA_OWNER_KEY = 'tshine:local-data-owner:v1';
const SUPPORTED_UI_LANGUAGES: UiLanguage[] = ['zh', 'en', 'it'];

type LocalDataOwner =
  | { type: 'anonymous'; userId: null }
  | { type: 'user'; userId: string }
  | { type: 'unknown'; userId: null };

let queuedPreferenceSnapshot: UserPreferences | null = null;
let isFlushingPreferenceSnapshot = false;

async function flushQueuedPreferences(): Promise<void> {
  if (isFlushingPreferenceSnapshot) return;
  isFlushingPreferenceSnapshot = true;
  try {
    while (queuedPreferenceSnapshot) {
      const snapshot = queuedPreferenceSnapshot;
      queuedPreferenceSnapshot = null;
      const latestSession = await getSupabaseSession();
      const baseMeta = (latestSession?.user?.user_metadata || {}) as Record<string, any>;
      const { error } = await supabase.auth.updateUser({
        data: {
          ...baseMeta,
          ai_mode: snapshot.aiMode,
          ai_mode_enabled: snapshot.aiModeEnabled,
          daily_goal_enabled: snapshot.dailyGoalEnabled,
          annotation_drop_rate: snapshot.annotationDropRate,
        },
      });
      if (error) {
        console.error('[updatePreferences] supabase error:', error);
      }
    }
  } finally {
    isFlushingPreferenceSnapshot = false;
    if (queuedPreferenceSnapshot) {
      void flushQueuedPreferences();
    }
  }
}

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

function normalizeUiLanguage(raw: unknown): UiLanguage {
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('it')) return 'it';
  return 'en';
}

function languageFromMeta(meta: Record<string, any>): UiLanguage | null {
  const value = meta.i18nextLng;
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = normalizeUiLanguage(value);
  return SUPPORTED_UI_LANGUAGES.includes(normalized) ? normalized : null;
}

function syncI18nLanguageFromMeta(meta: Record<string, any>): void {
  const cloudLanguage = languageFromMeta(meta);
  if (!cloudLanguage) return;
  const current = normalizeUiLanguage(i18n.language);
  if (current !== cloudLanguage) {
    void i18n.changeLanguage(cloudLanguage);
  }
}

async function ensureCloudLanguageMetadata(user: any | null): Promise<any | null> {
  if (!user) return user;
  const meta = (user.user_metadata || {}) as Record<string, any>;
  const cloudLanguage = languageFromMeta(meta);
  if (cloudLanguage) {
    syncI18nLanguageFromMeta(meta);
    return user;
  }

  const fallbackLanguage = normalizeUiLanguage(i18n.language);
  const { data, error } = await supabase.auth.updateUser({
    data: {
      ...meta,
      i18nextLng: fallbackLanguage,
    },
  });
  if (error || !data?.user) {
    return user;
  }

  return data.user;
}

function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readLocalDataOwner(): LocalDataOwner {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { type: 'unknown', userId: null };
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_DATA_OWNER_KEY);
    if (!raw) return { type: 'unknown', userId: null };
    const parsed = JSON.parse(raw) as { type?: string; userId?: unknown };
    if (parsed.type === 'anonymous') {
      return { type: 'anonymous', userId: null };
    }
    if (parsed.type === 'user' && typeof parsed.userId === 'string' && parsed.userId.trim()) {
      return { type: 'user', userId: parsed.userId };
    }
    return { type: 'unknown', userId: null };
  } catch {
    return { type: 'unknown', userId: null };
  }
}

function writeLocalDataOwner(owner: Exclude<LocalDataOwner, { type: 'unknown' }>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_DATA_OWNER_KEY, JSON.stringify(owner));
  } catch {
    // ignore storage write errors
  }
}

function markLocalDataOwnerAnonymous(): void {
  writeLocalDataOwner({ type: 'anonymous', userId: null });
}

function markLocalDataOwnerUser(userId: string): void {
  writeLocalDataOwner({ type: 'user', userId });
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
  useFocusStore.setState({ sessions: [], currentSession: null, activeMessageId: null });
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
  const { data, error } = await supabase.auth.updateUser({
    data: {
      ...(user?.user_metadata || {}),
      login_days: nextDays,
    },
  });

  if (error || !data?.user) {
    console.warn('Failed to persist login_days:', error);
    return user;
  }

  return data.user;
}

function preferencesFromMeta(meta: Record<string, any>): UserPreferences {
  return {
    aiMode: meta.ai_mode || 'van',
    aiModeEnabled: meta.ai_mode_enabled ?? true,
    dailyGoalEnabled: meta.daily_goal_enabled ?? true,
    annotationDropRate: meta.annotation_drop_rate || 'low',
  };
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
    const nextPreferences = sessionUser ? preferencesFromMeta(meta) : DEFAULT_PREFERENCES;
    const profileState = profileStateFromMeta(meta);
    const membership = resolveMembershipState(sessionUser);
    syncI18nLanguageFromMeta(meta);
    syncAnnotationStateWithPreferences(nextPreferences, membership.isPlus);
    set({
      user: sessionUser,
      loading: false,
      preferences: nextPreferences,
      longTermProfileEnabled: profileState.longTermProfileEnabled,
      userProfileV2: profileState.userProfileV2,
      membershipPlan: membership.plan,
      membershipSource: membership.source,
      isPlus: membership.isPlus,
    });
    if (import.meta.env.DEV && sessionUser) {
      console.log('[Membership] resolved membership:', {
        userId: sessionUser.id,
        plan: membership.plan,
        source: membership.source,
      });
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
      await updateLoginStreak(session.user.id);
      // Existing session restore should also rehydrate cloud state.
      // Otherwise persisted local caches can stay stale until next manual sign-in.
      const [activityStreak] = await Promise.all([
        fetchActivityStreak(session.user.id),
        useAnnotationStore.getState().fetchAnnotations(),
        useChatStore.getState().fetchMessages(),
        useTodoStore.getState().fetchTodos(),
        useReportStore.getState().fetchReports(),
        useMoodStore.getState().fetchMoods(),
        useGrowthStore.getState().fetchBottles(),
        useFocusStore.getState().fetchSessions(),
      ]);
      set({ activityStreak });

      await useStardustStore.getState().syncPendingStardusts();
      await useStardustStore.getState().fetchStardusts();
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

      const nextPreferences = currentUser
        ? preferencesFromMeta(currentUser.user_metadata || {})
        : DEFAULT_PREFERENCES;
      const profileState = profileStateFromMeta(currentUser?.user_metadata || {});
      const membership = resolveMembershipState(currentUser);
      syncI18nLanguageFromMeta(currentUser?.user_metadata || {});
      syncAnnotationStateWithPreferences(nextPreferences, membership.isPlus);
      set({
        user: currentUser,
        loading: false,
        preferences: nextPreferences,
        longTermProfileEnabled: profileState.longTermProfileEnabled,
        userProfileV2: profileState.userProfileV2,
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

        // 更新连续登录天数
        await updateLoginStreak(currentUser.id);

        // 先同步本地 annotation 到云端
        await useAnnotationStore.getState().syncLocalAnnotations(currentUser.id);
        // syncLocalAnnotations 成功后内部会调用 fetchAnnotations

        // 拉取各云端数据（并行执行互不依赖的部分）
        const [activityStreak] = await Promise.all([
          fetchActivityStreak(currentUser.id),
          useChatStore.getState().fetchMessages(),
          useTodoStore.getState().fetchTodos(),
          useReportStore.getState().fetchReports(),
          useMoodStore.getState().fetchMoods(),
          useGrowthStore.getState().fetchBottles(),
          useFocusStore.getState().fetchSessions(),
        ]);
        set({ activityStreak });

        // Stardust 同步（顺序关键：先推本地 pending，再拉云端全量）
        await useStardustStore.getState().syncPendingStardusts();
        await useStardustStore.getState().fetchStardusts();
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
    await supabase.auth.signOut();
  },

  updateAvatar: async (avatarDataUrl: string) => {
    const { data, error } = await supabase.auth.updateUser({
      data: { avatar_url: avatarDataUrl }
    });
    if (!error && data?.user) {
      set({ user: data.user });
    }
    return { error };
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

    const nextMetadata = {
      ...(currentUser.user_metadata || {}),
      country_code: normalizedCountryCode,
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      location_label: typeof input.locationLabel === 'string' && input.locationLabel.trim()
        ? input.locationLabel.trim()
        : null,
      location_source: input.source || 'manual_geocode',
      location_updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.auth.updateUser({ data: nextMetadata });
    if (!error && data?.user) {
      set({ user: data.user });
    }
    return { error };
  },

  updateLongTermProfileEnabled: async (enabled) => {
    const currentUser = get().user;
    if (!currentUser) {
      return { error: new Error('Not signed in') };
    }

    const latestSession = await getSupabaseSession();
    const baseMeta = (latestSession?.user?.user_metadata || currentUser.user_metadata || {}) as Record<string, any>;
    const nextMeta = {
      ...baseMeta,
      [LONG_TERM_PROFILE_ENABLED_KEY]: enabled,
    };

    const { data, error } = await supabase.auth.updateUser({ data: nextMeta });
    if (!error && data?.user) {
      const profileState = profileStateFromMeta(data.user.user_metadata || {});
      set({
        user: data.user,
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

    const latestSession = await getSupabaseSession();
    const baseMeta = (latestSession?.user?.user_metadata || currentUser.user_metadata || {}) as Record<string, any>;
    const prev = parseUserProfileV2(baseMeta[USER_PROFILE_METADATA_KEY]);
    const nextProfile = typeof updater === 'function'
      ? updater(prev)
      : mergeUserProfile(prev, updater);

    const nextMeta = {
      ...baseMeta,
      [USER_PROFILE_METADATA_KEY]: {
        ...nextProfile,
        updatedAt: new Date().toISOString(),
        createdAt: nextProfile.createdAt || new Date().toISOString(),
      },
    };

    const { data, error } = await supabase.auth.updateUser({ data: nextMeta });
    if (!error && data?.user) {
      const profileState = profileStateFromMeta(data.user.user_metadata || {});
      set({
        user: data.user,
        longTermProfileEnabled: profileState.longTermProfileEnabled,
        userProfileV2: profileState.userProfileV2,
      });
    }

    return { error };
  },

  updatePreferences: async (partial: Partial<UserPreferences>) => {
    const merged = { ...get().preferences, ...partial };
    set({ preferences: merged });
    syncAnnotationStateWithPreferences(merged, get().isPlus);
    queuedPreferenceSnapshot = merged;
    void flushQueuedPreferences();
  },

  updateLanguagePreference: async (language: string) => {
    const normalized = normalizeUiLanguage(language);
    await i18n.changeLanguage(normalized);

    const currentUser = get().user;
    if (!currentUser) {
      return { error: null };
    }

    const latestSession = await getSupabaseSession();
    const baseMeta = (latestSession?.user?.user_metadata || currentUser.user_metadata || {}) as Record<string, any>;
    const nextMeta = {
      ...baseMeta,
      i18nextLng: normalized,
    };

    const { data, error } = await supabase.auth.updateUser({ data: nextMeta });
    if (!error && data?.user) {
      set({ user: data.user });
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

// ── Helper: local date string from timestamp (ms) ─────────────
function toLocalDateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Fetch consecutive activity days from Supabase (full history, no date limit).
 * Cached in localStorage — only re-fetches on the first open of each calendar day.
 * Pass force=true to bypass the cache (e.g. after recording a new activity).
 */
async function fetchActivityStreak(userId: string, force = false): Promise<number> {
  const today = toLocalDateStr(Date.now());
  const dateKey  = `streakDate_${userId}`;
  const valueKey = `streakValue_${userId}`;

  // Return cached value if already fetched today (and not forced)
  if (!force && localStorage.getItem(dateKey) === today) {
    const cached = localStorage.getItem(valueKey);
    return cached !== null ? Number(cached) : 0;
  }

  try {
    // Fetch ALL activity timestamps (no date filter) to compute full streak
    const { data } = await supabase
      .from('messages')
      .select('timestamp, activity_type')
      .eq('user_id', userId)
      .eq('is_mood', false);

    if (!data) return 0;
    const dates = new Set(
      data
        .filter((row) => !isLegacyChatActivityType(row.activity_type))
        .map((row) => toLocalDateStr(Number(row.timestamp)))
    );

    let streak = 0;
    const d = new Date();
    while (dates.has(toLocalDateStr(d.getTime()))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }

    // Cache result so we skip the query for the rest of today
    localStorage.setItem(dateKey,  today);
    localStorage.setItem(valueKey, String(streak));
    return streak;
  } catch {
    return 0;
  }
}

/**
 * Upsert user_stats with updated login streak.
 * - If last_login_date was yesterday → streak + 1
 * - If last_login_date is today      → no change (already counted)
 * - Otherwise                        → streak resets to 1
 */
async function updateLoginStreak(userId: string): Promise<void> {
  try {
    const today = toLocalDateStr(Date.now());
    const { data } = await supabase
      .from('user_stats')
      .select('login_streak, last_login_date')
      .eq('user_id', userId)
      .maybeSingle();

    if (data?.last_login_date === today) return; // Already counted today

    const yesterday = toLocalDateStr(Date.now() - 86_400_000);
    const newStreak = data?.last_login_date === yesterday
      ? (data.login_streak ?? 0) + 1
      : 1;

    await supabase.from('user_stats').upsert(
      { user_id: userId, login_streak: newStreak, last_login_date: today, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[AuthStore] updateLoginStreak failed', err);
  }
}
