import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  AIAnnotation,
  AnnotationEvent,
  AnnotationEventType,
  AnnotationState,
  TodayActivity
} from '../types/annotation';
import { callAnnotationAPI } from '../api/client';
import { shouldGenerateAnnotation, recordEvent } from './annotationHelpers';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import i18n from '../i18n';
import { getLocalDateString } from './chatHelpers';

interface AnnotationStore extends AnnotationState {
  // 内部状态（不持久化）
  lastAnnotationTime: number;

  // 历史批注（云端同步）
  annotations: AIAnnotation[];

  // Actions
  triggerAnnotation: (event: AnnotationEvent) => Promise<void>;
  dismissAnnotation: () => void;
  resetDailyStats: () => void;
  updateConfig: (config: Partial<AnnotationState['config']>) => void;
  getTodayStats: () => { activities: number; duration: number; events: AnnotationEvent[] };

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
function shouldResetStats(lastDate: string): boolean {
  return lastDate !== getTodayString();
}

export const useAnnotationStore = create<AnnotationStore>()(
  persist(
    (set, get) => ({
      currentAnnotation: null,
      annotations: [],

      todayStats: {
        date: getTodayString(),
        speakCount: 0,
        lastSpeakTime: 0,
        events: [],
      },

      config: {
        dailyLimit: 5,
        enabled: true,
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

        // 检查是否启用
        if (!config.enabled) return;

        const now = Date.now();

        // 检查是否需要重置每日统计
        if (shouldResetStats(todayStats.date)) {
          set({
            todayStats: {
              date: getTodayString(),
              speakCount: 0,
              lastSpeakTime: 0,
              events: [event],
            },
          });
        } else {
          // 记录事件
          set({
            todayStats: {
              ...todayStats,
              events: [...todayStats.events, event],
            },
          });
        }

        // 检查是否应该生成批注
        const shouldGenerate = shouldGenerateAnnotation(
          event,
          get().todayStats,
          config
        );

        if (!shouldGenerate) {
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

          // 获取最近批注内容（避免重复）
          const recentAnnotations = todayEvents
            .filter(e => e.type === 'annotation_generated')
            .slice(-3)
            .map(e => e.data?.content || '');

          // 构建今日活动详细列表
          const todayActivitiesList = activities.map(e => ({
            content: e.data?.content || '未命名活动',
            duration: e.data?.duration || 0,
            activityType: e.data?.activityType || '未分类',
            timestamp: e.timestamp,
            completed: e.type === 'activity_completed'
          }));

          // 调用 AI 生成批注 (通过 Serverless Function)
          const response = await callAnnotationAPI({
            eventType: event.type,
            eventData: event.data,
            userContext: {
              todayActivities: activities.length,
              todayDuration: totalDuration,
              currentHour: new Date().getHours(),
              recentAnnotations,
              todayActivitiesList,
            },
            lang: (i18n.language?.split('-')[0] || 'en') as 'zh' | 'en',
          });

          // 先创建 id，后续同步需要
          const annotationId = uuidv4();

          // 创建批注对象
          const annotation: AIAnnotation = {
            id: annotationId,
            content: response.content,
            tone: response.tone,
            timestamp: Date.now(),
            relatedEvent: event,
            displayDuration: response.displayDuration,
          };

          // 更新状态
          set({
            currentAnnotation: annotation,
            annotations: [...get().annotations, annotation],
            todayStats: {
              ...get().todayStats,
              speakCount: get().todayStats.speakCount + 1,
              lastSpeakTime: Date.now(),
              events: [
                ...get().todayStats.events,
                {
                  type: 'annotation_generated' as AnnotationEventType,
                  timestamp: Date.now(),
                  data: { content: response.content, id: annotationId, tone: response.tone },
                },
              ],
            },
          });

          // 异步同步到云端
          const session = await getSupabaseSession();
          if (session) {
            const { error: insertError } = await supabase.from('annotations').insert([{
              id: annotationId,
              user_id: session.user.id,
              content: annotation.content,
              tone: annotation.tone,
              event_timestamp: annotation.timestamp,
              related_event: annotation.relatedEvent,
              created_at: new Date(annotation.timestamp).toISOString(),
            }]);
            if (insertError) {
              console.error('[Annotation] 云端同步失败:', insertError);
            }
          }

          if (response.source === 'default') {
            console.warn(
              '[AI Annotator] 批注使用兜底:',
              `event=${event.type}`,
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
        });
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
          const annotations: AIAnnotation[] = data.map((row: any) => ({
            id: row.id,
            content: row.content,
            tone: row.tone,
            timestamp: row.event_timestamp,
            relatedEvent: row.related_event,
            displayDuration: 8000,
          }));
          set({ annotations });
        }
      },

      /**
       * 同步本地批注到云端
       */
      syncLocalAnnotations: async (userId: string) => {
        const { todayStats } = get();

        // 从今日事件里提取批注，用已有的 id
        const localAnnotations = todayStats.events
          .filter(e => e.type === 'annotation_generated' && e.data?.id)
          .map(e => ({
            id: e.data.id,
            user_id: userId,
            content: e.data?.content || '',
            tone: e.data?.tone || 'playful',
            event_timestamp: e.timestamp,
            related_event: e,
            created_at: new Date(e.timestamp).toISOString(),
          }));

        if (localAnnotations.length === 0) return;

        const { error } = await supabase
          .from('annotations')
          .upsert(localAnnotations, { onConflict: 'id' });

        if (!error) {
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
      }),
    }
  )
);

// 导出辅助函数供外部使用
export { shouldGenerateAnnotation, recordEvent };
