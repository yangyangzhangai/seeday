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
import { emitLiveInputCorrectionTelemetry, emitMembershipClassificationTelemetry } from '../services/input/liveInputTelemetryCloud';
import { getLocalDateString, mapDbRowToMessage } from './chatHelpers';
import { createChatTimelineActions } from './chatTimelineActions';
import { mergePersistedChatState, pruneDateCache } from './chatPersistenceHelpers';
import { useTodoStore } from './useTodoStore';
import { useGrowthStore } from './useGrowthStore';
import { useAuthStore } from './useAuthStore';
import { isLegacyChatActivityType, type ActivityRecordType } from '../lib/activityType';
import { buildTodoCompletionAnnotationPayload } from '../lib/todoCompletionAnnotation';
import { classifyRecordActivityType } from '../lib/activityType';
import { queueBackfillLegacyActivityTypes } from './chatStoreLegacy';
import { useTimingStore } from './useTimingStore';
import type { ChatState, Message, MoodDescription, YesterdaySummary } from './useChatStore.types';
export type { ChatState, Message, MoodDescription, YesterdaySummary } from './useChatStore.types';
import { finalizeCrossDayOngoingMessages, resolveAutoActivityDurationMinutes } from './chatDayBoundary';
import { createScopedJSONStorage } from './scopedPersistStorage';
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
import { useOutboxStore } from './useOutboxStore';
import { PERSIST_KEYS, LEGACY_PERSIST_KEYS } from './persistKeys';
import { readLegacyPersistedState } from './persistMigrationHelpers';
import { applyChatMessageSyncState, insertChatMessage, mergeCloudMessagesWithLocal } from './chatSyncHelpers';
import {
  clearMessageClassificationTasks,
  closeCrossDayActiveMessagesInDb,
  deleteMessageClassificationTask,
  ensureMessageClassification,
  keywordMatchBottleId,
  resolveCurrentLang,
  resolveLangForText,
} from './chatClassificationHelpers';

