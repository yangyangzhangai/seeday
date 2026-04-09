// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  AIAnnotation,
  AnnotationEvent,
  AnnotationEventType,
  AnnotationState,
  AnnotationSuggestion,
  PendingSuggestionIntent,
  TodayContextSnapshot,
  TodayActivity
} from '../types/annotation';
import { callAnnotationAPI } from '../api/client';
import { shouldGenerateAnnotation } from './annotationHelpers';
import { useMoodStore } from './useMoodStore';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import { fromDbAnnotation, toDbAnnotation } from '../lib/dbMappers';
import { normalizeActivityType } from '../lib/activityType';
import i18n from '../i18n';
import { getLocalDateString } from './chatHelpers';
import { useAuthStore } from './useAuthStore';
import { useTodoStore } from './useTodoStore';
import { useGrowthStore } from './useGrowthStore';
import { buildStatusSummary } from '../lib/buildStatusSummary';
import { detectSuggestionContextHints } from '../lib/suggestionDetector';
import { isExplicitSuggestionRequest } from '../lib/suggestionIntentDetector';
import { detectRecoveryNudge } from '../lib/recoverySuggestion';
import {
  createEmptyTodayContextSnapshot,
  detectTodayContextItems,
  extractTodayContextSourceText,
  mergeTodayContextSnapshot,
} from '../lib/todayContext';
import {
  buildCharacterState,
  createEmptyCharacterStateTracker,
  type CharacterStateTracker,
} from '../lib/characterState';

const MAX_TODAY_EVENTS = 400;

function toTimestampMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e11 ? value * 1000 : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return numeric < 1e11 ? numeric * 1000 : numeric;
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

function appendCappedEvent(events: AnnotationEvent[], event: AnnotationEvent): AnnotationEvent[] {
  const next = [...events, event];
  if (next.length <= MAX_TODAY_EVENTS) {
    return next;
  }
  return next.slice(next.length - MAX_TODAY_EVENTS);
}

interface AnnotationStore extends AnnotationState {
  // 内部状态（不持久化）
  lastAnnotationTime: number;

  // 历史批注（云端同步）
  annotations: AIAnnotation[];
  suggestionCountByPeriod: Record<'morning' | 'afternoon' | 'night', number>;
  dailySuggestionCount: number;
  lastWasSuggestion: boolean;
  lastSuggestionTime: number;
  consecutiveTextCount: number;
  suggestionOutcomes: Array<{ timestamp: number; accepted: boolean }>;
  recoverySuggestionAttempts: Array<{ date: string; key: string; timestamp: number }>;
  activeRecoveryBonus: {
    key: string;
    stars: number;
    todoId?: string;
    bottleId?: string;
    activatedAt: number;
    expiresAt: number;
  } | null;
  todayContextSnapshot: TodayContextSnapshot;
  characterStateTracker: CharacterStateTracker;
  pendingSuggestionIntent: PendingSuggestionIntent | null;

  // Actions
  triggerAnnotation: (event: AnnotationEvent) => Promise<void>;
  dismissAnnotation: () => void;
  recordSuggestionOutcome: (annotationId: string, accepted: boolean) => Promise<void>;
  resetDailyStats: () => void;
  updateConfig: (config: Partial<AnnotationState['config']>) => void;
  getAdaptiveMinInterval: () => number;
  getTodayStats: () => { activities: number; duration: number; events: AnnotationEvent[] };
  consumeRecoveryBonusForCompletion: (params: { todoId?: string; bottleId?: string }) => number;
  setPendingSuggestionIntent: (intent: PendingSuggestionIntent) => void;
  consumePendingSuggestionIntent: (params: {
    type: PendingSuggestionIntent['type'];
    maxAgeMs?: number;
  }) => PendingSuggestionIntent | null;

  // 云端同步
  fetchAnnotations: () => Promise<void>;
  syncLocalAnnotations: (userId: string) => Promise<void>;
}

