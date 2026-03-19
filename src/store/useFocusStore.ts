import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';

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
  /** Fetch completed sessions from Supabase (last 200) */
  fetchSessions: () => Promise<void>;
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

        // Persist completed session to Supabase
        void (async () => {
          try {
            const session = await getSupabaseSession();
            if (!session) return;
            await supabase.from('focus_sessions').insert([{
              id: completed.id,
              user_id: session.user.id,
              todo_id: completed.todoId || null,
              started_at: new Date(completed.startedAt).toISOString(),
              ended_at: new Date(completed.endedAt!).toISOString(),
              set_duration: completed.setDuration,
              actual_duration: completed.actualDuration,
            }]);
          } catch (err) {
            if (import.meta.env.DEV) console.warn('[FocusStore] insert session failed', err);
          }
        })();

        return completed;
      },

      isActive: () => get().currentSession !== null,

      fetchSessions: async () => {
        try {
          const session = await getSupabaseSession();
          if (!session) return;
          const { data, error } = await supabase
            .from('focus_sessions')
            .select('id, todo_id, started_at, ended_at, set_duration, actual_duration')
            .eq('user_id', session.user.id)
            .not('ended_at', 'is', null)
            .order('started_at', { ascending: false })
            .limit(200);
          if (error || !data) return;

          const cloudSessions: FocusSession[] = (data as Record<string, unknown>[]).map(row => ({
            id: row.id as string,
            todoId: (row.todo_id as string) ?? '',
            startedAt: new Date(row.started_at as string).getTime(),
            endedAt: row.ended_at ? new Date(row.ended_at as string).getTime() : undefined,
            setDuration: (row.set_duration as number) ?? 0,
            actualDuration: row.actual_duration as number | undefined,
          }));

          set(state => {
            const cloudIds = new Set(cloudSessions.map(s => s.id));
            const localOnly = state.sessions.filter(s => !cloudIds.has(s.id));
            return { sessions: [...cloudSessions, ...localOnly] };
          });
        } catch (err) {
          if (import.meta.env.DEV) console.warn('[FocusStore] fetchSessions failed', err);
        }
      },
    }),
    { name: 'focus-store' }
  )
);