function filterLegacyChatRows<T extends { activity_type?: string | null }>(rows: T[]): T[] {
  return rows.filter((row) => !isLegacyChatActivityType(row.activity_type));
}
export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      lastActivityTime: null,
      lastFetchedAt: null,
      isMoodMode: false,
      isLoading: false,
      hasInitialized: false,
      oldestLoadedDate: null,
      hasMoreHistory: true,
      isLoadingMore: false,
      yesterdaySummary: null,
      currentDateStr: null,
      activeViewDateStr: null,
      dateCache: {},
      fetchMessages: async () => {
        const session = await getSupabaseSession();
        if (!session) {
          const nowMs = Date.now();
          const { messages: finalizedMessages } = finalizeCrossDayOngoingMessages(
            get().messages.filter((m) => !isLegacyChatActivityType(m.activityType)),
            nowMs,
          );
          set({
            messages: finalizedMessages,
            currentDateStr: getLocalDateString(new Date(nowMs)),
            hasInitialized: true,
          });
          return;
        }

        // Only block UI with skeleton on truly first load (no persisted data yet).
        // Background sync after cold-start should show local data immediately.
        if (!get().hasInitialized) {
          set({ isLoading: true });
        }
        try {
          const nowMs = Date.now();
          try {
            await closeCrossDayActiveMessagesInDb(session.user.id, nowMs);
          } catch (closeError) {
            console.warn('[fetchMessages] closeCrossDayActiveMessagesInDb failed, continue fetching:', closeError);
          }

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

          const { mergedMessages } = mergeCloudMessagesWithLocal(messages, get().messages);

          const prunedCache = pruneDateCache({ ...get().dateCache, [todayStr]: mergedMessages });
          set({
            messages: mergedMessages,
            lastFetchedAt: Date.now(),
            oldestLoadedDate: todayStr,
            hasMoreHistory: !!yesterdaySummary,
            yesterdaySummary,
            currentDateStr: todayStr,
            activeViewDateStr: get().activeViewDateStr ?? todayStr,
            dateCache: prunedCache,
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
        const nowMs = Date.now();
        const state = get();
        const { messages: finalizedMessages, finalized } = finalizeCrossDayOngoingMessages(state.messages, nowMs);
        if (finalized.length > 0) {
          set({ messages: finalizedMessages });
        }

        const todayStr = getLocalDateString(new Date(nowMs));
        if (!state.currentDateStr || state.currentDateStr !== todayStr) {
          // 只在用户当前看的是今天（或尚未初始化）时才 reset 到今天
          // 避免用户正在看历史日期时被强制跳回今天
          const userOnHistorical = state.activeViewDateStr != null && state.activeViewDateStr !== state.currentDateStr;
          if (userOnHistorical) return;
          import.meta.env.DEV && console.log('[DayRefresh] Midnight crossed, refreshing messages...');
          void state.fetchMessages();
        }
      },

      fetchMessagesByDate: async (dateStr: string) => {
        // 本地有缓存 → 立即渲染，同时后台拉云端
        const cached = get().dateCache[dateStr];
        if (cached && cached.length > 0) {
          set({ messages: cached, activeViewDateStr: dateStr });
          void get()._refreshDateSilently(dateStr);
          return;
        }

        // 本地无缓存 → 先清空当前视图，再等云端（避免 Supabase 失败时残留其他日期数据）
        set({ messages: [], activeViewDateStr: dateStr });

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

        const moodStoreDate = useMoodStore.getState();
        for (const msg of msgs) {
          if (msg.mode === 'record' && !msg.isMood && msg.duration != null && !moodStoreDate.getMood(msg.id)) {
            moodStoreDate.setMood(msg.id, autoDetectMood(msg.content, msg.duration ?? 0, resolveLangForText(msg.content)), 'auto');
          }
        }

        set(state => ({
          messages: msgs,
          activeViewDateStr: dateStr,
          dateCache: pruneDateCache({ ...state.dateCache, [dateStr]: msgs }),
        }));
      },

      /** 后台静默拉云端数据，合并后有差异才更新缓存和视图 */
      _refreshDateSilently: async (dateStr: string) => {
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

        if (error) return;

        queueBackfillLegacyActivityTypes(data || [], session.user.id);
        const cloudMsgs = filterLegacyChatRows(data || []).map(mapDbRowToMessage);
        const localMsgs = get().dateCache[dateStr] ?? [];
        const { mergedMessages, changed } = mergeCloudMessagesWithLocal(cloudMsgs, localMsgs);

        if (!changed) return;

        const moodStoreDate = useMoodStore.getState();
        for (const msg of mergedMessages) {
          if (msg.mode === 'record' && !msg.isMood && msg.duration != null && !moodStoreDate.getMood(msg.id)) {
            moodStoreDate.setMood(msg.id, autoDetectMood(msg.content, msg.duration ?? 0, resolveLangForText(msg.content)), 'auto');
          }
        }

        set(state => ({
          messages: state.activeViewDateStr === dateStr ? mergedMessages : state.messages,
          dateCache: pruneDateCache({ ...state.dateCache, [dateStr]: mergedMessages }),
        }));
      },

      loadMessagesForDateRange: async (start: Date, end: Date) => {
        const msgs = await get().getMessagesForDateRange(start, end);
        const dateStr = getLocalDateString(start);
        set(state => ({ dateCache: { ...state.dateCache, [dateStr]: msgs } }));
      },

      getMessagesForDateRange: async (start: Date, end: Date) => {
        const dateStr = getLocalDateString(start);
        // Only use single-day cache when the requested range is ≤ 1 day.
        // A month-range query (DiaryBookViewer) must not be poisoned by a prior
        // single-day cache entry stored under the same start-date key.
        const rangeIsOneDay = end.getTime() - start.getTime() <= 24 * 60 * 60 * 1000 + 1;
        const cached = rangeIsOneDay ? get().dateCache[dateStr] : undefined;
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
        options?: {
          skipMoodDetection?: boolean;
          skipAnnotation?: boolean;
          activityTypeOverride?: ActivityRecordType;
          annotationEventType?: AnnotationEvent['type'];
          annotationEventData?: AnnotationEvent['data'];
        },
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
          syncState: 'pending',
          syncError: null,
        };

        updatedMessages.push(newMessage);

        set((state) => ({
          ...insertChatMessage(state as ChatState, newMessage),
          messages: updatedMessages,
          lastActivityTime: now,
        }));

        void (async () => {
          const session = await getSupabaseSession();
          if (!session) {
            useOutboxStore.getState().enqueue({
              kind: 'chat.upsert',
              payload: { message: newMessage },
            });
            return;
          }
          await persistMessageToSupabase(newMessage, session.user.id);
          set((state) => applyChatMessageSyncState(state as ChatState, newMessage.id, 'synced', null));
          // 用户主动输入 → 结束当前 active 计时 session（§4.6.2）
          void useTimingStore.getState().endActive(session.user.id);
        })().catch((error) => {
          useOutboxStore.getState().enqueue({
            kind: 'chat.upsert',
            payload: { message: newMessage },
          });
          set((state) => applyChatMessageSyncState(
            state as ChatState,
            newMessage.id,
            'pending',
            error instanceof Error ? error.message : 'chat_sync_pending',
          ));
          if (import.meta.env.DEV) {
            console.warn('[sendMessage] background sync skipped:', error);
          }
        });

        if (!options?.skipMoodDetection) {
          void triggerMoodDetection(newMessage.id, content, 'auto', resolveCurrentLang());
        }

        if (!options?.activityTypeOverride) {
          const isPlus = useAuthStore.getState().isPlus;
          const growthStore = useGrowthStore.getState();
          const activeBottles = growthStore.bottles.filter((b) => b.status === 'active');
          const habits = activeBottles
            .filter((b) => b.type === 'habit')
            .map((b) => ({ id: b.id, name: b.name }));
          const goals = activeBottles
            .filter((b) => b.type === 'goal')
            .map((b) => ({ id: b.id, name: b.name }));
          const lang = resolveLangForText(content);

          void ensureMessageClassification({
            messageId: newMessage.id,
            content,
            lang,
            isPlus,
            habits,
            goals,
          }).then(async (classification) => {
            set((currentState) => ({
              messages: currentState.messages.map((item) => (
                item.id === newMessage.id
                  ? { ...item, activityType: classification.activityType }
                  : item
              )),
            }));
            if (classification.moodType) {
              const moodStore = useMoodStore.getState();
              const meta = moodStore.activityMoodMeta[newMessage.id];
              const hasManualMood = moodStore.customMoodApplied[newMessage.id] === true || meta?.source === 'manual';
              if (!hasManualMood) {
                moodStore.setMood(newMessage.id, classification.moodType, 'auto');
              }
            }
            const latestSession = await getSupabaseSession();
            if (latestSession) {
              await supabase
                .from('messages')
                .update({ activity_type: classification.activityType })
                .eq('id', newMessage.id)
                .eq('user_id', latestSession.user.id);
            }
          }).catch(() => {
            return;
          });
        }
        // 触发 AI 批注
        if (!options?.skipAnnotation) {
          const annotationStore = useAnnotationStore.getState();
          const recordEvent: AnnotationEvent = {
            type: options?.annotationEventType || 'activity_recorded',
            timestamp: Date.now(),
            data: {
              messageId: newMessage.id,
              content: newMessage.content,
              ...(options?.annotationEventData || {}),
            },
          };
          annotationStore.triggerAnnotation(recordEvent).catch(console.error);
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

        const duration = resolveAutoActivityDurationMinutes(target.timestamp, Date.now());

        set(state => ({
          messages: state.messages.map(m =>
            m.id === id ? { ...m, duration, isActive: false } : m
          )
        }));

        void getSupabaseSession().then((session) => {
          if (session) {
            void supabase.from('messages').update({ duration, is_active: false }).eq('id', id).eq('user_id', session.user.id);
          }
        });

        const moodStore = useMoodStore.getState();
        if (!moodStore.getMood(id)) {
          moodStore.setMood(id, autoDetectMood(target.content, duration, resolveLangForText(target.content)));
        }

        const todoStore = useTodoStore.getState();
        const completedTodo = todoStore.completeTodoByMessage(id);
        const optsTodo = opts?.todoId
          ? todoStore.todos.find((todo) => todo.id === opts.todoId) ?? null
          : null;
        const completionMappedTodoId = Object.entries(todoStore.todoCompletionMessageMap)
          .find(([, messageId]) => messageId === id)?.[0];
        const associatedTodo = optsTodo
          ?? completedTodo
          ?? (completionMappedTodoId
            ? todoStore.todos.find((todo) => todo.id === completionMappedTodoId) ?? null
            : null);
        if (completedTodo) {
          const growthStore = useGrowthStore.getState();
          const linkedBottle = completedTodo.bottleId
            ? growthStore.bottles.find((b) => b.id === completedTodo.bottleId)
            : null;
          const payload = buildTodoCompletionAnnotationPayload({
            todo: completedTodo,
            allTodos: todoStore.todos,
            now: Date.now(),
            bottleName: linkedBottle?.name,
          });
          const completionEvent: AnnotationEvent = {
            type: 'activity_completed',
            timestamp: Date.now(),
            data: {
              messageId: id,
              content: completedTodo.title,
              summary: payload.summary,
              todoCompletionContext: payload.context,
            },
          };
          useAnnotationStore.getState().triggerAnnotation(completionEvent).catch(console.error);
        }
        if (opts?.skipBottleStar) return;
        const growthStore = useGrowthStore.getState();
        const todoRewardStore = useTodoStore.getState();
        const grantBottleStars = (bottleId: string) => {
          const stars = useAnnotationStore.getState().consumeRecoveryBonusForCompletion({ bottleId });
          growthStore.incrementBottleStars(bottleId, stars);
          todoRewardStore.registerBottleStarReward({
            ...(associatedTodo?.id ? { todoId: associatedTodo.id } : {}),
            messageId: id,
            bottleId,
            stars,
          });
        };
        const linkedBottleId = associatedTodo?.bottleId;
        const activeBottles = growthStore.bottles.filter(b => b.status === 'active');
        const allActiveBottles = activeBottles.map((b) => ({ id: b.id, name: b.name }));
        const habits = activeBottles.filter(b => b.type === 'habit').map(b => ({ id: b.id, name: b.name }));
        const goals = activeBottles.filter(b => b.type === 'goal').map(b => ({ id: b.id, name: b.name }));
        const isPlus = useAuthStore.getState().isPlus;
        const trackMembership = (payload: Omit<Parameters<typeof emitMembershipClassificationTelemetry>[0], 'rawInput' | 'messageId' | 'userPlan'>) => emitMembershipClassificationTelemetry({
          rawInput: target.content,
          messageId: id,
          userPlan: isPlus ? 'plus' : 'free',
          ...payload,
        });
        if (linkedBottleId) {
          grantBottleStars(linkedBottleId);
          trackMembership({
            classificationPath: 'local_rule',
            aiCalled: false,
            aiResultKind: 'unknown',
            bottleMatchSource: 'todo_link',
          });
          return;
        }
        if (!isPlus) {
          const keywordMatchedBottleId = keywordMatchBottleId(target.content, allActiveBottles);
          if (keywordMatchedBottleId) {
            grantBottleStars(keywordMatchedBottleId);
          }
          trackMembership({
            classificationPath: 'local_rule',
            aiCalled: false,
            aiResultKind: 'unknown',
            bottleMatchSource: keywordMatchedBottleId ? 'keyword' : 'none',
          });
          return;
        }
        const lang = resolveLangForText(target.content);
        void ensureMessageClassification({
          messageId: id,
          content: target.content,
          lang,
          isPlus: true,
          habits,
          goals,
        }).then((classification) => {
          if (!get().messages.some((m) => m.id === id)) return;
          if (classification.matchedBottleId) {
            grantBottleStars(classification.matchedBottleId);
            trackMembership({
              classificationPath: classification.classificationPath,
              aiCalled: classification.aiCalled,
              aiResultKind: classification.kind,
              bottleMatchSource: 'ai',
            });
            return;
          }
          const keywordMatchedBottleId = keywordMatchBottleId(target.content, allActiveBottles);
          if (keywordMatchedBottleId) {
            grantBottleStars(keywordMatchedBottleId);
          }
          trackMembership({
            classificationPath: classification.classificationPath,
            aiCalled: classification.aiCalled,
            aiResultKind: classification.kind,
            bottleMatchSource: keywordMatchedBottleId ? 'keyword' : 'none',
          });
        }).catch(() => {
          const keywordMatchedBottleId = keywordMatchBottleId(target.content, allActiveBottles);
          if (keywordMatchedBottleId) {
            grantBottleStars(keywordMatchedBottleId);
          }
          trackMembership({
            classificationPath: 'ai_fallback_local',
            aiCalled: true,
            aiResultKind: 'unknown',
            bottleMatchSource: keywordMatchedBottleId ? 'keyword' : 'none',
          });
        });
      },

      deleteActivity: async (id) => {
        deleteMessageClassificationTask(id);
        const reward = useTodoStore.getState().consumeBottleStarRewardByMessage(id);
        if (reward) {
          useGrowthStore.getState().decrementBottleStars(reward.bottleId, reward.stars);
        }
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
          syncState: 'pending',
          syncError: null,
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
            const detachedMessage = { ...newMessage, detached: true };
            return {
              ...insertChatMessage(state as ChatState, detachedMessage),
              messages: [...state.messages, detachedMessage],
            };
          }
          const newDesc: MoodDescription = {
            id: newMessage.id,
            content,
            timestamp: now,
          };
          return {
            ...insertChatMessage(state as ChatState, newMessage),
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

        void (async () => {
          const session = await getSupabaseSession();
          if (!session) {
            useOutboxStore.getState().enqueue({
              kind: 'chat.upsert',
              payload: { message: isCrossDay ? { ...newMessage, detached: true } : newMessage },
            });
            return;
          }
          const moodMessageToPersist = get().messages.find((message) => message.id === newMessage.id)
            ?? (isCrossDay ? { ...newMessage, detached: true } : newMessage);
          await persistMessageToSupabase(moodMessageToPersist, session.user.id, true);
          set((state) => applyChatMessageSyncState(state as ChatState, newMessage.id, 'synced', null));
          if (!isCrossDay && latestEvent) {
            const updated = get().messages.find(m => m.id === latestEvent.id);
            if (updated) await persistMessageToSupabase(updated, session.user.id);
          }
        })().catch((error) => {
          useOutboxStore.getState().enqueue({
            kind: 'chat.upsert',
            payload: { message: isCrossDay ? { ...newMessage, detached: true } : newMessage },
          });
          set((state) => applyChatMessageSyncState(
            state as ChatState,
            newMessage.id,
            'pending',
            error instanceof Error ? error.message : 'chat_sync_pending',
          ));
          if (import.meta.env.DEV) {
            console.warn('[sendMood] background sync skipped:', error);
          }
        });

        return newMessage.id;
      },

      setHasInitialized: (value) => set({ hasInitialized: value }),
      clearHistory: async () => {
        clearMessageClassificationTasks();
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
      name: PERSIST_KEYS.chat,
      storage: createScopedJSONStorage<Partial<ChatState>>('chat'),
      skipHydration: true,
      merge: (persistedState, currentState) => {
        const legacyState = readLegacyPersistedState<ChatState>(LEGACY_PERSIST_KEYS.chat);
        return mergePersistedChatState(persistedState || legacyState, currentState as ChatState);
      },
      partialize: (state) => ({
        messages: state.messages,
        isMoodMode: state.isMoodMode,
        lastActivityTime: state.lastActivityTime,
        lastFetchedAt: state.lastFetchedAt,
        currentDateStr: state.currentDateStr,
        hasInitialized: state.hasInitialized,
        dateCache: state.dateCache,
      }),
    }
  )
);
