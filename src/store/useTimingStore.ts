// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/services/timing/timingSessionService.ts
/**
 * 当前 active session + 今日会话列表
 */
import { create } from 'zustand';
import {
  TimingSession,
  TimingType,
  TimingSource,
  startSession,
  endActiveSession,
  fetchTodaySessions,
  fetchActiveSession,
} from '../services/timing/timingSessionService';

interface TimingState {
  activeSession: TimingSession | null;
  todaySessions: TimingSession[];

  /** 初始化：从 Supabase 加载今日数据 */
  loadToday: (userId: string) => Promise<void>;

  /** 开启新 session（自动结束旧的） */
  start: (userId: string, type: TimingType, source: TimingSource) => Promise<void>;

  /** 结束当前 active session（用户主动输入时调用） */
  endActive: (userId: string) => Promise<void>;
}

export const useTimingStore = create<TimingState>((set) => ({
  activeSession: null,
  todaySessions: [],

  loadToday: async (userId) => {
    const [sessions, active] = await Promise.all([
      fetchTodaySessions(userId),
      fetchActiveSession(userId),
    ]);
    set({ todaySessions: sessions, activeSession: active });
  },

  start: async (userId, type, source) => {
    const session = await startSession(userId, type, source);
    if (!session) return;
    set((prev) => ({
      activeSession: session,
      // 结束旧 active session（在列表中打上 endedAt 时间戳）
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
}));
