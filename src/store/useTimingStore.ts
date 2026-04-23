// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/services/timing/timingSessionService.ts
/**
 * 当前 active session + 今日会话列表
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  TimingSession,
  TimingType,
  TimingSource,
  startSession,
  endActiveSession,
  fetchTodaySessions,
  fetchActiveSession,
} from '../services/timing/timingSessionService';
import { PERSIST_KEYS, LEGACY_PERSIST_KEYS } from './persistKeys';
import { readLegacyPersistedState } from './persistMigrationHelpers';
import { createScopedJSONStorage } from './scopedPersistStorage';

interface TimingState {
  activeSession: TimingSession | null;
  todaySessions: TimingSession[];
  lastFetchedAt: number | null;

  /** 初始化：从 Supabase 加载今日数据 */
  loadToday: (userId: string) => Promise<void>;

  /** 开启新 session（自动结束旧的） */
  start: (userId: string, type: TimingType, source: TimingSource) => Promise<void>;

  /** 结束当前 active session（用户主动输入时调用） */
  endActive: (userId: string) => Promise<void>;
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const useTimingStore = create<TimingState>()(
  persist(
    (set) => ({
      activeSession: null,
      todaySessions: [],
      lastFetchedAt: null,

      loadToday: async (userId) => {
        const [sessions, active] = await Promise.all([
          fetchTodaySessions(userId),
          fetchActiveSession(userId),
        ]);
        set({ todaySessions: sessions, activeSession: active, lastFetchedAt: Date.now() });
      },

      start: async (userId, type, source) => {
        const session = await startSession(userId, type, source);
        if (!session) return;
        set((prev) => ({
          activeSession: session,
          todaySessions: [
            ...prev.todaySessions.map((s) =>
              !s.endedAt ? { ...s, endedAt: session.startedAt } : s,
            ),
            session,
          ],
        }));
      },

      endActive: async (userId) => {
        const endedAt = Date.now();
        await endActiveSession(userId);
        set((prev) => ({
          activeSession: null,
          todaySessions: prev.todaySessions.map((s) =>
            !s.endedAt ? { ...s, endedAt } : s,
          ),
        }));
      },
    }),
    {
      name: PERSIST_KEYS.timing,
      storage: createScopedJSONStorage<Partial<TimingState>>('timing'),
      skipHydration: true,
      partialize: (state) => ({
        activeSession: state.activeSession,
        todaySessions: state.todaySessions,
        lastFetchedAt: state.lastFetchedAt,
      }),
      merge: (persistedState, currentState) => {
        const persisted = {
          ...(readLegacyPersistedState<TimingState>(LEGACY_PERSIST_KEYS.timing) || {}),
          ...((persistedState as Partial<TimingState>) || {}),
        };
        const current = currentState as TimingState;
        const todayKey = getTodayKey();
        const persistedSessions = Array.isArray(persisted.todaySessions)
          ? persisted.todaySessions.filter((session) => session.date === todayKey)
          : [];
        const persistedActive = persisted.activeSession && persisted.activeSession.date === todayKey
          ? persisted.activeSession
          : null;

        return {
          ...current,
          ...persisted,
          todaySessions: persistedSessions,
          activeSession: persistedActive,
        };
      },
    }
  )
);
