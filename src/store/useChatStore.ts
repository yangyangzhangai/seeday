// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { persist } from 'zustand/middleware';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import { useAnnotationStore } from './useAnnotationStore';
import { useMoodStore } from './useMoodStore';
import { autoDetectMood } from '../lib/mood';
import type { AnnotationEvent } from '../types/annotation';
import { getLocalDateString, mapDbRowToMessage } from './chatHelpers';
import {
  buildInsertedActivityResult,
  buildMessageDurationUpdate,
  closePreviousActivity,
  handleAIChatResponse,
  persistInsertedActivityResult,
  persistMessageDurationUpdate,
  persistMessageToSupabase,
  triggerMoodDetection,
} from './chatActions';

export type MessageType = 'text' | 'system' | 'ai';

export interface Message {
  id: string;
  content: string;
  timestamp: number;
  type: MessageType;
  duration?: number;
  activityType?: string;
  mode?: 'chat' | 'record';
  isMood?: boolean;
  stardustId?: string;
  stardustEmoji?: string;
}

interface YesterdaySummary {
  count: number;
  lastContent: string;
  dateStr: string;
  dateStartMs: number;
  dateEndMs: number;
  isYesterday: boolean;
}

interface ChatState {
  messages: Message[];
  mode: 'chat' | 'record';
  lastActivityTime: number | null;
  isMoodMode: boolean;
  isLoading: boolean;
  hasInitialized: boolean;
  oldestLoadedDate: string | null;
  hasMoreHistory: boolean;
  isLoadingMore: boolean;
  yesterdaySummary: YesterdaySummary | null;
  currentDateStr: string | null;
  fetchMessages: () => Promise<void>;
  fetchOlderMessages: () => Promise<void>;
  checkAndRefreshForNewDay: () => void;
  sendMessage: (content: string, customTimestamp?: number, forcedMode?: 'chat' | 'record') => Promise<void>;
  sendMood: (content: string) => Promise<void>;
  insertActivity: (prevId: string | null, nextId: string | null, content: string, startTime: number, endTime: number) => Promise<void>;
  updateActivity: (id: string, content: string, startTime: number, endTime: number) => Promise<void>;
  endActivity: (id: string) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  updateMessageDuration: (content: string, timestamp: number, duration: number) => Promise<void>;
  setMode: (mode: 'chat' | 'record') => void;
  setHasInitialized: (value: boolean) => void;
  clearHistory: () => Promise<void>;
  attachStardustToMessage: (messageId: string, stardustId: string, stardustEmoji: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      mode: 'record',
      lastActivityTime: null,
      isMoodMode: false,
      isLoading: false,
      hasInitialized: false,
      oldestLoadedDate: null,
      hasMoreHistory: true,
      isLoadingMore: false,
      yesterdaySummary: null,
      currentDateStr: null,

      fetchMessages: async () => {
        const session = await getSupabaseSession();
        if (!session) {
          set({ hasInitialized: true });
          return;
        }

        set({ isLoading: true });
        try {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayStartMs = todayStart.getTime();
          const todayStr = getLocalDateString(todayStart);

          const yesterdayStart = new Date(todayStart);
          yesterdayStart.setDate(yesterdayStart.getDate() - 1);
          const yesterdayStr = getLocalDateString(yesterdayStart);

          const { data: todayData, error: todayError } = await supabase
            .from('messages')
            .select('*')
            .eq('user_id', session.user.id)
            .gte('timestamp', todayStartMs)
            .order('timestamp', { ascending: true });

          if (todayError) throw todayError;

          const { data: latestBeforeToday, error: latestBeforeTodayError } = await supabase
            .from('messages')
            .select('*')
            .eq('user_id', session.user.id)
            .lt('timestamp', todayStartMs)
            .order('timestamp', { ascending: false })
            .limit(1);

          if (latestBeforeTodayError) throw latestBeforeTodayError;

          const messages = (todayData || []).map(mapDbRowToMessage);

          let yesterdaySummary: YesterdaySummary | null = null;
          if (latestBeforeToday && latestBeforeToday.length > 0) {
            const latest = latestBeforeToday[0];
            const targetDate = new Date(latest.timestamp);
            targetDate.setHours(0, 0, 0, 0);
            const targetDateStartMs = targetDate.getTime();
            const targetDateEnd = new Date(targetDate);
            targetDateEnd.setDate(targetDateEnd.getDate() + 1);
            const targetDateEndMs = targetDateEnd.getTime();
            const targetDateStr = getLocalDateString(targetDate);

            const { data: previousDayData, error: previousDayError } = await supabase
              .from('messages')
              .select('*')
              .eq('user_id', session.user.id)
              .gte('timestamp', targetDateStartMs)
              .lt('timestamp', targetDateEndMs)
              .order('timestamp', { ascending: true });

            if (previousDayError) throw previousDayError;

            const safePreviousDayData = previousDayData || [];
            const lastPreviousDay = safePreviousDayData[safePreviousDayData.length - 1] || latest;

            yesterdaySummary = {
              count: safePreviousDayData.length,
              lastContent: lastPreviousDay.content,
              dateStr: targetDateStr,
              dateStartMs: targetDateStartMs,
              dateEndMs: targetDateEndMs,
              isYesterday: targetDateStr === yesterdayStr,
            };
          }

          set({
            messages,
            oldestLoadedDate: todayStr,
            hasMoreHistory: !!yesterdaySummary,
            yesterdaySummary,
            currentDateStr: todayStr,
          });
        } catch (error) {
          console.error('Error fetching messages:', error);
        } finally {
          set({ isLoading: false, hasInitialized: true });
        }
      },

      fetchOlderMessages: async () => {
        const state = get();
        if (state.isLoadingMore || !state.hasMoreHistory || !state.yesterdaySummary) return;

        const session = await getSupabaseSession();
        if (!session) return;

        set({ isLoadingMore: true });
        try {
          const { dateStartMs, dateEndMs, dateStr } = state.yesterdaySummary;

          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('user_id', session.user.id)
            .gte('timestamp', dateStartMs)
            .lt('timestamp', dateEndMs)
            .order('timestamp', { ascending: true });

          if (error) throw error;

          const olderMessages = (data || []).map(mapDbRowToMessage);

          set(state => ({
            messages: [...olderMessages, ...state.messages],
            oldestLoadedDate: dateStr,
            hasMoreHistory: false,
            yesterdaySummary: null,
          }));
        } catch (error) {
          console.error('Error fetching older messages:', error);
        } finally {
          set({ isLoadingMore: false });
        }
      },

      checkAndRefreshForNewDay: () => {
        const state = get();
        const todayStr = getLocalDateString(new Date());
        if (state.currentDateStr && state.currentDateStr !== todayStr) {
          console.log('[DayRefresh] Midnight crossed, refreshing messages...');
          state.fetchMessages();
        }
      },

      sendMessage: async (content: string, customTimestamp?: number, forcedMode?: 'chat' | 'record') => {
        const now = customTimestamp ?? Date.now();
        const state = get();
        const effectiveMode = forcedMode ?? state.mode;
        let updatedMessages = [...state.messages];

        if (effectiveMode === 'record') {
          updatedMessages = await closePreviousActivity(updatedMessages, now);
        }

        const newMessage: Message = {
          id: uuidv4(),
          content,
          timestamp: now,
          type: 'text',
          mode: effectiveMode,
          activityType: effectiveMode === 'record' ? '待分类' : 'chat'
        };

        updatedMessages.push(newMessage);

        set({
          messages: updatedMessages,
          lastActivityTime: effectiveMode === 'record' ? now : state.lastActivityTime
        });

        if (effectiveMode === 'record') {
          void triggerMoodDetection(newMessage.id, content);
        }

        const session = await getSupabaseSession();
        if (session) {
          await persistMessageToSupabase(newMessage, session.user.id);
        }

        // 触发 AI 批注（记录模式下）
        if (effectiveMode === 'record') {
          const annotationStore = useAnnotationStore.getState();

          let lastRecordIndex = -1;
          for (let i = updatedMessages.length - 1; i >= 0; i--) {
            const m = updatedMessages[i];
            if (m.mode === 'record' && !m.isMood && m.duration !== undefined) {
              lastRecordIndex = i;
              break;
            }
          }

          const recordEvent: AnnotationEvent = {
            type: 'activity_recorded',
            timestamp: Date.now(),
            data: {
              messageId: newMessage.id,
              content: newMessage.content,
            },
          };
          annotationStore.triggerAnnotation(recordEvent).catch(console.error);
        }

        if (effectiveMode === 'chat') {
          const aiMessage = await handleAIChatResponse(updatedMessages, session?.user.id);
          set((currentState) => ({ messages: [...currentState.messages, aiMessage] }));
        }
      },

      insertActivity: async (prevId, nextId, content, startTime, endTime) => {
        const state = get();
        const { finalMessages, messagesToInsert, messagesToUpdate } = buildInsertedActivityResult(
          state.messages,
          content,
          startTime,
          endTime,
        );

        set({ messages: finalMessages });

        const session = await getSupabaseSession();
        if (session) {
          await persistInsertedActivityResult(session.user.id, messagesToInsert, messagesToUpdate);
        }
      },

      updateActivity: async (id, content, startTime, endTime) => {
        const duration = Math.round((endTime - startTime) / (1000 * 60));

        set(state => ({
          messages: state.messages.map(m =>
            m.id === id
              ? { ...m, content, timestamp: startTime, duration }
              : m
          ).sort((a, b) => a.timestamp - b.timestamp)
        }));

        const session = await getSupabaseSession();
        if (session) {
          await supabase.from('messages').update({
            content,
            timestamp: startTime,
            duration
          }).eq('id', id).eq('user_id', session.user.id);
        }
      },

      endActivity: async (id) => {
        const state = get();
        const target = state.messages.find(m => m.id === id);
        if (!target || target.duration !== undefined) return;

        const duration = Math.max(0, Math.round((Date.now() - target.timestamp) / (1000 * 60)));

        set(state => ({
          messages: state.messages.map(m =>
            m.id === id ? { ...m, duration } : m
          )
        }));

        const session = await getSupabaseSession();
        if (session) {
          await supabase.from('messages').update({ duration }).eq('id', id).eq('user_id', session.user.id);
        }

        const moodStore = useMoodStore.getState();
        if (!moodStore.getMood(id)) {
          moodStore.setMood(id, autoDetectMood(target.content, duration));
        }
      },

      deleteActivity: async (id) => {
        set(state => ({
          messages: state.messages.filter(m => m.id !== id)
        }));

        const session = await getSupabaseSession();
        if (session) {
          await supabase.from('messages').delete().eq('id', id).eq('user_id', session.user.id);
        }
      },

      updateMessageDuration: async (content: string, timestamp: number, duration: number) => {
        const state = get();

        const { updatedMessages, targetMessage } = buildMessageDurationUpdate(
          state.messages,
          content,
          timestamp,
          duration,
        );

        if (!targetMessage) {
          console.log('[DEBUG] 未找到匹配的消息:', content, timestamp);
          return;
        }

        set({ messages: updatedMessages });

        const session = await getSupabaseSession();
        if (session) {
          await persistMessageDurationUpdate(session.user.id, targetMessage.id, duration);
        }

        console.log('[DEBUG] 消息 duration 已更新:', content, duration, '分钟');
      },

      sendMood: async (content: string) => {
        const now = Date.now();
        const state = get();

        const todayStr = getLocalDateString(new Date(now));
        const latestActivity = [...state.messages]
          .reverse()
          .find(
            (message) =>
              message.mode === 'record' &&
              !message.isMood &&
              getLocalDateString(new Date(message.timestamp)) === todayStr
          );

        const newMessage: Message = {
          id: uuidv4(),
          content,
          timestamp: now,
          type: 'text',
          mode: 'record',
          activityType: 'mood',
          isMood: true
        };

        set(state => ({
          messages: [...state.messages, newMessage]
        }));

        if (latestActivity) {
          const moodStore = useMoodStore.getState();
          moodStore.setMoodNote(latestActivity.id, content);
          void triggerMoodDetection(latestActivity.id, content);
        }

        const annotationStore = useAnnotationStore.getState();
        const moodEvent: AnnotationEvent = {
          type: 'mood_recorded',
          timestamp: Date.now(),
          data: {
            messageId: newMessage.id,
            mood: content,
          },
        };
        annotationStore.triggerAnnotation(moodEvent).catch(console.error);

        const session = await getSupabaseSession();
        if (session) {
          await persistMessageToSupabase(newMessage, session.user.id, true);
        }
      },

      setMode: (mode) => set({ mode }),
      setHasInitialized: (value) => set({ hasInitialized: value }),

      clearHistory: async () => {
        set({ messages: [], lastActivityTime: null });
      },

      attachStardustToMessage: (messageId, stardustId, stardustEmoji) => {
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === messageId
              ? { ...message, stardustId, stardustEmoji }
              : message
          ),
        }));
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        messages: state.messages,
        mode: state.mode,
        isMoodMode: state.isMoodMode,
        lastActivityTime: state.lastActivityTime,
        currentDateStr: state.currentDateStr,
      }),
    }
  )
);
