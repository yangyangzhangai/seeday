import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface FocusSession {
  id: string;
  todoId: string;
  startedAt: number;
  endedAt?: number;
  setDuration: number;      // seconds, 0 = count-up mode
  actualDuration?: number;  // seconds
}

interface FocusState {
  currentSession: FocusSession | null;
  activeMessageId: string | null;    // linked record page message ID
  sessions: FocusSession[];
  startFocus: (todoId: string, duration: number) => void;
  setActiveMessageId: (id: string | null) => void;
  endFocus: () => FocusSession | null;
  isActive: () => boolean;
}

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      currentSession: null,
      activeMessageId: null,
      sessions: [],

      setActiveMessageId: (id) => set({ activeMessageId: id }),

      startFocus: (todoId, duration) => {
        const session: FocusSession = {
          id: uuidv4(),
          todoId,
          startedAt: Date.now(),
          setDuration: duration,
        };
        set({ currentSession: session });
      },

      endFocus: () => {
        const { currentSession } = get();
        if (!currentSession) return null;

        const now = Date.now();
        const actualDuration = Math.round((now - currentSession.startedAt) / 1000);
        const completed: FocusSession = {
          ...currentSession,
          endedAt: now,
          actualDuration,
        };

        set((s) => ({
          currentSession: null,
          activeMessageId: null,
          sessions: [...s.sessions, completed],
        }));
        return completed;
      },

      isActive: () => get().currentSession !== null,
    }),
    { name: 'focus-store' }
  )
);