/**
 * 获取今日日期字符串 YYYY-MM-DD
 */
function getTodayString(): string {
  return getLocalDateString(new Date());
}

/**
 * 检查是否需要重置每日统计
 */
export function shouldResetStats(lastDate: string): boolean {
  return lastDate !== getTodayString();
}

export function getSuggestionPeriod(hour: number): 'morning' | 'afternoon' | 'night' {
  if (hour >= 6 && hour < 13) return 'morning';
  if (hour >= 13 && hour < 19) return 'afternoon';
  return 'night';
}

function isSuggestionEligibleEvent(eventType: AnnotationEventType): boolean {
  return eventType === 'activity_completed'
    || eventType === 'activity_recorded'
    || eventType === 'mood_recorded'
    || eventType === 'idle_detected'
    || eventType === 'overwork_detected';
}

function extractEventTextForSuggestionIntent(event: AnnotationEvent): string {
  return String(event.data?.content || event.data?.mood || '').trim();
}

export const useAnnotationStore = create<AnnotationStore>()(
  persist(
    (set, get) => ({
      currentAnnotation: null,
      annotations: [],
      suggestionCountByPeriod: { morning: 0, afternoon: 0, night: 0 },
      dailySuggestionCount: 0,
      lastWasSuggestion: false,
      lastSuggestionTime: 0,
      consecutiveTextCount: 0,
      suggestionOutcomes: [],
      recoverySuggestionAttempts: [],
      activeRecoveryBonus: null,
      todayContextSnapshot: createEmptyTodayContextSnapshot(new Date()),
      characterStateTracker: createEmptyCharacterStateTracker(),
      pendingSuggestionIntent: null,

      todayStats: {
        date: getTodayString(),
        speakCount: 0,
        lastSpeakTime: 0,
        events: [],
      },

      config: {
        dailyLimit: 5,
        enabled: true,
        dropRate: 'low',
      },

      // 跟踪最后一次批注生成时间（防止重复触发）
      lastAnnotationTime: 0,

      /**
       * 触发批注检查
       * 根据事件类型和当前状态决定是否生成批注
       */
      triggerAnnotation: async (event: AnnotationEvent) => {
        const state = get();
        const { config, todayStats } = state;
        const { aiMode, aiModeEnabled } = useAuthStore.getState().preferences;

        // 检查是否启用
        if (!aiModeEnabled) {
          if (get().currentAnnotation) {
            set({ currentAnnotation: null });
          }
          console.log('[AI Annotator] AI 已关闭，跳过批注:', event.type);
          return;
        }

        if (!config.enabled) {
          console.log('[AI Annotator] 批注配置已关闭，跳过批注:', event.type);
          return;
        }

        const now = Date.now();
        const nowDate = new Date(now);
        const todayContextIncoming = detectTodayContextItems(extractTodayContextSourceText(event), nowDate);
        const nextTodayContextSnapshot = mergeTodayContextSnapshot(
          get().todayContextSnapshot,
          todayContextIncoming,
          nowDate,
        );

        // 检查是否需要重置每日统计
        if (shouldResetStats(todayStats.date)) {
          set({
            todayStats: {
              date: getTodayString(),
              speakCount: 0,
              lastSpeakTime: 0,
              events: appendCappedEvent([], event),
            },
            suggestionCountByPeriod: { morning: 0, afternoon: 0, night: 0 },
            dailySuggestionCount: 0,
            lastWasSuggestion: false,
            lastSuggestionTime: 0,
            consecutiveTextCount: 0,
            recoverySuggestionAttempts: [],
            todayContextSnapshot: nextTodayContextSnapshot,
          });
        } else {
          // 记录事件
          set({
            todayStats: {
              ...todayStats,
              events: appendCappedEvent(todayStats.events, event),
            },
            todayContextSnapshot: nextTodayContextSnapshot,
          });
        }

        // 检查是否应该生成批注
        const explicitSuggestionRequest = isSuggestionEligibleEvent(event.type)
          && isExplicitSuggestionRequest(extractEventTextForSuggestionIntent(event));

        const shouldGenerate = shouldGenerateAnnotation(
          event,
          get().todayStats,
          config
        );

        if (!shouldGenerate && !explicitSuggestionRequest) {
          console.log('[AI Annotator] 批注未触发:', event.type, '- 条件不满足');
          return;
        }

        console.log('[AI Annotator] 批注触发:', event.type);

        try {
          // 准备用户上下文
          const todayEvents = get().todayStats.events;
          const activities = todayEvents.filter(e =>
            e.type === 'activity_completed' || e.type === 'activity_recorded'
          );
          const totalDuration = activities.reduce((sum, e) =>
            sum + (e.data?.duration || 0), 0
          );

          // 连续心情输入：收集本轮次从第一条心情开始的完整对话（用户输入+AI回复）
          const recentMoodMessages: string[] = [];
          const moodConversationHistory: Array<{ role: 'user' | 'ai'; content: string }> = [];
          if (event.type === 'mood_recorded') {
            const sessionEvents: AnnotationEvent[] = [];
            for (let i = todayEvents.length - 1; i >= 0; i--) {
              const e = todayEvents[i];
              if (e.type === 'mood_recorded' || e.type === 'annotation_generated') {
                sessionEvents.unshift(e);
              } else {
                break;
              }
            }
            for (const e of sessionEvents) {
              if (e.type === 'mood_recorded') {
                const moodText = String(e.data?.mood || '').trim();
                if (moodText) {
                  recentMoodMessages.push(moodText);
                  moodConversationHistory.push({ role: 'user', content: moodText });
                }
              } else if (e.type === 'annotation_generated') {
                const annotationText = String(e.data?.content || '').trim();
                if (annotationText) {
                  moodConversationHistory.push({ role: 'ai', content: annotationText });
                }
              }
            }
          }

          const moodStore = useMoodStore.getState();
          const customLabelDefault = i18n.t('chat_custom_label_default');
          const getMoodLabelByMessageId = (messageId?: string): string | undefined => {
            if (!messageId) return undefined;

            const customLabel = moodStore.customMoodLabel[messageId];
            const isCustomApplied = moodStore.customMoodApplied[messageId] === true;
            if (
              isCustomApplied &&
              customLabel &&
              customLabel !== customLabelDefault &&
              customLabel !== '自定义'
            ) {
              return customLabel;
            }

            return moodStore.activityMood[messageId];
          };

          // 构建今日活动详细列表
          const todayActivitiesList = activities.map(e => ({
            content: e.data?.content || '未命名活动',
            duration: e.data?.duration || 0,
            activityType: normalizeActivityType(e.data?.activityType, e.data?.content),
            moodLabel: getMoodLabelByMessageId(e.data?.messageId),
            timestamp: e.timestamp,
            completed: e.type === 'activity_completed'
          }));

          const pendingTodos = useTodoStore.getState().todos
            .filter(t => !t.completed && !t.isTemplate)
            .map((t) => {
              const createdAtMs = toTimestampMs(t.createdAt) ?? now;
              const dueAtMs = toTimestampMs(t.dueAt) ?? undefined;
              const ageDays = Math.max(0, Math.floor((now - createdAtMs) / (24 * 60 * 60 * 1000)));
              return {
                id: t.id,
                title: t.title,
                category: t.category,
                dueAt: dueAtMs,
                bottleId: t.bottleId,
                createdAt: createdAtMs,
                ageDays,
              };
            });

          const currentDate = {
            year: nowDate.getFullYear(),
            month: nowDate.getMonth() + 1,
            day: nowDate.getDate(),
            weekday: nowDate.getDay(),
            weekdayName: nowDate.toLocaleDateString('en-US', { weekday: 'long' }),
            isoDate: getLocalDateString(nowDate),
          };

          const nowDateKey = getLocalDateString(nowDate);
          const authUser = useAuthStore.getState().user;
          const metadataCountryCode = authUser?.user_metadata?.country_code;
          const countryCode = typeof metadataCountryCode === 'string' ? metadataCountryCode.toUpperCase() : undefined;
          const metadataLatitude = authUser?.user_metadata?.latitude;
          const metadataLongitude = authUser?.user_metadata?.longitude;
          const latitude = Number.isFinite(Number(metadataLatitude)) ? Number(metadataLatitude) : undefined;
          const longitude = Number.isFinite(Number(metadataLongitude)) ? Number(metadataLongitude) : undefined;
          const attemptsToday = get().recoverySuggestionAttempts
            .filter((item) => item.date === nowDateKey)
            .map((item) => ({ key: item.key, timestamp: item.timestamp }));

          const recoveryNudge = detectRecoveryNudge({
            now: nowDate,
            todos: useTodoStore.getState().todos,
            bottles: useGrowthStore.getState().bottles,
            attemptsToday,
          });

          const period = getSuggestionPeriod(nowDate.getHours());
          const adaptiveMinInterval = get().getAdaptiveMinInterval();
          const canAttemptSuggestion = explicitSuggestionRequest
            || Boolean(recoveryNudge)
            || (
              isSuggestionEligibleEvent(event.type)
              && get().dailySuggestionCount < 4
              && get().suggestionCountByPeriod[period] < 2
              && !get().lastWasSuggestion
              && (Date.now() - get().lastSuggestionTime >= adaptiveMinInterval)
            );

          const { statusSummary, frequentActivities } = buildStatusSummary({
            now: nowDate,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            todayActivities: todayActivitiesList,
            pendingTodos,
            recentMoodMessages,
          });

          const contextHints = detectSuggestionContextHints({
            now: nowDate,
            todayActivities: todayActivitiesList,
            pendingTodos,
            recentMoodMessages,
          });

          const characterStateEnabled = String(import.meta.env.VITE_ANNOTATION_CHARACTER_STATE_ENABLED ?? 'true') === 'true';
          const behaviorSourceText = `${String(event.data?.content || '')} ${String(event.data?.mood || '')}`.trim();
          const characterStateResult = characterStateEnabled
            ? buildCharacterState({
              text: behaviorSourceText,
              durationMinutes: typeof event.data?.duration === 'number' ? event.data.duration : undefined,
              aiMode,
              now: nowDate,
              tracker: get().characterStateTracker,
            })
            : null;

          if (characterStateResult) {
            set({ characterStateTracker: characterStateResult.tracker });
          }

          // 调用 AI 生成批注 (通过 Serverless Function)
          const recentAnnotations = get().annotations.slice(-5).map(a => a.content);
          const response = await callAnnotationAPI({
            eventType: event.type,
            eventData: event.data,
            userContext: {
              todayActivities: activities.length,
              todayDuration: totalDuration,
              currentHour: nowDate.getHours(),
              currentMinute: nowDate.getMinutes(),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              currentDate,
              countryCode,
              latitude,
              longitude,
              recentAnnotations,
              recentMoodMessages,
              moodConversationHistory,
              todayActivitiesList,
              pendingTodos,
              statusSummary,
              contextHints,
              frequentActivities,
              todayContext: get().todayContextSnapshot.items.length > 0
                ? get().todayContextSnapshot
                : undefined,
              characterStateText: characterStateResult?.text || undefined,
              characterStateMeta: characterStateResult?.meta,
              allowSuggestion: canAttemptSuggestion,
              forceSuggestion: explicitSuggestionRequest || Boolean(recoveryNudge),
              consecutiveTextCount: get().consecutiveTextCount,
              recoveryNudge: recoveryNudge || undefined,
            },
            lang: (i18n.language?.split('-')[0] || 'en') as 'zh' | 'en' | 'it',
            aiMode,
          });
          const debugAiMode = response.debugAiMode || aiMode;
          console.log('[AI Annotator] 本次批注人设:', debugAiMode || 'unknown');

          // 先创建 id，后续同步需要
          const annotationId = uuidv4();

          // 创建批注对象
          const suggestion: AnnotationSuggestion | undefined = response.suggestion
            ? {
                type: response.suggestion.type,
                actionLabel: response.suggestion.actionLabel,
                activityName: response.suggestion.activityName,
                todoId: response.suggestion.todoId,
                todoTitle: response.suggestion.todoTitle,
                rewardStars: response.suggestion.rewardStars,
                rewardBottleId: response.suggestion.rewardBottleId,
                recoveryKey: response.suggestion.recoveryKey,
                decomposeReady: response.suggestion.decomposeReady,
                decomposeSourceTodoId: response.suggestion.decomposeSourceTodoId,
                decomposeSteps: response.suggestion.decomposeSteps,
              }
            : undefined;

          const annotation: AIAnnotation = {
            id: annotationId,
            content: response.content,
            tone: response.tone,
            timestamp: Date.now(),
            relatedEvent: event,
            todayContext: get().todayContextSnapshot.items.length > 0
              ? get().todayContextSnapshot
              : undefined,
            displayDuration: response.displayDuration,
            syncedToCloud: false,
            suggestion,
            suggestionAccepted: undefined,
          };

          const generatedEvent: AnnotationEvent = {
            type: 'annotation_generated' as AnnotationEventType,
            timestamp: Date.now(),
            data: { content: response.content, id: annotationId, tone: response.tone },
          };

          // 更新状态
          const isSuggestionOutput = Boolean(suggestion);
          const outputPeriod = getSuggestionPeriod(nowDate.getHours());
          const nextPeriodCounts = isSuggestionOutput
            ? {
                ...get().suggestionCountByPeriod,
                [outputPeriod]: get().suggestionCountByPeriod[outputPeriod] + 1,
              }
            : get().suggestionCountByPeriod;

          set({
            currentAnnotation: annotation,
            annotations: [...get().annotations, annotation],
            todayStats: {
              ...get().todayStats,
              speakCount: get().todayStats.speakCount + 1,
              lastSpeakTime: Date.now(),
              events: appendCappedEvent(get().todayStats.events, generatedEvent),
            },
            suggestionCountByPeriod: nextPeriodCounts,
            dailySuggestionCount: isSuggestionOutput
              ? get().dailySuggestionCount + 1
              : get().dailySuggestionCount,
            lastWasSuggestion: isSuggestionOutput,
            lastSuggestionTime: isSuggestionOutput ? Date.now() : get().lastSuggestionTime,
            consecutiveTextCount: isSuggestionOutput ? 0 : get().consecutiveTextCount + 1,
            recoverySuggestionAttempts: suggestion?.recoveryKey
              ? [
                ...get().recoverySuggestionAttempts,
                {
                  date: nowDateKey,
                  key: suggestion.recoveryKey,
                  timestamp: now,
                },
              ].slice(-300)
              : get().recoverySuggestionAttempts,
            characterStateTracker: characterStateResult?.tracker || get().characterStateTracker,
          });

          // 异步同步到云端
          const session = await getSupabaseSession();
          if (session) {
            const { error: insertError } = await supabase
              .from('annotations')
              .insert([toDbAnnotation(annotation, session.user.id)]);
            if (insertError) {
              console.error('[Annotation] 云端同步失败:', insertError);
            } else {
              set({
                annotations: get().annotations.map((item) =>
                  item.id === annotationId ? { ...item, syncedToCloud: true } : item
                ),
              });
            }
          }

          if (response.source === 'default') {
            console.warn(
              '[AI Annotator] 批注使用兜底:',
              `event=${event.type}`,
              `aiMode=${debugAiMode || 'fallback'}`,
              `reason=${response.reason || 'unknown'}`,
              `source=${response.source}`,
              `content=${response.content}`
            );
          } else {
            console.log('[AI Annotator] 批注已生成(AI):', response.content);
          }
        } catch (error) {
          console.error('[AI Annotator] 生成批注失败:', error);
        }
      },

      /**
       * 关闭当前批注
       */
      dismissAnnotation: () => {
        set({ currentAnnotation: null });
      },

      recordSuggestionOutcome: async (annotationId: string, accepted: boolean) => {
        const annotation = get().annotations.find((item) => item.id === annotationId);
        if (!annotation || !annotation.suggestion) return;

        if (annotation.suggestionAccepted === accepted) return;

        const bonusStars = Number(annotation.suggestion.rewardStars || 0);
        const canActivateBonus = accepted
          && bonusStars > 1
          && (annotation.suggestion.todoId || annotation.suggestion.rewardBottleId);
        const endOfToday = (() => {
          const end = new Date();
          end.setHours(23, 59, 59, 999);
          return end.getTime();
        })();

        set({
          annotations: get().annotations.map((item) => (
            item.id === annotationId ? { ...item, suggestionAccepted: accepted } : item
          )),
          currentAnnotation: get().currentAnnotation?.id === annotationId
            ? { ...get().currentAnnotation, suggestionAccepted: accepted }
            : get().currentAnnotation,
          suggestionOutcomes: [
            ...get().suggestionOutcomes,
            { timestamp: Date.now(), accepted },
          ].slice(-200),
          activeRecoveryBonus: canActivateBonus
            ? {
              key: annotation.suggestion.recoveryKey || annotationId,
              stars: Math.floor(bonusStars),
              todoId: annotation.suggestion.todoId,
              bottleId: annotation.suggestion.rewardBottleId,
              activatedAt: Date.now(),
              expiresAt: endOfToday,
            }
            : get().activeRecoveryBonus,
        });

        const session = await getSupabaseSession();
        if (!session) return;

        const { error } = await supabase
          .from('annotations')
          .update({ suggestion_accepted: accepted })
          .eq('id', annotationId)
          .eq('user_id', session.user.id);

        if (error) {
          console.error('[Annotation] suggestion outcome sync failed:', error);
        }
      },

      consumeRecoveryBonusForCompletion: ({ todoId, bottleId }) => {
        const bonus = get().activeRecoveryBonus;
        if (!bonus) return 1;

        const now = Date.now();
        if (bonus.expiresAt <= now) {
          set({ activeRecoveryBonus: null });
          return 1;
        }

        const todoMatched = Boolean(todoId && bonus.todoId && todoId === bonus.todoId);
        const bottleMatched = Boolean(bottleId && bonus.bottleId && bottleId === bonus.bottleId);
        if (!todoMatched && !bottleMatched) return 1;

        set({ activeRecoveryBonus: null });
        return Math.max(1, Math.floor(bonus.stars || 1));
      },

      /**
       * 重置每日统计（手动）
       */
      resetDailyStats: () => {
        set({
          todayStats: {
            date: getTodayString(),
            speakCount: 0,
            lastSpeakTime: 0,
            events: [],
          },
          suggestionCountByPeriod: { morning: 0, afternoon: 0, night: 0 },
          dailySuggestionCount: 0,
          lastWasSuggestion: false,
          lastSuggestionTime: 0,
          consecutiveTextCount: 0,
          recoverySuggestionAttempts: [],
          activeRecoveryBonus: null,
          todayContextSnapshot: createEmptyTodayContextSnapshot(new Date()),
          pendingSuggestionIntent: null,
        });
      },

      setPendingSuggestionIntent: (intent) => {
        set({
          pendingSuggestionIntent: {
            ...intent,
            createdAt: Number(intent.createdAt) || Date.now(),
          },
        });
      },

      consumePendingSuggestionIntent: ({ type, maxAgeMs = 30_000 }) => {
        const pending = get().pendingSuggestionIntent;
        if (!pending || pending.type !== type) return null;
        if (Date.now() - pending.createdAt > maxAgeMs) {
          set({ pendingSuggestionIntent: null });
          return null;
        }

        set({ pendingSuggestionIntent: null });
        return pending;
      },

      /**
       * 更新配置
       */
      updateConfig: (configUpdate) => {
        set({
          config: {
            ...get().config,
            ...configUpdate,
          },
        });
      },

      getAdaptiveMinInterval: () => {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        const settledFromAnnotations = get().annotations
          .filter((item) => item.suggestion && typeof item.suggestionAccepted === 'boolean' && item.timestamp >= sevenDaysAgo)
          .map((item) => ({ accepted: Boolean(item.suggestionAccepted), timestamp: item.timestamp }));

        const settledFromOutcomes = get().suggestionOutcomes
          .filter((item) => item.timestamp >= sevenDaysAgo);

        const merged = [...settledFromAnnotations, ...settledFromOutcomes];
        const shown = merged.length;
        if (shown < 5) return 60 * 60 * 1000;

        const acceptedCount = merged.filter((item) => item.accepted).length;
        const rate = acceptedCount / shown;

        if (rate > 0.7) return 30 * 60 * 1000;
        if (rate < 0.3) return 2 * 60 * 60 * 1000;
        return 60 * 60 * 1000;
      },

      /**
       * 获取今日统计（供外部使用）
       */
      getTodayStats: () => {
        const { todayStats } = get();
        const activities = todayStats.events.filter(e =>
          e.type === 'activity_completed' || e.type === 'activity_recorded'
        );
        const totalDuration = activities.reduce((sum, e) =>
          sum + (e.data?.duration || 0), 0
        );
        return {
          activities: activities.length,
          duration: totalDuration,
          events: todayStats.events,
        };
      },

      /**
       * 从云端拉取历史批注
       */
      fetchAnnotations: async () => {
        const session = await getSupabaseSession();
        if (!session) return;

        const { data, error } = await supabase
          .from('annotations')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const annotations: AIAnnotation[] = data.map(fromDbAnnotation);
          set({ annotations });
        }
      },

      /**
       * 同步本地批注到云端
       */
      syncLocalAnnotations: async (userId: string) => {
        const pendingAnnotations = get().annotations.filter((a) => !a.syncedToCloud);
        if (pendingAnnotations.length === 0) return;

        const localAnnotations = pendingAnnotations.map((annotation) => toDbAnnotation(annotation, userId));

        const { error } = await supabase
          .from('annotations')
          .upsert(localAnnotations, { onConflict: 'id' });

        if (!error) {
          const syncedIds = new Set(pendingAnnotations.map((a) => a.id));
          set({
            annotations: get().annotations.map((annotation) =>
              syncedIds.has(annotation.id) ? { ...annotation, syncedToCloud: true } : annotation
            ),
          });
          await get().fetchAnnotations();
        } else {
          console.error('[Annotation] syncLocalAnnotations 失败:', error);
        }
      },
    }),
    {
      name: 'annotation-storage',
      partialize: (state) => ({
        todayStats: state.todayStats,
        config: state.config,
        currentAnnotation: state.currentAnnotation,
        annotations: state.annotations,
        suggestionCountByPeriod: state.suggestionCountByPeriod,
        dailySuggestionCount: state.dailySuggestionCount,
        lastWasSuggestion: state.lastWasSuggestion,
        lastSuggestionTime: state.lastSuggestionTime,
        consecutiveTextCount: state.consecutiveTextCount,
        suggestionOutcomes: state.suggestionOutcomes,
        recoverySuggestionAttempts: state.recoverySuggestionAttempts,
        activeRecoveryBonus: state.activeRecoveryBonus,
        todayContextSnapshot: state.todayContextSnapshot,
        characterStateTracker: state.characterStateTracker,
        pendingSuggestionIntent: state.pendingSuggestionIntent,
      }),
    }
  )
);

// 导出辅助函数供外部使用
export { shouldGenerateAnnotation };
