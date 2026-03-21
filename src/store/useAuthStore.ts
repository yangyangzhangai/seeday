// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/auth/README.md
import { create } from 'zustand';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import { useChatStore } from './useChatStore';
import { useTodoStore } from './useTodoStore';
import { useReportStore } from './useReportStore';
import { useAnnotationStore } from './useAnnotationStore';
import { useStardustStore } from './useStardustStore';
import { useMoodStore } from './useMoodStore';
import { useGrowthStore } from './useGrowthStore';
import { useFocusStore } from './useFocusStore';
import { toDbMessage, toDbReport, toDbTodo } from '../lib/dbMappers';

export type AnnotationDropRate = 'low' | 'medium' | 'high';

export interface UserPreferences {
  aiMode: 'van' | 'agnes' | 'zep' | 'spring_thunder';
  aiModeEnabled: boolean;
  dailyGoalEnabled: boolean;
  annotationDropRate: AnnotationDropRate;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  aiMode: 'van',
  aiModeEnabled: true,
  dailyGoalEnabled: true,
  annotationDropRate: 'low',
};

interface AuthState {
  user: any | null;
  loading: boolean;
  preferences: UserPreferences;
  /** Consecutive days with recorded activities, null = not yet fetched */
  activityStreak: number | null;
  initialize: () => Promise<void>;
  signIn: (email: string, pass: string) => Promise<{ error: any }>;
  signUp: (email: string, pass: string, nickname?: string, avatarDataUrl?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateAvatar: (avatarDataUrl: string) => Promise<{ error: any }>;
  updatePreferences: (partial: Partial<UserPreferences>) => Promise<void>;
  /** Re-compute activityStreak from Supabase — call after recording a new activity */
  refreshActivityStreak: () => Promise<void>;
}

function preferencesFromMeta(meta: Record<string, any>): UserPreferences {
  return {
    aiMode: meta.ai_mode || 'van',
    aiModeEnabled: meta.ai_mode_enabled ?? true,
    dailyGoalEnabled: meta.daily_goal_enabled ?? true,
    annotationDropRate: meta.annotation_drop_rate || 'low',
  };
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

function clearGrowthDailyPopupFirstVisitFlags(userId: string): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  const prefix = `growth:first-visit:${userId}:`;
  const keysToDelete: string[] = [];
  for (let i = 0; i < window.sessionStorage.length; i += 1) {
    const key = window.sessionStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    keysToDelete.push(key);
  }
  for (const key of keysToDelete) {
    window.sessionStorage.removeItem(key);
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  preferences: DEFAULT_PREFERENCES,
  activityStreak: null,

  initialize: async () => {
    // Get initial session
    const session = await getSupabaseSession();
    const meta = session?.user?.user_metadata || {};
    set({
      user: session?.user || null,
      loading: false,
      preferences: session?.user ? preferencesFromMeta(meta) : DEFAULT_PREFERENCES,
    });
    if (session?.user) {
      hydrateGrowthDailyGoalFromMeta(meta);
      await updateLoginStreak(session.user.id);
      const activityStreak = await fetchActivityStreak(session.user.id);
      set({ activityStreak });
    }

    // Listen for changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      const previousUser = get().user;
      const currentUser = session?.user || null;

      set({ user: currentUser, loading: false });

      if (event === 'SIGNED_IN' && currentUser) {
        const meta = currentUser.user_metadata || {};
        set({ preferences: preferencesFromMeta(meta) });
        hydrateGrowthDailyGoalFromMeta(meta);
      }

      if (event === 'SIGNED_IN' && currentUser && !previousUser) {
        console.log('User signed in. Syncing local data...');
        await syncLocalDataToSupabase(currentUser.id);

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
      }
      else if (event === 'SIGNED_OUT') {
        console.log('User signed out. Clearing local state...');
        if (previousUser?.id) {
          clearGrowthDailyPopupFirstVisitFlags(previousUser.id);
        }
        useChatStore.setState({ messages: [], hasInitialized: false });
        useTodoStore.setState({ todos: [] });
        useReportStore.setState({ reports: [] });
        useAnnotationStore.setState({ annotations: [], currentAnnotation: null });
        useMoodStore.getState().clear();
        useGrowthStore.setState({ bottles: [], dailyGoal: '', goalDate: '', popupDisabled: false });
        useFocusStore.setState({ sessions: [], currentSession: null, activeMessageId: null });
        set({ preferences: DEFAULT_PREFERENCES, activityStreak: null });
      }
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  },

  signUp: async (email, password, nickname, avatarDataUrl) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: nickname || email.split('@')[0],
          avatar_url: avatarDataUrl || null
        }
      }
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

  updatePreferences: async (partial: Partial<UserPreferences>) => {
    const merged = { ...get().preferences, ...partial };
    set({ preferences: merged });
    await supabase.auth.updateUser({
      data: {
        ai_mode: merged.aiMode,
        ai_mode_enabled: merged.aiModeEnabled,
        daily_goal_enabled: merged.dailyGoalEnabled,
        annotation_drop_rate: merged.annotationDropRate,
      },
    });
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
      .select('timestamp')
      .eq('user_id', userId)
      .neq('activity_type', 'chat')
      .eq('is_mood', false);

    if (!data) return 0;
    const dates = new Set(data.map(r => toLocalDateStr(Number(r.timestamp))));

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

async function syncLocalDataToSupabase(userId: string) {
  const messages = useChatStore.getState().messages;
  const todos = useTodoStore.getState().todos;

  // 1. Sync Messages
  if (messages.length > 0) {
    const messagesToUpload = messages.map((m) => toDbMessage(m, userId));

    // We use upsert to avoid conflicts if IDs somehow match, 
    // but typically local IDs (UUIDs) won't conflict with others.
    const { error } = await supabase.from('messages').upsert(messagesToUpload);
    if (error) {
      console.error('Error syncing messages:', error);
    } else {
      console.log(`Synced ${messages.length} messages.`);
    }
  }

  // 2. Sync Todos
  if (todos.length > 0) {
    const todosToUpload = todos.map((t) => toDbTodo(t, userId));

    const { error } = await supabase.from('todos').upsert(todosToUpload);
    if (error) {
      console.error('Error syncing todos:', error);
    } else {
      console.log(`Synced ${todos.length} todos.`);
    }
  }

  // 3. Sync Reports
  const reports = useReportStore.getState().reports;
  if (reports.length > 0) {
    const reportsToUpload = reports.map((r) => toDbReport(r, userId));

    const { error } = await supabase.from('reports').upsert(reportsToUpload);
    if (error) {
      console.error('Error syncing reports:', error);
    } else {
      console.log(`Synced ${reports.length} reports.`);
    }
  }
}
