import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { persist } from 'zustand/middleware';
import { supabase } from '../api/supabase';
import { useAnnotationStore } from './useAnnotationStore';
import { useMoodStore } from './useMoodStore';
import { autoDetectMood } from '../lib/mood';
import type { AnnotationEvent } from '../types/annotation';
import { getLocalDateString, mapDbRowToMessage } from './chatHelpers';
import { closePreviousActivity, persistMessageToSupabase, triggerMoodDetection, handleAIChatResponse } from './chatActions';

export type MessageType = 'text' | 'system' | 'ai';

export interface Message {
  id: string;
  content: string;
  timestamp: number;
  type: MessageType;
  duration?: number; // Duration in minutes since THIS activity started until the next one
  activityType?: string; // AI classified type
  mode?: 'chat' | 'record'; // Distinguish between chat and record modes
  isMood?: boolean; // Whether this is a mood record
  // 星尘珍藏关联字段
  stardustId?: string; // 关联的珍藏ID
  stardustEmoji?: string; // 珍藏的Emoji字符（本地展示用，避免频繁查询store）
}

interface YesterdaySummary {
  count: number;
  lastContent: string;
}

interface ChatState {
  messages: Message[];
  mode: 'chat' | 'record';
  lastActivityTime: number | null;
  isMoodMode: boolean;
  isLoading: boolean;
  hasInitialized: boolean;
  // Day-based loading state
  oldestLoadedDate: string | null; // YYYY-MM-DD of the earliest loaded day
  hasMoreHistory: boolean;
  isLoadingMore: boolean;
  yesterdaySummary: YesterdaySummary | null;
  currentDateStr: string | null; // YYYY-MM-DD of "today" when messages were loaded
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
      // Day-based loading state
      oldestLoadedDate: null,
      hasMoreHistory: true,
      isLoadingMore: false,
      yesterdaySummary: null,
      currentDateStr: null,

