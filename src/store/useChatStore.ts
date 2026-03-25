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
import { emitLiveInputCorrectionTelemetry } from '../services/input/liveInputTelemetryCloud';
import { getLocalDateString, mapDbRowToMessage } from './chatHelpers';
import { createChatTimelineActions } from './chatTimelineActions';
import { useTodoStore } from './useTodoStore';
import { useGrowthStore } from './useGrowthStore';
import { callClassifierAPI } from '../api/client';
import i18n from '../i18n';
import { isLegacyChatActivityType, type ActivityRecordType } from '../lib/activityType';
import { buildClassifierRawInput } from '../lib/classifierRawInput';
import {
  classifyRecordActivityType,
} from '../lib/activityType';
import { mapDiaryClassifierCategoryToActivityType } from '../lib/categoryAdapters';
import type { SupportedLang } from '../services/input/lexicon/getLexicon';
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
  persistReclassifiedMessages,
  persistInsertedActivityResult,
  persistMessageDurationUpdate,
  persistMessageToSupabase,
  triggerMoodDetection,
} from './chatActions';

function resolveCurrentLang(): SupportedLang {
  const lang = i18n.language?.toLowerCase() ?? 'zh';
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('it')) return 'it';
  return 'zh';
}

function resolveLangForText(content: string): SupportedLang {
  if (/[\u3400-\u9fff]/.test(content)) return 'zh';
  const lowered = content.toLowerCase();
  if (/\b(sono|sto|stanco|stanca|felice|ansioso|ansiosa|sollevato|sollevata|sollievo|riunione|lezione|lavorando|studiando)\b/.test(lowered)) {
    return 'it';
  }
  if (/[A-Za-z\u00C0-\u017F]/.test(content)) return 'en';
  return resolveCurrentLang();
}

