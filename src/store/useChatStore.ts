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
import type { LiveInputClassification } from '../services/input/types';
import { recordLiveInputCorrection } from '../services/input/liveInputTelemetry';
import { getLocalDateString, mapDbRowToMessage } from './chatHelpers';
import { useTodoStore } from './useTodoStore';
import { useGrowthStore } from './useGrowthStore';
import { callClassifierAPI } from '../api/client';
import i18n from '../i18n';
import {
  applyReclassifyMoodSideEffects,
  buildRecentReclassifyResult,
  sendAutoRecognizedInputFlow,
  buildInsertedActivityResult,
  buildMessageDurationUpdate,
  closePreviousActivity,
  handleAIChatResponse,
  persistReclassifiedMessages,
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
  sendMessage: (
    content: string,
    customTimestamp?: number,
    forcedMode?: 'chat' | 'record',
    options?: { skipMoodDetection?: boolean }
  ) => Promise<string | null>;
  sendMood: (content: string, options?: { relatedActivityId?: string }) => Promise<string | null>;
  sendAutoRecognizedInput: (content: string) => Promise<LiveInputClassification | null>;
  reclassifyRecentInput: (messageId: string, nextKind: 'activity' | 'mood') => Promise<void>;
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

      sendMessage: async (content: string, customTimestamp?: number, forcedMode?: 'chat' | 'record', options?: { skipMoodDetection?: boolean }) => {
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
          if (!options?.skipMoodDetection) {
            void triggerMoodDetection(newMessage.id, content);
          }
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

        return newMessage.id;
      },

      sendAutoRecognizedInput: async (content: string) => {
        const state = get();
        const result = await sendAutoRecognizedInputFlow(
          content,
          state.messages,
          get().sendMessage,
          get().sendMood,
        );
        return result?.classification ?? null;
      },

      reclassifyRecentInput: async (messageId, nextKind) => {
        const state = get();
        const originalMessage = state.messages.find((message) => message.id === messageId);
        const result = buildRecentReclassifyResult(
          state.messages,
          messageId,
          nextKind,
          useMoodStore.getState().moodNoteMeta,
        );

        if (!result) {
          return;
        }

        const target = result.updatedMessages.find((message) => message.id === messageId);
        if (!target) {
          return;
        }

        set({ messages: result.updatedMessages });

        if (originalMessage) {
          recordLiveInputCorrection(originalMessage.isMood ? 'mood' : 'activity', nextKind);
        }

        applyReclassifyMoodSideEffects(
          messageId,
          nextKind,
          target.content,
          result.previousActivityId,
          result.previousActivityMoodAttachmentToClear,
        );

        const session = await getSupabaseSession();
        if (session) {
          await persistReclassifiedMessages(session.user.id, result.patches);
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

        const moodStore = useMoodStore.getState();
        const moodMeta = moodStore.activityMoodMeta[id];
        const isCustomApplied = moodStore.customMoodApplied[id] === true;
        if (moodMeta?.source === 'auto' && !isCustomApplied) {
          moodStore.setMood(id, autoDetectMood(content, duration), 'auto');
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

        // Auto-complete linked growth todo
        useTodoStore.getState().completeTodoByMessage(id);

        // AI semantic matching: if activity relates to a habit/goal bottle, add a star
        const growthStore = useGrowthStore.getState();
        const activeBottles = growthStore.bottles.filter(b => b.status === 'active');
        const habits = activeBottles.filter(b => b.type === 'habit').map(b => ({ id: b.id, name: b.name }));
        const goals = activeBottles.filter(b => b.type === 'goal').map(b => ({ id: b.id, name: b.name }));

        if (habits.length > 0 || goals.length > 0) {
          const lang = (i18n.language?.slice(0, 2) as 'zh' | 'en' | 'it') || 'zh';

          // Keyword fallback: match activity content against bottle names
          const keywordMatch = (text: string, bottles: { id: string; name: string }[]): string | null => {
            const lower = text.toLowerCase();
            for (const b of bottles) {
              const words = b.name.toLowerCase().split(/\s+/);
              if (words.some(w => w.length >= 2 && lower.includes(w))) return b.id;
            }
            return null;
          };

          callClassifierAPI({ rawInput: target.content, lang, habits, goals })
            .then((result) => {
              if (!result.success || !result.data?.items) {
                // API failed — use keyword fallback
                const matched = keywordMatch(target.content, [...habits, ...goals]);
                if (matched) growthStore.incrementBottleStar(matched);
                return;
              }
              let aiMatched = false;
              for (const item of result.data.items) {
                if (item.matched_bottle?.id) {
                  growthStore.incrementBottleStar(item.matched_bottle.id);
                  aiMatched = true;
                  break; // max one star per activity
                }
              }
              // AI returned no match — try keyword fallback
              if (!aiMatched) {
                const matched = keywordMatch(target.content, [...habits, ...goals]);
                if (matched) growthStore.incrementBottleStar(matched);
              }
            })
            .catch(() => {
              // API error — use keyword fallback
              const matched = keywordMatch(target.content, [...habits, ...goals]);
              if (matched) growthStore.incrementBottleStar(matched);
            });
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

      sendMood: async (content: string, options?: { relatedActivityId?: string }) => {
        const now = Date.now();
        const state = get();
        const relatedActivityId = options?.relatedActivityId;

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

        if (relatedActivityId) {
          const moodStore = useMoodStore.getState();
          moodStore.setMoodNote(relatedActivityId, content, {
            source: 'auto',
            linkedMoodMessageId: newMessage.id,
          });
          void triggerMoodDetection(relatedActivityId, content, {
            source: 'auto',
            linkedMoodMessageId: newMessage.id,
          });
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

        return newMessage.id;
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
