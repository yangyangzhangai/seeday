/**
 * useRealtimeSync — Supabase Realtime subscriptions for multi-device sync.
 *
 * Subscribes to INSERT / UPDATE / DELETE events on:
 *   messages, todos, moods, bottles, reports, annotations, focus_sessions, stardust_memories
 *
 * Call this hook once at the top of the app (after auth is initialised).
 * The hook is a no-op when the user is not signed in.
 */
import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useTodoStore } from '../store/useTodoStore';
import { useReportStore } from '../store/useReportStore';
import { useAnnotationStore } from '../store/useAnnotationStore';
import { useFocusStore, type FocusSession } from '../store/useFocusStore';
import { useStardustStore } from '../store/useStardustStore';
import {
  applyMoodRowToMaps,
  pruneMoodRecordMaps,
  removeMoodRecordFromMaps,
  useMoodStore,
  type MoodRowData,
} from '../store/useMoodStore';
import { useGrowthStore, type Bottle, type BottleType, type BottleStatus } from '../store/useGrowthStore';
import { fromDbAnnotation, fromDbMessage, fromDbReport, fromDbStardust, fromDbTodo } from '../lib/dbMappers';

export function useRealtimeSync() {
  const user = useAuthStore(s => s.user);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user?.id) {
      // Not signed in — tear down any existing channel
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const userId = user.id;

    const channel = supabase
      .channel(`user-sync-${userId}`)

      // ── messages ────────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `user_id=eq.${userId}` },
        ({ new: row }) => {
          const msg = fromDbMessage(row);
          useChatStore.setState(state => {
            if (state.messages.some(m => m.id === msg.id)) return state; // already present
            return { messages: [...state.messages, msg] };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `user_id=eq.${userId}` },
        ({ new: row }) => {
          const msg = fromDbMessage(row);
          useChatStore.setState(state => ({
            messages: state.messages.map(m => m.id === msg.id ? { ...m, ...msg } : m),
          }));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `user_id=eq.${userId}` },
        ({ old: row }) => {
          useChatStore.setState(state => ({
            messages: state.messages.filter(m => m.id !== row.id),
          }));
        },
      )

      // ── todos ────────────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'todos', filter: `user_id=eq.${userId}` },
        ({ new: row }) => {
          const todo = fromDbTodo(row);
          useTodoStore.setState(state => {
            if (state.todos.some(t => t.id === todo.id)) return state;
            return { todos: [...state.todos, todo] };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'todos', filter: `user_id=eq.${userId}` },
        ({ new: row }) => {
          const todo = fromDbTodo(row);
          useTodoStore.setState(state => ({
            todos: state.todos.map(t => t.id === todo.id ? { ...t, ...todo } : t),
          }));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'todos', filter: `user_id=eq.${userId}` },
        ({ old: row }) => {
          useTodoStore.setState(state => ({
            todos: state.todos.filter(t => t.id !== row.id),
          }));
        },
      )

      // ── moods ────────────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'moods', filter: `user_id=eq.${userId}` },
        ({ new: row, old: oldRow, eventType }) => {
          const messageId = (row?.message_id ?? oldRow?.message_id) as string | undefined;
          if (!messageId) return;

          useMoodStore.setState(state => ({
            ...pruneMoodRecordMaps(
              eventType === 'DELETE' || !row
                ? removeMoodRecordFromMaps(
                    {
                      activityMood: state.activityMood,
                      activityMoodMeta: state.activityMoodMeta,
                      customMoodLabel: state.customMoodLabel,
                      customMoodApplied: state.customMoodApplied,
                      moodNote: state.moodNote,
                      moodNoteMeta: state.moodNoteMeta,
                    },
                    messageId,
                  )
                : applyMoodRowToMaps(
                    {
                      activityMood: state.activityMood,
                      activityMoodMeta: state.activityMoodMeta,
                      customMoodLabel: state.customMoodLabel,
                      customMoodApplied: state.customMoodApplied,
                      moodNote: state.moodNote,
                      moodNoteMeta: state.moodNoteMeta,
                    },
                    row as MoodRowData,
                  ),
            ),
          }));
        },
      )

      // ── bottles ──────────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bottles', filter: `user_id=eq.${userId}` },
        ({ new: row }) => {
          const bottle: Bottle = {
            id: row.id as string,
            name: row.name as string,
            type: row.type as BottleType,
            stars: row.stars as number,
            round: row.round as number,
            status: row.status as BottleStatus,
            createdAt: new Date(row.created_at as string).getTime(),
          };
          useGrowthStore.setState(state => {
            if (state.bottles.some(b => b.id === bottle.id)) return state;
            return { bottles: [...state.bottles, bottle] };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bottles', filter: `user_id=eq.${userId}` },
        ({ new: row }) => {
          useGrowthStore.setState(state => ({
            bottles: row.status === 'irrigated'
              ? state.bottles.filter(b => b.id !== row.id)   // irrigated = remove locally
              : state.bottles.map(b => b.id !== row.id ? b : {
                  ...b,
                  stars: row.stars as number,
                  round: row.round as number,
                  status: row.status as BottleStatus,
                }),
          }));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'bottles', filter: `user_id=eq.${userId}` },
        ({ old: row }) => {
          useGrowthStore.setState(state => ({
            bottles: state.bottles.filter(b => b.id !== row.id),
          }));
        },
      )

      // ── reports ──────────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports', filter: `user_id=eq.${userId}` },
        ({ new: row }) => {
          const report = fromDbReport(row);
          useReportStore.setState((state) => {
            if (state.reports.some((item) => item.id === report.id)) return state;
            return { reports: [report, ...state.reports] };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reports', filter: `user_id=eq.${userId}` },
        ({ new: row }) => {
          const report = fromDbReport(row);
          useReportStore.setState((state) => {
            const exists = state.reports.some((item) => item.id === report.id);
            if (!exists) {
              return { reports: [report, ...state.reports] };
            }
            return {
              reports: state.reports.map((item) => (item.id === report.id ? { ...item, ...report } : item)),
            };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'reports', filter: `user_id=eq.${userId}` },
        ({ old: row }) => {
          useReportStore.setState((state) => ({
            reports: state.reports.filter((item) => item.id !== row.id),
          }));
        },
      )

      // ── annotations ──────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'annotations', filter: `user_id=eq.${userId}` },
        ({ new: row }) => {
          const annotation = fromDbAnnotation(row);
          useAnnotationStore.setState((state) => {
            if (state.annotations.some((item) => item.id === annotation.id)) return state;
            return { annotations: [annotation, ...state.annotations] };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'annotations', filter: `user_id=eq.${userId}` },
        ({ new: row }) => {
          const annotation = fromDbAnnotation(row);
          useAnnotationStore.setState((state) => {
            const exists = state.annotations.some((item) => item.id === annotation.id);
            return {
              annotations: exists
                ? state.annotations.map((item) => (item.id === annotation.id ? { ...item, ...annotation } : item))
                : [annotation, ...state.annotations],
              currentAnnotation: state.currentAnnotation?.id === annotation.id
                ? { ...state.currentAnnotation, ...annotation }
                : state.currentAnnotation,
            };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'annotations', filter: `user_id=eq.${userId}` },
        ({ old: row }) => {
          useAnnotationStore.setState((state) => ({
            annotations: state.annotations.filter((item) => item.id !== row.id),
            currentAnnotation: state.currentAnnotation?.id === row.id ? null : state.currentAnnotation,
          }));
        },
      )

      // ── focus_sessions ───────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'focus_sessions', filter: `user_id=eq.${userId}` },
        ({ new: row }) => {
          const session: FocusSession = {
            id: row.id as string,
            todoId: (row.todo_id as string) ?? '',
            startedAt: new Date(row.started_at as string).getTime(),
            endedAt: row.ended_at ? new Date(row.ended_at as string).getTime() : undefined,
            setDuration: (row.set_duration as number) ?? 0,
            actualDuration: row.actual_duration as number | undefined,
          };
          useFocusStore.setState((state) => {
            if (state.sessions.some((item) => item.id === session.id)) return state;
            return { sessions: [session, ...state.sessions] };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'focus_sessions', filter: `user_id=eq.${userId}` },
        ({ new: row }) => {
          const session: FocusSession = {
            id: row.id as string,
            todoId: (row.todo_id as string) ?? '',
            startedAt: new Date(row.started_at as string).getTime(),
            endedAt: row.ended_at ? new Date(row.ended_at as string).getTime() : undefined,
            setDuration: (row.set_duration as number) ?? 0,
            actualDuration: row.actual_duration as number | undefined,
          };
          useFocusStore.setState((state) => {
            const exists = state.sessions.some((item) => item.id === session.id);
            if (!exists) {
              return { sessions: [session, ...state.sessions] };
            }
            return {
              sessions: state.sessions.map((item) => (item.id === session.id ? { ...item, ...session } : item)),
            };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'focus_sessions', filter: `user_id=eq.${userId}` },
        ({ old: row }) => {
          useFocusStore.setState((state) => ({
            sessions: state.sessions.filter((item) => item.id !== row.id),
          }));
        },
      )

      // ── stardust_memories ────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stardust_memories', filter: `user_id=eq.${userId}` },
        ({ new: row }) => {
          const memory = fromDbStardust(row);
          useStardustStore.setState((state) => {
            if (state.memories.some((item) => item.id === memory.id)) return state;
            const memories = [memory, ...state.memories];
            return {
              memories,
              memoryIdByMessageId: {
                ...state.memoryIdByMessageId,
                [memory.messageId]: memory.id,
              },
            };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stardust_memories', filter: `user_id=eq.${userId}` },
        ({ new: row }) => {
          const memory = fromDbStardust(row);
          useStardustStore.setState((state) => {
            const exists = state.memories.some((item) => item.id === memory.id);
            const memories = exists
              ? state.memories.map((item) => (item.id === memory.id ? { ...item, ...memory } : item))
              : [memory, ...state.memories];
            return {
              memories,
              memoryIdByMessageId: {
                ...state.memoryIdByMessageId,
                [memory.messageId]: memory.id,
              },
            };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'stardust_memories', filter: `user_id=eq.${userId}` },
        ({ old: row }) => {
          useStardustStore.setState((state) => {
            const memories = state.memories.filter((item) => item.id !== row.id);
            const memoryIdByMessageId = memories.reduce<Record<string, string>>((acc, item) => {
              acc[item.messageId] = item.id;
              return acc;
            }, {});
            return { memories, memoryIdByMessageId };
          });
        },
      )

      .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id]);
}
