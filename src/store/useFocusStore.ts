import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import { withDbRetry } from '../lib/dbRetry';
import { PERSIST_KEYS, LEGACY_PERSIST_KEYS } from './persistKeys';
import { readLegacyPersistedState } from './persistMigrationHelpers';
import { useOutboxStore } from './useOutboxStore';
import { createScopedJSONStorage } from './scopedPersistStorage';

const MAX_RESUMABLE_SESSION_MS = 24 * 60 * 60 * 1000;

export interface FocusSession {
  id: string;
  todoId: string;
  startedAt: number;
  endedAt?: number;
  setDuration: number;      // seconds, 0 = count-up mode
  actualDuration?: number;  // seconds
}

export interface FocusQueueItem {
  todoId: string;
  durationSeconds: number; // 0 = count-up
}

interface FocusState {
  currentSession: FocusSession | null;
  activeMessageId: string | null;    // linked record page message ID
  sessions: FocusSession[];
  lastFetchedAt: number | null;
  // Queue mode
  queue: FocusQueueItem[];
  queueIndex: number;               // which item is currently running (-1 = not in queue mode)
  startFocus: (todoId: string, duration: number) => void;
  setActiveMessageId: (id: string | null) => void;
  endFocus: () => FocusSession | null;
  isActive: () => boolean;
  // Queue mode actions
  startFocusQueue: (items: FocusQueueItem[]) => void;
  advanceQueue: () => boolean;       // returns true if there's a next item, false if queue done
  clearQueue: () => void;
  /** Fetch completed sessions from Supabase (last 200) */
  fetchSessions: () => Promise<void>;
  recoverSessionAfterHydration: () => Promise<void>;
}

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      currentSession: null,
      activeMessageId: null,
      sessions: [],
      lastFetchedAt: null,
      queue: [],
      queueIndex: -1,

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
        void withDbRetry('FocusStore', async () => {
          const session = await getSupabaseSession();
          if (!session) return;
          const { error } = await supabase.from('focus_sessions').insert([{
            id: completed.id,
            user_id: session.user.id,
            todo_id: completed.todoId || null,
            started_at: new Date(completed.startedAt).toISOString(),
            ended_at: new Date(completed.endedAt!).toISOString(),
            set_duration: completed.setDuration,
            actual_duration: completed.actualDuration,
          }]);
          if (error) throw new Error(error.message);
        }).then((success) => {
          if (!success) {
            useOutboxStore.getState().enqueue({
              kind: 'focus.insert',
              payload: {
                id: completed.id,
                todoId: completed.todoId,
                startedAt: completed.startedAt,
                endedAt: completed.endedAt!,
                setDuration: completed.setDuration,
                actualDuration: completed.actualDuration,
              },
            });
          }
        });

        return completed;
      },

      isActive: () => get().currentSession !== null,

      startFocusQueue: (items) => {
        if (items.length === 0) return;
        const first = items[0];
        const session: FocusSession = {
          id: uuidv4(),
          todoId: first.todoId,
          startedAt: Date.now(),
          setDuration: first.durationSeconds,
        };
        set({ queue: items, queueIndex: 0, currentSession: session });
      },

      advanceQueue: () => {
        const { queue, queueIndex } = get();
        const nextIndex = queueIndex + 1;
        if (nextIndex >= queue.length) {
          set({ queue: [], queueIndex: -1, currentSession: null, activeMessageId: null });
          return false;
        }
        const next = queue[nextIndex];
        const session: FocusSession = {
          id: uuidv4(),
          todoId: next.todoId,
          startedAt: Date.now(),
          setDuration: next.durationSeconds,
        };
        set({ queueIndex: nextIndex, currentSession: session });
        return true;
      },

      clearQueue: () => {
        set({ queue: [], queueIndex: -1 });
      },

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
            return { sessions: [...cloudSessions, ...localOnly], lastFetchedAt: Date.now() };
          });
        } catch (err) {
          if (import.meta.env.DEV) console.warn('[FocusStore] fetchSessions failed', err);
        }
      },

      recoverSessionAfterHydration: async () => {
        const currentSession = get().currentSession;
        if (!currentSession) return;

        const now = Date.now();
        const age = now - currentSession.startedAt;
        if (age <= MAX_RESUMABLE_SESSION_MS) return;

        const endedAt = currentSession.setDuration > 0
          ? Math.min(currentSession.startedAt + currentSession.setDuration * 1000, now)
          : now;
        const recovered: FocusSession = {
          ...currentSession,
          endedAt,
          actualDuration: Math.max(0, Math.round((endedAt - currentSession.startedAt) / 1000)),
        };

        set((state) => ({
          currentSession: null,
          activeMessageId: null,
          queue: [],
          queueIndex: -1,
          sessions: [...state.sessions, recovered],
        }));

        void withDbRetry('FocusStore', async () => {
          const session = await getSupabaseSession();
          if (!session) return;
          const { error } = await supabase.from('focus_sessions').insert([{
            id: recovered.id,
            user_id: session.user.id,
            todo_id: recovered.todoId || null,
            started_at: new Date(recovered.startedAt).toISOString(),
            ended_at: new Date(recovered.endedAt!).toISOString(),
            set_duration: recovered.setDuration,
            actual_duration: recovered.actualDuration,
          }]);
          if (error) throw new Error(error.message);
        }).then((success) => {
          if (!success) {
            useOutboxStore.getState().enqueue({
              kind: 'focus.insert',
              payload: {
                id: recovered.id,
                todoId: recovered.todoId,
                startedAt: recovered.startedAt,
                endedAt: recovered.endedAt!,
                setDuration: recovered.setDuration,
                actualDuration: recovered.actualDuration,
              },
            });
          }
        });
      },
    }),
    {
      name: PERSIST_KEYS.focus,
      storage: createScopedJSONStorage<Partial<FocusState>>('focus'),
      skipHydration: true,
      partialize: (state) => ({
        sessions: state.sessions,
        lastFetchedAt: state.lastFetchedAt,
        currentSession: state.currentSession,
        activeMessageId: state.activeMessageId,
        queue: state.queue,
        queueIndex: state.queueIndex,
      }),
      merge: (persistedState, currentState) => {
        const persisted = {
          ...(readLegacyPersistedState<FocusState>(LEGACY_PERSIST_KEYS.focus) || {}),
          ...((persistedState as Partial<FocusState>) || {}),
        };
        const current = currentState as FocusState;
        const persistedSessions = Array.isArray(persisted.sessions) ? persisted.sessions : [];
        return {
          ...current,
          ...persisted,
          sessions: persistedSessions,
          currentSession: persisted.currentSession ?? null,
          activeMessageId: persisted.activeMessageId ?? null,
          queue: Array.isArray(persisted.queue) ? persisted.queue : [],
          queueIndex: typeof persisted.queueIndex === 'number' ? persisted.queueIndex : -1,
        };
      },
    }
  )
);
