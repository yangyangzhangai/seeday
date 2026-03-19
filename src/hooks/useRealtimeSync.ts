/**
 * useRealtimeSync — Supabase Realtime subscriptions for multi-device sync.
 *
 * Subscribes to INSERT / UPDATE / DELETE events on:
 *   messages, todos, moods, bottles
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
import { useMoodStore, type MoodOption, type MoodSource } from '../store/useMoodStore';
import { useGrowthStore, type Bottle, type BottleType, type BottleStatus } from '../store/useGrowthStore';
import { fromDbMessage, fromDbTodo } from '../lib/dbMappers';
import { normalizeMoodKey } from '../lib/moodOptions';

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
        ({ new: row, eventType }) => {
          if (eventType === 'DELETE') return; // mood clears handled via UPDATE (null fields)
          if (!row || !row.message_id) return;
          const id: string = row.message_id;
          useMoodStore.setState(state => ({
            activityMood: row.mood_label
              ? { ...state.activityMood, [id]: normalizeMoodKey(row.mood_label) as MoodOption }
              : state.activityMood,
            activityMoodMeta: row.source
              ? { ...state.activityMoodMeta, [id]: { source: row.source as MoodSource } }
              : state.activityMoodMeta,
            customMoodLabel: row.custom_label != null
              ? { ...state.customMoodLabel, [id]: row.custom_label }
              : state.customMoodLabel,
            customMoodApplied: row.is_custom != null
              ? { ...state.customMoodApplied, [id]: row.is_custom }
              : state.customMoodApplied,
            moodNote: row.note != null
              ? { ...state.moodNote, [id]: row.note }
              : state.moodNote,
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

      .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id]);
}