function filterLegacyChatRows<T extends { activity_type?: string | null }>(rows: T[]): T[] {
  return rows.filter((row) => !isLegacyChatActivityType(row.activity_type));
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
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
          set(state => ({
            messages: state.messages.filter(
              (m) => !isLegacyChatActivityType(m.activityType)
            ),
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
            .limit(50);

          if (latestBeforeTodayError) throw latestBeforeTodayError;

          queueBackfillLegacyActivityTypes(todayData || [], session.user.id);
          const runtimeTodayRows = filterLegacyChatRows(todayData || []);
          const messages = runtimeTodayRows.map(mapDbRowToMessage);

          // Ensure all completed events have at least an auto-detected mood label
          const moodStoreToday = useMoodStore.getState();
          for (const msg of messages) {
            if (msg.mode === 'record' && !msg.isMood && msg.duration != null && !moodStoreToday.getMood(msg.id)) {
              moodStoreToday.setMood(msg.id, autoDetectMood(msg.content, msg.duration ?? 0, resolveLangForText(msg.content)), 'auto');
            }
          }

          let yesterdaySummary: YesterdaySummary | null = null;
          const latestNonChatBeforeToday = filterLegacyChatRows(latestBeforeToday || [])[0];
          if (latestNonChatBeforeToday) {
            const latest = latestNonChatBeforeToday;
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

            const safePreviousDayData = filterLegacyChatRows(previousDayData || []);
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

          const olderMessages = filterLegacyChatRows(data || []).map(mapDbRowToMessage);

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
          set({ messages: cached, activeViewDateStr: dateStr, currentDateStr: dateStr });
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
        const msgs = filterLegacyChatRows(data || []).map(mapDbRowToMessage);

        // Ensure all completed events have at least an auto-detected mood label
        const moodStoreDate = useMoodStore.getState();
        for (const msg of msgs) {
          if (msg.mode === 'record' && !msg.isMood && msg.duration != null && !moodStoreDate.getMood(msg.id)) {
            moodStoreDate.setMood(msg.id, autoDetectMood(msg.content, msg.duration ?? 0, resolveLangForText(msg.content)), 'auto');
          }
        }

        set(state => ({
          messages: msgs,
          activeViewDateStr: dateStr,
          currentDateStr: dateStr,
          dateCache: new Map(state.dateCache).set(dateStr, msgs),
        }));
      },

      loadMessagesForDateRange: async (start: Date, end: Date) => {
        const msgs = await get().getMessagesForDateRange(start, end);
        const dateStr = getLocalDateString(start);
        set(state => {
          const newCache = new Map(state.dateCache);
          newCache.set(dateStr, msgs);
          return { dateCache: newCache };
        });
      },

      getMessagesForDateRange: async (start: Date, end: Date) => {
        const dateStr = getLocalDateString(start);
        const cached = get().dateCache.get(dateStr);
        if (cached) return cached;

        const session = await getSupabaseSession();
        if (!session) {
          return get().messages.filter(m => m.timestamp >= start.getTime() && m.timestamp <= end.getTime());
        }

        try {
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('user_id', session.user.id)
            .gte('timestamp', start.getTime())
            .lte('timestamp', end.getTime())
            .order('timestamp', { ascending: true });

          if (error) {
            import.meta.env.DEV && console.error('[getMessagesForDateRange] error', error);
            return [];
          }

          return filterLegacyChatRows(data || []).map(mapDbRowToMessage);
        } catch (e) {
          import.meta.env.DEV && console.error('[getMessagesForDateRange] network error', e);
          return [];
        }
      },

      sendMessage: async (
        content: string,
        customTimestamp?: number,
        options?: { skipMoodDetection?: boolean; activityTypeOverride?: ActivityRecordType },
      ) => {
        const now = customTimestamp ?? Date.now();
        let updatedMessages = [...get().messages];

        updatedMessages = await closePreviousActivity(updatedMessages, now);

        const classifiedByRule = !options?.activityTypeOverride
          ? classifyRecordActivityType(content, resolveLangForText(content))
          : null;

        const newMessage: Message = {
          id: uuidv4(),
          content,
          timestamp: now,
          type: 'text',
          mode: 'record',
          activityType: options?.activityTypeOverride ?? classifiedByRule?.activityType ?? 'life',
          isActive: true,
        };

        updatedMessages.push(newMessage);

        set({
          messages: updatedMessages,
          lastActivityTime: now,
        });

        const session = await getSupabaseSession();
        if (session) {
          await persistMessageToSupabase(newMessage, session.user.id);
        }

        if (!options?.skipMoodDetection) {
          void triggerMoodDetection(newMessage.id, content, 'auto', resolveCurrentLang());
        }

        if (
          !options?.activityTypeOverride
          && classifiedByRule?.confidence === 'low'
        ) {
          void (async () => {
            try {
              const lang = resolveLangForText(content);
              const aiResult = await callClassifierAPI({
                rawInput: buildClassifierRawInput(content, lang),
                lang,
              });
              const aiCategory = aiResult.data?.items?.[0]?.category;
              if (!aiCategory) {
                return;
              }
              const refinedType = mapDiaryClassifierCategoryToActivityType(aiCategory, content, lang);
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

        // 触发 AI 批注
        const annotationStore = useAnnotationStore.getState();

        const recordEvent: AnnotationEvent = {
          type: 'activity_recorded',
          timestamp: Date.now(),
          data: {
            messageId: newMessage.id,
            content: newMessage.content,
          },
        };
        annotationStore.triggerAnnotation(recordEvent).catch(console.error);

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
          emitLiveInputCorrectionTelemetry({
            rawInput: originalMessage.content,
            fromKind: originalMessage.isMood ? 'mood' : 'activity',
            toKind: nextKind,
            messageId,
          });
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
          resolveCurrentLang(),
        );

        set({ messages: finalMessages });
        const insertedPrimary = messagesToInsert[0];

        const session = await getSupabaseSession();
        if (session) {
          await persistInsertedActivityResult(session.user.id, messagesToInsert, messagesToUpdate);
        }

        if (insertedPrimary && !useMoodStore.getState().getMood(insertedPrimary.id)) {
          useMoodStore.getState().setMood(
            insertedPrimary.id,
            autoDetectMood(insertedPrimary.content, insertedPrimary.duration ?? 0, resolveLangForText(insertedPrimary.content)),
            'auto',
          );
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
                  ? classifyRecordActivityType(content, resolveLangForText(content)).activityType
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
            activity_type: classifyRecordActivityType(content, resolveLangForText(content)).activityType,
          }).eq('id', id).eq('user_id', session.user.id);
        }

        const moodStore = useMoodStore.getState();
        const moodMeta = moodStore.activityMoodMeta[id];
        const isCustomApplied = moodStore.customMoodApplied[id] === true;
        if (moodMeta?.source === 'auto' && !isCustomApplied) {
          moodStore.setMood(id, autoDetectMood(content, duration, resolveLangForText(content)), 'auto');
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
          moodStore.setMood(id, autoDetectMood(target.content, duration, resolveLangForText(target.content)));
        }

        useTodoStore.getState().completeTodoByMessage(id);
        if (opts?.skipBottleStar) return;
        const growthStore = useGrowthStore.getState();
        const activeBottles = growthStore.bottles.filter(b => b.status === 'active');
        const habits = activeBottles.filter(b => b.type === 'habit').map(b => ({ id: b.id, name: b.name }));
        const goals = activeBottles.filter(b => b.type === 'goal').map(b => ({ id: b.id, name: b.name }));

        if (habits.length > 0 || goals.length > 0) {
          const lang = resolveCurrentLang();

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
          const newDesc: MoodDescription = {
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
          }, resolveCurrentLang());
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
      ...createChatTimelineActions(set as never, get as never),
    }),
    {
      name: 'chat-storage',
      // dateCache 是 Map，不能 JSON 序列化，排除持久化
      partialize: (state) => ({
        messages: state.messages,
        isMoodMode: state.isMoodMode,
        lastActivityTime: state.lastActivityTime,
        currentDateStr: state.currentDateStr,
        hasInitialized: state.hasInitialized,
      }),
    }
  )
);