      fetchMessages: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          set({ hasInitialized: true });
          return;
        }

        set({ isLoading: true });
        try {
          // Calculate today's 00:00 in local timezone
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayStartMs = todayStart.getTime();
          const todayStr = getLocalDateString(todayStart);

          // Calculate yesterday's 00:00
          const yesterdayStart = new Date(todayStart);
          yesterdayStart.setDate(yesterdayStart.getDate() - 1);
          const yesterdayStartMs = yesterdayStart.getTime();

          // Fetch today's messages
          const { data: todayData, error: todayError } = await supabase
            .from('messages')
            .select('*')
            .eq('user_id', session.user.id)
            .gte('timestamp', todayStartMs)
            .order('timestamp', { ascending: true });

          if (todayError) throw todayError;

          // Fetch yesterday's messages (for summary)
          const { data: yesterdayData, error: yesterdayError } = await supabase
            .from('messages')
            .select('*')
            .eq('user_id', session.user.id)
            .gte('timestamp', yesterdayStartMs)
            .lt('timestamp', todayStartMs)
            .order('timestamp', { ascending: true });

          if (yesterdayError) throw yesterdayError;

          const messages = (todayData || []).map(mapDbRowToMessage);

          // Build yesterday summary
          let yesterdaySummary: YesterdaySummary | null = null;
          if (yesterdayData && yesterdayData.length > 0) {
            const lastYesterday = yesterdayData[yesterdayData.length - 1];
            yesterdaySummary = {
              count: yesterdayData.length,
              lastContent: lastYesterday.content,
            };
          }

          set({
            messages,
            oldestLoadedDate: todayStr,
            hasMoreHistory: true,
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
        if (state.isLoadingMore || !state.hasMoreHistory || !state.oldestLoadedDate) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        set({ isLoadingMore: true });
        try {
          // Calculate the day before oldestLoadedDate
          const oldestDate = new Date(state.oldestLoadedDate + 'T00:00:00');
          const prevDayStart = new Date(oldestDate);
          prevDayStart.setDate(prevDayStart.getDate() - 1);
          prevDayStart.setHours(0, 0, 0, 0);
          const prevDayStartMs = prevDayStart.getTime();
          const oldestDateMs = oldestDate.getTime();
          const prevDayStr = getLocalDateString(prevDayStart);

          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('user_id', session.user.id)
            .gte('timestamp', prevDayStartMs)
            .lt('timestamp', oldestDateMs)
            .order('timestamp', { ascending: true });

          if (error) throw error;

          const olderMessages = (data || []).map(mapDbRowToMessage);

          set(state => ({
            messages: [...olderMessages, ...state.messages],
            oldestLoadedDate: prevDayStr,
            hasMoreHistory: olderMessages.length > 0,
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
        // If the stored date differs from actual today, we crossed midnight
        if (state.currentDateStr && state.currentDateStr !== todayStr) {
          console.log('[DayRefresh] Midnight crossed, refreshing messages...');
          state.fetchMessages();
        }
      },

      sendMessage: async (content: string, customTimestamp?: number, forcedMode?: 'chat' | 'record') => {
        const now = customTimestamp ?? Date.now();
        const state = get();
        // 使用强制指定的 mode，如果没有则使用当前 state 的 mode
        const effectiveMode = forcedMode ?? state.mode;
        let updatedMessages = [...state.messages];

        // If in record mode, find the last activity to update its duration
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

        // Update state immediately (Optimistic)
        set({
          messages: updatedMessages,
          lastActivityTime: effectiveMode === 'record' ? now : state.lastActivityTime
        });

        if (effectiveMode === 'record') {
          void triggerMoodDetection(newMessage.id, content);
        }

        // Persist to Supabase if logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await persistMessageToSupabase(newMessage, session.user.id);
        }

        // 触发 AI 批注（记录模式下）
        if (effectiveMode === 'record') {
          const annotationStore = useAnnotationStore.getState();

          // 检查上一个活动是否完成（有 duration）
          let lastRecordIndex = -1;
          for (let i = updatedMessages.length - 1; i >= 0; i--) {
            const m = updatedMessages[i];
            if (m.mode === 'record' && !m.isMood && m.duration !== undefined) {
              lastRecordIndex = i;
              break;
            }
          }

          // 触发新活动记录批注
          const recordEvent: AnnotationEvent = {
            type: 'activity_recorded',
            timestamp: Date.now(),
            data: {
              content: newMessage.content,
            },
          };
          annotationStore.triggerAnnotation(recordEvent).catch(console.error);
        }

        // AI Response Logic
        if (effectiveMode === 'chat') {
          const aiMessage = await handleAIChatResponse(updatedMessages, session?.user.id);
          set((currentState) => ({ messages: [...currentState.messages, aiMessage] }));
        } else {
          // Record mode AI analysis
          // ... (existing logic for record mode analysis)
        }
      },

      insertActivity: async (prevId, nextId, content, startTime, endTime) => {
        const newMessage: Message = {
          id: uuidv4(),
          content,
          timestamp: startTime,
          type: 'text',
          duration: Math.round((endTime - startTime) / (1000 * 60)),
          activityType: '待分类',
          mode: 'record'
        };

        const state = get();

        const messagesToInsert: Message[] = [newMessage];
        const messagesToUpdate: Message[] = [];

        let currentMessages = state.messages.map(m => {
          if (m.mode !== 'record') return m;

          const mStart = m.timestamp;
          const mDuration = m.duration || 0;
          const mEnd = mStart + mDuration * 60 * 1000;

          if (mStart < endTime && mEnd > startTime) {

            // Case 1: Split (New inside Old)
            if (mStart < startTime && mEnd > endTime) {
              const tailDuration = Math.round((mEnd - endTime) / (1000 * 60));
              const tailMessage: Message = {
                ...m,
                id: uuidv4(),
                timestamp: endTime,
                duration: tailDuration
              };
              messagesToInsert.push(tailMessage);

              const headDuration = Math.round((startTime - mStart) / (1000 * 60));
              const updatedHead = { ...m, duration: headDuration };

              messagesToUpdate.push(updatedHead);
              return updatedHead;
            }

            // Case 2: Start Collision (Push Back)
            if (Math.abs(mStart - startTime) < 1000) {
              const updatedStart = endTime;
              const updatedDuration = Math.max(0, Math.round((mEnd - updatedStart) / (1000 * 60)));
              const updatedMsg = { ...m, timestamp: updatedStart, duration: updatedDuration };
              messagesToUpdate.push(updatedMsg);
              return updatedMsg;
            }

            // Case 3: End Collision (Truncate)
            if (mStart < startTime) {
              const updatedDuration = Math.max(0, Math.round((startTime - mStart) / (1000 * 60)));
              if (updatedDuration !== mDuration) {
                const updatedMsg = { ...m, duration: updatedDuration };
                messagesToUpdate.push(updatedMsg);
                return updatedMsg;
              }
            }
          }
          return m;
        });

        const finalMessages = [...currentMessages, ...messagesToInsert].sort((a, b) => a.timestamp - b.timestamp);

        set({ messages: finalMessages });

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const insertPayload = messagesToInsert.map(msg => ({
            id: msg.id,
            content: msg.content,
            timestamp: msg.timestamp,
            type: msg.type,
            duration: msg.duration,
            activity_type: msg.activityType,
            user_id: session.user.id
          }));

          if (insertPayload.length > 0) {
            await supabase.from('messages').insert(insertPayload);
          }

          for (const msg of messagesToUpdate) {
            await supabase.from('messages').update({
              timestamp: msg.timestamp,
              duration: msg.duration
            }).eq('id', msg.id).eq('user_id', session.user.id);
          }
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

        const { data: { session } } = await supabase.auth.getSession();
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

        const { data: { session } } = await supabase.auth.getSession();
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

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from('messages').delete().eq('id', id).eq('user_id', session.user.id);
        }
      },

      // 更新特定消息的 duration（用于待办完成后同步耗时）
      updateMessageDuration: async (content: string, timestamp: number, duration: number) => {
        const state = get();

        // 查找匹配的消息（相同内容、相同时间戳、记录模式）
        const messageIndex = state.messages.findIndex(m =>
          m.mode === 'record' &&
          m.content === content &&
          Math.abs(m.timestamp - timestamp) < 1000 // 时间戳相差小于1秒视为同一条
        );

        if (messageIndex === -1) {
          console.log('[DEBUG] 未找到匹配的消息:', content, timestamp);
          return;
        }

        const targetMessage = state.messages[messageIndex];

        // 更新本地状态
        set(state => ({
          messages: state.messages.map((m, idx) =>
            idx === messageIndex ? { ...m, duration } : m
          )
        }));

        // 同步到 Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from('messages').update({ duration }).eq('id', targetMessage.id).eq('user_id', session.user.id);
        }

        console.log('[DEBUG] 消息 duration 已更新:', content, duration, '分钟');
      },

      sendMood: async (content: string) => {
        const now = Date.now();
        const state = get();

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

        // 触发心情记录批注
        const annotationStore = useAnnotationStore.getState();
        const moodEvent: AnnotationEvent = {
          type: 'mood_recorded',
          timestamp: Date.now(),
          data: {
            mood: content,
          },
        };
        annotationStore.triggerAnnotation(moodEvent).catch(console.error);

        // Persist to Supabase if logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { error } = await supabase.from('messages').insert([{
            id: newMessage.id,
            content: newMessage.content,
            timestamp: newMessage.timestamp,
            type: newMessage.type,
            activity_type: newMessage.activityType,
            user_id: session.user.id,
            is_mood: true
          }]);
          if (error) console.error('Error sending mood:', error);
        }
      },

      setMode: (mode) => set({ mode }),
      setHasInitialized: (value) => set({ hasInitialized: value }),

      clearHistory: async () => {
        set({ messages: [], lastActivityTime: null });
      }
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
