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
import { getLocalDateString } from '../store/chatHelpers';
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
import { autoDetectMood } from '../lib/mood';
import i18n from '../i18n';

type SupportedLang = 'zh' | 'en' | 'it';

function resolveLangForContent(content: string): SupportedLang {
  if (/[\u3400-\u9fff]/.test(content)) return 'zh';
  if (/[A-Za-z\u00C0-\u017F]/.test(content)) return 'en';
  const lang = i18n.language?.split('-')[0] ?? 'zh';
  return (lang === 'zh' || lang === 'en' || lang === 'it') ? lang as SupportedLang : 'zh';
}

export function useRealtimeSync() {
  const user = useAuthStore(s => s.user);
  const highFrequencyChannelRef = useRef<RealtimeChannel | null>(null);
  const lowFrequencyChannelRef = useRef<RealtimeChannel | null>(null);

  const teardownChannels = () => {
    if (highFrequencyChannelRef.current) {
      void supabase.removeChannel(highFrequencyChannelRef.current);
      highFrequencyChannelRef.current = null;
    }
    if (lowFrequencyChannelRef.current) {
      void supabase.removeChannel(lowFrequencyChannelRef.current);
      lowFrequencyChannelRef.current = null;
    }
  };

  useEffect(() => {
    if (!user?.id) {
      teardownChannels();
      return;
    }

    const userId = user.id;

    const highFrequencyChannel = supabase
      .channel(`user-sync-hf-${userId}`)

      // ── messages ────────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `user_id=eq.${userId}` },
        ({ new: row }) => {
          const msg = fromDbMessage(row);
          const dateStr = getLocalDateString(new Date(msg.timestamp));
          useChatStore.setState(state => {
            if (state.messages.some(m => m.id === msg.id)) return state; // already present
            const updatedDateEntries = [...(state.dateCache[dateStr] ?? []).filter(m => m.id !== msg.id), msg];
            const shouldTouchMessages = state.activeViewDateStr === dateStr;
            return {
              messages: shouldTouchMessages ? [...state.messages, msg] : state.messages,
              dateCache: { ...state.dateCache, [dateStr]: updatedDateEntries },
            };
          });
          // Auto-detect mood for incoming activity messages that don't have one yet
          if (msg.mode === 'record' && !msg.isMood && msg.duration != null) {
            const moodStore = useMoodStore.getState();
            if (!moodStore.getMood(msg.id)) {
              moodStore.setMood(msg.id, autoDetectMood(msg.content, msg.duration, resolveLangForContent(msg.content)), 'auto');
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `user_id=eq.${userId}` },
        ({ new: row }) => {
          const msg = fromDbMessage(row);
          const dateStr = getLocalDateString(new Date(msg.timestamp));
          useChatStore.setState(state => {
            const nextDateCache: typeof state.dateCache = {};
            for (const [date, msgs] of Object.entries(state.dateCache)) {
              nextDateCache[date] = msgs.filter(m => m.id !== msg.id);
            }
            nextDateCache[dateStr] = [...(nextDateCache[dateStr] ?? []), msg];

            const shouldTouchMessages = state.activeViewDateStr === dateStr;
            const cleanedMessages = state.messages.filter(m => m.id !== msg.id);
            return {
              messages: shouldTouchMessages ? [...cleanedMessages, msg] : cleanedMessages,
              dateCache: nextDateCache,
            };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `user_id=eq.${userId}` },
        ({ old: row }) => {
          useChatStore.setState(state => {
            const newDateCache: Record<string, import('../store/useChatStore.types').Message[]> = {};
            for (const [date, msgs] of Object.entries(state.dateCache)) {
              newDateCache[date] = msgs.filter(m => m.id !== row.id);
            }
            return {
              messages: state.messages.filter(m => m.id !== row.id),
              dateCache: newDateCache,
            };
          });
        },
      )

      // ── moods ────────────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'moods', filter: `user_id=eq.${userId}` },
        ({ new: row, old: oldRow, eventType }) => {
          const newRow = row as { message_id?: string } | null;
          const prevRow = oldRow as { message_id?: string } | null;
          const messageId = (newRow?.message_id ?? prevRow?.message_id) as string | undefined;
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
      );

    const lowFrequencyChannel = supabase
      .channel(`user-sync-lf-${userId}`)

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
          const updatedRow = row as { id: string; deleted_at?: string | null };
          if (updatedRow.deleted_at) {
            useTodoStore.setState(state => {
              const nextPending = { ...state.pendingDeletedTodoIds };
              delete nextPending[updatedRow.id];
              return {
                todos: state.todos.filter(t => t.id !== updatedRow.id),
                pendingDeletedTodoIds: nextPending,
              };
            });
            return;
          }

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

    highFrequencyChannel.subscribe();
    highFrequencyChannelRef.current = highFrequencyChannel;
    lowFrequencyChannelRef.current = lowFrequencyChannel;

    return () => {
      teardownChannels();
    };
  }, [user?.id]);
}
