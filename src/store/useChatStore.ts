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
import { recordLiveInputCorrection } from '../services/input/liveInputTelemetry';
import { getLocalDateString, mapDbRowToMessage } from './chatHelpers';
import { useTodoStore } from './useTodoStore';
import { useGrowthStore } from './useGrowthStore';
import { callClassifierAPI } from '../api/client';
import i18n from '../i18n';
import type { ActivityRecordType } from '../lib/activityType';
import {
  classifyRecordActivityType,
  mapClassifierCategoryToActivityType,
} from '../lib/activityType';
import { queueBackfillLegacyActivityTypes } from './chatStoreLegacy';
import type { ChatState, Message, MoodDescription, YesterdaySummary } from './useChatStore.types';
export type { ChatState, Message, MoodDescription, YesterdaySummary } from './useChatStore.types';
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
      activeViewDateStr: null,
      dateCache: new Map(),
      fetchMessages: async () => {
        const session = await getSupabaseSession();
        if (!session) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayStartMs = todayStart.getTime();
          set(state => ({
            messages: state.messages.filter(m => m.timestamp >= todayStartMs),
            hasInitialized: true,
          }));
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

          queueBackfillLegacyActivityTypes(todayData || [], session.user.id);
          const messages = (todayData || []).map(mapDbRowToMessage);

          // Ensure all completed events have at least an auto-detected mood label
          const moodStoreToday = useMoodStore.getState();
          for (const msg of messages) {
            if (msg.mode === 'record' && !msg.isMood && msg.duration != null && !moodStoreToday.getMood(msg.id)) {
              moodStoreToday.setMood(msg.id, autoDetectMood(msg.content, msg.duration ?? 0), 'auto');
            }
          }

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
            activeViewDateStr: todayStr,
            dateCache: new Map(get().dateCache).set(todayStr, messages),
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
          import.meta.env.DEV && console.log('[DayRefresh] Midnight crossed, refreshing messages...');
          state.fetchMessages();
        }
      },

      fetchMessagesByDate: async (dateStr: string) => {
        const cached = get().dateCache.get(dateStr);
        if (cached) {
          set({ messages: cached, activeViewDateStr: dateStr });
          return;
        }
        const session = await getSupabaseSession();
        if (!session) return;

        const dayStart = new Date(dateStr + 'T00:00:00').getTime();
        const dayEnd = new Date(dateStr + 'T23:59:59.999').getTime();

        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('user_id', session.user.id)
          .gte('timestamp', dayStart)
          .lte('timestamp', dayEnd)
          .order('timestamp', { ascending: true });

        if (error) {
          import.meta.env.DEV && console.log('[fetchMessagesByDate] error', error);
          return;
        }
        queueBackfillLegacyActivityTypes(data || [], session.user.id);
        const msgs = (data || []).map(mapDbRowToMessage);

        // Ensure all completed events have at least an auto-detected mood label
        const moodStoreDate = useMoodStore.getState();
        for (const msg of msgs) {
          if (msg.mode === 'record' && !msg.isMood && msg.duration != null && !moodStoreDate.getMood(msg.id)) {
            moodStoreDate.setMood(msg.id, autoDetectMood(msg.content, msg.duration ?? 0), 'auto');
          }
        }

        set(state => ({
          messages: msgs,
          activeViewDateStr: dateStr,
          dateCache: new Map(state.dateCache).set(dateStr, msgs),
        }));
      },

      sendMessage: async (
        content: string,
        customTimestamp?: number,
        forcedMode?: 'chat' | 'record',
        options?: { skipMoodDetection?: boolean; activityTypeOverride?: ActivityRecordType },
      ) => {
        const now = customTimestamp ?? Date.now();
        const state = get();
        const effectiveMode = forcedMode ?? state.mode;
        let updatedMessages = [...state.messages];

        if (effectiveMode === 'record') {
          updatedMessages = await closePreviousActivity(updatedMessages, now);
        }

        const classifiedByRule = effectiveMode === 'record' && !options?.activityTypeOverride
          ? classifyRecordActivityType(content)
          : null;

        const newMessage: Message = {
          id: uuidv4(),
          content,
          timestamp: now,
          type: 'text',
          mode: effectiveMode,
          activityType: effectiveMode === 'record'
            ? (options?.activityTypeOverride ?? classifiedByRule?.activityType ?? 'life')
            : 'chat',
          isActive: effectiveMode === 'record' ? true : undefined,
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

        if (
          effectiveMode === 'record'
          && !options?.activityTypeOverride
          && classifiedByRule?.confidence === 'low'
        ) {
          void (async () => {
            try {
              const aiResult = await callClassifierAPI({
                rawInput: `${content} 30分钟`,
              });
              const aiCategory = aiResult.data?.items?.[0]?.category;
              if (!aiCategory) {
                return;
              }
              const refinedType = mapClassifierCategoryToActivityType(aiCategory, content);
              set((currentState) => ({
                messages: currentState.messages.map((item) => (
                  item.id === newMessage.id ? { ...item, activityType: refinedType } : item
                )),
              }));
              const latestSession = await getSupabaseSession();
              if (latestSession) {
                await supabase
                  .from('messages')
                  .update({ activity_type: refinedType })
                  .eq('id', newMessage.id)
                  .eq('user_id', latestSession.user.id);
              }
            } catch {
              return;
            }
          })();
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
              ? {
                ...m,
                content,
                timestamp: startTime,
                duration,
                activityType: m.mode === 'record' && !m.isMood
                  ? classifyRecordActivityType(content).activityType
                  : m.activityType,
              }
              : m
          ).sort((a, b) => a.timestamp - b.timestamp)
        }));

        const session = await getSupabaseSession();
        if (session) {
          await supabase.from('messages').update({
            content,
            timestamp: startTime,
            duration,
            activity_type: classifyRecordActivityType(content).activityType,
          }).eq('id', id).eq('user_id', session.user.id);
        }

        const moodStore = useMoodStore.getState();
        const moodMeta = moodStore.activityMoodMeta[id];
        const isCustomApplied = moodStore.customMoodApplied[id] === true;
        if (moodMeta?.source === 'auto' && !isCustomApplied) {
          moodStore.setMood(id, autoDetectMood(content, duration), 'auto');
        }
      },

      endActivity: async (id, opts) => {
        const state = get();
        const target = state.messages.find(m => m.id === id);
        if (!target || target.duration !== undefined) return;

        const duration = Math.max(0, Math.round((Date.now() - target.timestamp) / (1000 * 60)));

        set(state => ({
          messages: state.messages.map(m =>
            m.id === id ? { ...m, duration, isActive: false } : m
          )
        }));

        const session = await getSupabaseSession();
        if (session) {
          await supabase.from('messages').update({ duration, is_active: false }).eq('id', id).eq('user_id', session.user.id);
        }

        const moodStore = useMoodStore.getState();
        if (!moodStore.getMood(id)) {
          moodStore.setMood(id, autoDetectMood(target.content, duration));
        }

        useTodoStore.getState().completeTodoByMessage(id);
        if (opts?.skipBottleStar) return;
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
          return;
        }
        set({ messages: updatedMessages });
        const session = await getSupabaseSession();
        if (session) {
          await persistMessageDurationUpdate(session.user.id, targetMessage.id, duration);
        }
      },

      updateMessageImage: async (id, slot, url) => {
        const dbCol = slot === 'imageUrl' ? 'image_url' : 'image_url_2';
        set(state => ({
          messages: state.messages.map(m =>
            m.id === id ? { ...m, [slot]: url } : m,
          ),
        }));
        const session = await getSupabaseSession();
        if (session) {
          await supabase
            .from('messages')
            .update({ [dbCol]: url })
            .eq('id', id)
            .eq('user_id', session.user.id);
        }
      },

      detachMoodMessage: async (moodId: string) => {
        const parentId = get().messages.find(m => m.moodDescriptions?.some(d => d.id === moodId))?.id;
        get().detachMoodFromEvent(parentId ?? '', moodId); // state: detached:true + remove from moodDescriptions
        const session = await getSupabaseSession();
        if (!session) return;
        const mood = get().messages.find(m => m.id === moodId);
        if (mood) await persistMessageToSupabase(mood, session.user.id, true);
        if (parentId) {
          const parent = get().messages.find(m => m.id === parentId);
          if (parent) await persistMessageToSupabase(parent, session.user.id);
        }
      },

      sendMood: async (content: string, options?: { relatedActivityId?: string }) => {
        const now = Date.now();
        const relatedActivityId = options?.relatedActivityId;

        const newMessage: Message = {
          id: uuidv4(),
          content,
          timestamp: now,
          type: 'text',
          mode: 'record',
          activityType: 'mood',
          isMood: true,
          detached: false,
        };

        const { messages } = get();
        const latestEvent = [...messages]
          .filter(m => !m.isMood && m.mode === 'record')
          .sort((a, b) => b.timestamp - a.timestamp)[0];

        const { toLocalDateStr } = await import('../lib/dateUtils');
        const isCrossDay = !latestEvent ||
          toLocalDateStr(new Date(now)) !== toLocalDateStr(new Date(latestEvent.timestamp));

        set(state => {
          if (isCrossDay) {
            return { messages: [...state.messages, { ...newMessage, detached: true }] };
          }
          const newDesc: import('./useChatStore').MoodDescription = {
            id: newMessage.id,
            content,
            timestamp: now,
          };
          return {
            messages: state.messages
              .map(m =>
                m.id === latestEvent.id
                  ? { ...m, moodDescriptions: [...(m.moodDescriptions || []), newDesc] }
                  : m,
              )
              .concat(newMessage),
          };
        });

        // 兼容旧有 relatedActivityId 逻辑
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
          data: { messageId: newMessage.id, mood: content },
        };
        annotationStore.triggerAnnotation(moodEvent).catch(console.error);

        const session = await getSupabaseSession();
        if (session) {
          await persistMessageToSupabase(newMessage, session.user.id, true);
          if (!isCrossDay && latestEvent) {
            const updated = get().messages.find(m => m.id === latestEvent.id);
            if (updated) await persistMessageToSupabase(updated, session.user.id);
          }
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

      detachMoodFromEvent: (eventId, moodMsgId) => {
        set(state => ({
          messages: state.messages.map(m => {
            if (m.id === eventId) {
              return {
                ...m,
                moodDescriptions: (m.moodDescriptions || []).filter(d => d.id !== moodMsgId),
              };
            }
            if (m.id === moodMsgId) return { ...m, detached: true };
            return m;
          }),
        }));
      },

      reattachMoodToEvent: (moodMsgId) => {
        const { messages } = get();
        const moodMsg = messages.find(m => m.id === moodMsgId && m.isMood);
        if (!moodMsg) return;
        const latestEvent = [...messages]
          .filter(m => !m.isMood && m.mode === 'record')
          .sort((a, b) => b.timestamp - a.timestamp)[0];
        if (!latestEvent) return;
        const newDesc: MoodDescription = {
          id: moodMsg.id, content: moodMsg.content, timestamp: moodMsg.timestamp,
        };
        set(state => ({
          messages: state.messages.map(m => {
            if (m.id === latestEvent.id) {
              return { ...m, moodDescriptions: [...(m.moodDescriptions || []), newDesc] };
            }
            if (m.id === moodMsgId) return { ...m, detached: false };
            return m;
          }),
        }));
      },

      convertMoodToEvent: async (moodMsgId) => {
        const currentMessages = get().messages;
        const latestRecordMessage = [...currentMessages]
          .filter(m => m.mode === 'record' && m.type === 'text')
          .sort((a, b) => b.timestamp - a.timestamp)[0];
        if (!latestRecordMessage || latestRecordMessage.id !== moodMsgId) {
          return;
        }
        const now = Date.now();
        const prevActive = currentMessages.find(m => m.isActive && !m.isMood) ?? null;

        set(state => ({
          messages: state.messages.map(m => {
            if (m.isActive && !m.isMood) {
              return { ...m, isActive: false, duration: Math.max(0, Math.round((now - m.timestamp) / 60000)) };
            }
            if (m.id === moodMsgId) {
              return {
                ...m,
                isMood: false,
                detached: false,
                isActive: true,
                activityType: classifyRecordActivityType(m.content).activityType,
              };
            }
            return m;
          }),
        }));

        if (prevActive) {
          const moodStore = useMoodStore.getState();
          const isCustomApplied = moodStore.customMoodApplied[prevActive.id];
          if (!isCustomApplied) {
            const duration = Math.max(0, Math.round((now - prevActive.timestamp) / 60000));
            moodStore.setMood(prevActive.id, autoDetectMood(prevActive.content, duration), 'auto');
          }
        }

        const newEvent = get().messages.find(m => m.id === moodMsgId);
        if (newEvent) {
          const moodStore = useMoodStore.getState();
          if (!moodStore.getMood(moodMsgId)) {
            void triggerMoodDetection(moodMsgId, newEvent.content);
          }
        }

        const session = await getSupabaseSession();
        if (session) {
          const updated = get().messages;
          for (const m of updated) {
            if (m.id === moodMsgId || (m.isActive === false && m.duration !== undefined)) {
              await persistMessageToSupabase(m, session.user.id);
            }
          }
        }
      },
    }),
    {
      name: 'chat-storage',
      // dateCache 是 Map，不能 JSON 序列化，排除持久化
      partialize: (state) => ({
        messages: state.messages,
        mode: state.mode,
        isMoodMode: state.isMoodMode,
        lastActivityTime: state.lastActivityTime,
        currentDateStr: state.currentDateStr,
        hasInitialized: state.hasInitialized,
      }),
    }
  )
);
