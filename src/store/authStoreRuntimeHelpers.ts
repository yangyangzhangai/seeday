// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/README.md
import { Capacitor } from '@capacitor/core';
import type { ReminderType } from '../services/reminder/reminderTypes';
import { useAnnotationStore } from './useAnnotationStore';
import { canAutoMigrateLegacyV1Persist } from './authLocalMigrationPolicy';
import { readLocalDataOwner } from './authLocalOwnerHelpers';
import { patchUserMetadata } from './authMetadataQueue';
import { DEFAULT_PREFERENCES } from './authPreferenceHelpers';
import type { AnnotationDropRate, MembershipPlan, MembershipState, UserPreferences } from './authStoreTypes';
import { useChatStore } from './useChatStore';
import { rehydrateAllDomainPersistStores } from './domainPersistHydration';
import { useFocusStore } from './useFocusStore';
import { useGrowthStore } from './useGrowthStore';
import { useMoodStore } from './useMoodStore';
import { useOutboxStore } from './useOutboxStore';
import { clearPersistedKeys } from './persistMigrationHelpers';
import { ALL_DOMAIN_PERSIST_KEYS } from './persistKeys';
import { useReminderStore } from './useReminderStore';
import { useReportStore } from './useReportStore';
import { migrateLegacyV1PersistToScope } from './scopedPersistMigration';
import {
  clearScopedDomainPersistKeys,
  isMultiAccountIsolationV2Enabled,
  logStorageScopeEvent,
  readActiveStorageScope,
  resolveStorageScopeForUser,
  setActiveStorageScope,
  type StorageScope,
} from './storageScope';
import { useStardustStore } from './useStardustStore';
import { useTodoStore } from './useTodoStore';

const DOMAIN_FETCH_FRESHNESS_MS = 60_000;
const ANNOTATION_DAILY_LIMIT_BY_DROP_RATE: Record<AnnotationDropRate, number> = {
  low: 3,
  medium: 5,
  high: 8,
};
const MEMBERSHIP_TEMPORARY_UNLOCK_ENABLED = false;
const PLUS_ANNOTATION_DAILY_LIMIT = 9999;
const IOS_OAUTH_REDIRECT_URL = (import.meta.env.VITE_IOS_OAUTH_REDIRECT_URL || 'com.seeday.app://auth/callback').trim();
const PLUS_PLAN_ALIASES = new Set(['plus', 'pro', 'premium', 'vip', 'member', 'paid', 'true', '1', 'yes']);
const FREE_PLAN_ALIASES = new Set(['free', 'basic', 'trial', 'none', 'false', '0', 'no']);

export const DEFAULT_MEMBERSHIP_STATE: MembershipState = MEMBERSHIP_TEMPORARY_UNLOCK_ENABLED
  ? { plan: 'plus', isPlus: true, source: 'temporary_unlock' }
  : { plan: 'free', isPlus: false, source: 'default_free' };

function toLocalDateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

export function syncAnnotationStateWithPreferences(preferences: UserPreferences, isPlus: boolean): void {
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

export function clearLocalDomainStores(scope?: StorageScope): void {
  useChatStore.setState({
    messages: [],
    hasInitialized: false,
    lastFetchedAt: null,
    currentDateStr: null,
    activeViewDateStr: null,
    dateCache: {},
    yesterdaySummary: null,
  });
  useTodoStore.setState({
    todos: [],
    isLoading: false,
    hasHydrated: false,
    lastFetchedAt: null,
    lastSyncError: null,
  });
  useReportStore.setState({ reports: [], computedHistory: [], lastFetchedAt: null });
  useAnnotationStore.setState((state) => ({
    annotations: [],
    currentAnnotation: null,
    lastFetchedAt: null,
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
    lastFetchedAt: null,
    lastSyncError: null,
  });
  useFocusStore.setState({
    sessions: [],
    currentSession: null,
    activeMessageId: null,
    queue: [],
    queueIndex: -1,
    lastFetchedAt: null,
  });
  useStardustStore.getState().clear();
  useReminderStore.setState({
    confirmedToday: new Set<ReminderType>(),
    confirmedDate: toLocalDateStr(Date.now()),
    activePopupType: null,
    lastSessionActivity: null,
    showQuickPicker: false,
    pickerContext: null,
  });
  if (isMultiAccountIsolationV2Enabled()) {
    clearScopedDomainPersistKeys(scope ?? readActiveStorageScope());
    clearPersistedKeys(ALL_DOMAIN_PERSIST_KEYS);
    return;
  }
  clearPersistedKeys(ALL_DOMAIN_PERSIST_KEYS);
}

function shouldFetchDomain(lastFetchedAt: number | null | undefined): boolean {
  if (!lastFetchedAt) return true;
  return Date.now() - lastFetchedAt > DOMAIN_FETCH_FRESHNESS_MS;
}

export function refreshDomainStoresForSession(userId: string): void {
  const annotationStore = useAnnotationStore.getState();
  const chatStore = useChatStore.getState();
  const todoStore = useTodoStore.getState();
  const reportStore = useReportStore.getState();
  const moodStore = useMoodStore.getState();
  const growthStore = useGrowthStore.getState();
  const focusStore = useFocusStore.getState();
  const stardustStore = useStardustStore.getState();
  void useOutboxStore.getState().flush(userId).catch(() => {});
  void Promise.all([
    shouldFetchDomain(annotationStore.lastFetchedAt) ? annotationStore.fetchAnnotations() : Promise.resolve(),
    shouldFetchDomain(chatStore.lastFetchedAt) ? chatStore.fetchMessages() : Promise.resolve(),
    shouldFetchDomain(todoStore.lastFetchedAt) ? todoStore.fetchTodos() : Promise.resolve(),
    shouldFetchDomain(reportStore.lastFetchedAt) ? reportStore.fetchReports() : Promise.resolve(),
    shouldFetchDomain(moodStore.lastFetchedAt) ? moodStore.fetchMoods() : Promise.resolve(),
    shouldFetchDomain(growthStore.lastFetchedAt) ? growthStore.fetchBottles() : Promise.resolve(),
    focusStore.recoverSessionAfterHydration().then(() => (
      shouldFetchDomain(focusStore.lastFetchedAt) ? focusStore.fetchSessions() : Promise.resolve()
    )),
  ]).catch(() => {});
  void Promise.resolve().then(async () => {
    await stardustStore.syncPendingStardusts();
    if (shouldFetchDomain(stardustStore.lastFetchedAt)) {
      await stardustStore.fetchStardusts();
    }
  }).catch(() => {});
}

export function hasAnyLocalDataToMigrate(): boolean {
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

export function hasAnyPersistedDomainData(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('seeday:v1:') || key.startsWith('seeday:v2:user:') || key.startsWith('seeday:v2:anon:')) {
      return true;
    }
  }
  return false;
}

function normalizeLoginDays(rawDays: unknown): string[] {
  if (!Array.isArray(rawDays)) return [];
  const uniq = new Set(
    rawDays.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)),
  );
  return Array.from(uniq).sort();
}

export async function ensureTodayLoginDay(user: any): Promise<any> {
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

export function resolveOAuthRedirectUrl(): string {
  const isValidAbsoluteUrl = (value: string): boolean => {
    try {
      const parsed = new URL(value);
      return Boolean(parsed.protocol);
    } catch {
      return false;
    }
  };
  if (Capacitor.isNativePlatform()) {
    const nativeRedirect = IOS_OAUTH_REDIRECT_URL.trim();
    if (nativeRedirect && isValidAbsoluteUrl(nativeRedirect)) {
      return nativeRedirect;
    }
    return 'com.seeday.app://auth/callback';
  }
  const webOrigin = typeof window !== 'undefined' ? window.location?.origin || '' : '';
  if (webOrigin && isValidAbsoluteUrl(webOrigin)) {
    return webOrigin;
  }
  return '';
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

export function hydrateGrowthDailyGoalFromMeta(meta: Record<string, any>): void {
  const remoteGoal = typeof meta.daily_goal === 'string' ? meta.daily_goal : '';
  const remoteGoalDate = normalizeDailyGoalDate(meta.daily_goal_date);
  if (!remoteGoal && !remoteGoalDate) return;
  useGrowthStore.setState((state) => ({
    dailyGoal: remoteGoal || state.dailyGoal,
    goalDate: remoteGoalDate || state.goalDate,
  }));
}

export function markGrowthDailyLoginSession(userId: string): void {
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

export function setScopeForAuthUser(userId?: string | null, source: string = 'unknown'): StorageScope {
  const scope = resolveStorageScopeForUser(userId);
  setActiveStorageScope(scope);
  logStorageScopeEvent('scope_set', { source, scope: scope.type, userId: scope.userId });
  return scope;
}

export function applyLegacyScopeMigrationIfAllowed(scope: StorageScope, source: string, currentUserId: string): void {
  if (!isMultiAccountIsolationV2Enabled()) return;
  const owner = readLocalDataOwner();
  const dryRun = migrateLegacyV1PersistToScope(scope, { dryRun: true });
  if (dryRun.moved.length === 0) return;
  const autoMigrate = canAutoMigrateLegacyV1Persist({
    owner,
    currentUserId,
    isolationV2Enabled: true,
  });
  logStorageScopeEvent('migration_decision', { source, autoMigrate, ownerType: owner.type });
  if (!autoMigrate) return;
  migrateLegacyV1PersistToScope(scope, { dryRun: false });
  logStorageScopeEvent('migration_executed', { source, ownerType: owner.type });
}

export { rehydrateAllDomainPersistStores };
