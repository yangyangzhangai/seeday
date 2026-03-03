import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../api/supabase';
import { useTodoStore } from './useTodoStore';
import { useChatStore } from './useChatStore';
import { useMoodStore } from './useMoodStore';
import { useAuthStore } from './useAuthStore';
import { format, eachDayOfInterval, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale/zh-CN';
import { callReportAPI, callClassifierAPI, callDiaryAPI } from '../api/client';
import { computeAll, formatForDiaryAI, type ComputedResult, type MoodRecord } from '../lib/reportCalculator';
import i18n from '../i18n';
import {
  classifyActivities,
  computeMoodDistribution,
  filterActivities,
  filterRelevantTodos,
  generateActionSummary,
  generateMoodSummary,
  getDateRange,
} from './reportHelpers';

export interface ReportStats {
  completedTodos: number;
  totalTodos: number;
  completionRate: number;
  actionAnalysis?: {
    category: '生存' | '连接与交互' | '成长与创造' | '修复与娱乐' | '巅峰体验' | '其他';
    minutes: number;
    percent: number;
  }[];
  actionSummary?: string;
  moodSummary?: string;
  moodDistribution?: {
    mood: string;
    minutes: number;
  }[];
  recurringStats?: {
    name: string;
    completed: boolean; // For daily
    count?: number; // For weekly/monthly
    total?: number; // For weekly/monthly
    rate?: number;
  }[];
  priorityStats?: {
    priority: string;
    count: number;
    completed: number;
  }[];
  dailyCompletion?: {
    date: string;
    completed: number;
    total: number;
    rate: number;
  }[];
}

export interface Report {
  id: string;
  title: string;
  date: number;
  startDate?: number;
  endDate?: number;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  content: string; // JSON string or markdown
  aiAnalysis?: string | null;
  stats?: ReportStats;
  analysisStatus?: 'idle' | 'generating' | 'success' | 'error';
  errorMessage?: string | null;
}

interface ReportState {
  reports: Report[];
  fetchReports: () => Promise<void>;
  generateReport: (type: 'daily' | 'weekly' | 'monthly' | 'custom', date: number, endDate?: number) => void;
  updateReport: (id: string, updates: Partial<Report>) => void;
  triggerAIAnalysis: (reportId: string) => Promise<void>;
  // 三步走新流程
  generateTimeshineDiary: (reportId: string) => Promise<void>;
  // 存储计算结果供历史对比
  computedHistory: ComputedResult[];
}

export const useReportStore = create<ReportState>()(
  persist(
    (set, get) => ({
      reports: [],
      computedHistory: [],

      fetchReports: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
          const { data, error } = await supabase
            .from('reports')
            .select('*')
            .eq('user_id', session.user.id)
            .order('date', { ascending: false });

          if (error) throw error;

          if (data && data.length > 0) {
            const mappedReports: Report[] = data.map((r: any) => ({
              id: r.id,
              title: r.title,
              date: Number(r.date),
              startDate: r.start_date ? Number(r.start_date) : undefined,
              endDate: r.end_date ? Number(r.end_date) : undefined,
              type: r.type,
              content: r.content,
              aiAnalysis: r.ai_analysis,
              stats: r.stats,
              analysisStatus: r.ai_analysis ? 'success' : 'idle',
              errorMessage: null,
            }));
            set({ reports: mappedReports });
          }
        } catch (error) {
          console.error('Error fetching reports:', error);
        }
      },

      updateReport: async (id, updates) => {
        set(state => ({
          reports: state.reports.map(r => r.id === id ? { ...r, ...updates } : r)
        }));

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const dbUpdates: any = {};
          if (updates.aiAnalysis !== undefined) dbUpdates.ai_analysis = updates.aiAnalysis;
          if (updates.title !== undefined) dbUpdates.title = updates.title;
          if (updates.content !== undefined) dbUpdates.content = updates.content;
          if (updates.stats !== undefined) dbUpdates.stats = updates.stats;

          if (Object.keys(dbUpdates).length > 0) {
            await supabase.from('reports').update(dbUpdates).eq('id', id).eq('user_id', session.user.id);
          }
        }
      },
      generateReport: async (type, date, customEndDate) => {
        const todoStore = useTodoStore.getState();
        const chatStore = useChatStore.getState();
        const targetDate = new Date(date);
        const { start, end, title } = getDateRange(type, date, customEndDate);

        // Filter Todos in range
        const relevantTodos = filterRelevantTodos(todoStore.todos, start, end, type);

        // Calculate Stats
        const total = relevantTodos.length;
        const completed = relevantTodos.filter(t => t.completed).length;

        let stats: ReportStats = {
          completedTodos: completed,
          totalTodos: total,
          completionRate: total > 0 ? completed / total : 0,
          priorityStats: [],
          recurringStats: [],
          dailyCompletion: []
        };

        // Priority Stats
        const priorities = ['urgent-important', 'urgent-not-important', 'important-not-urgent', 'not-important-not-urgent'];
        stats.priorityStats = priorities.map(p => {
          const pTodos = relevantTodos.filter(t => t.priority === p);
          return {
            priority: p,
            count: pTodos.length,
            completed: pTodos.filter(t => t.completed).length
          };
        });

        if (type === 'daily') {
          // Daily Recurring Stats
          stats.recurringStats = relevantTodos
            .filter(t => t.recurrence && t.recurrence !== 'none')
            .map(t => ({
              name: t.content,
              completed: t.completed
            }));

          // 今日行动分析（基于记录页内容与时长的本地分析）
          // 仅在“当天已结束”（非当前进行中的今日）时生成；若是今天尚未过零点，则暂不生成，前端显示占位
          const now = new Date();
          const isSameDayAsNow =
            now.getFullYear() === targetDate.getFullYear() &&
            now.getMonth() === targetDate.getMonth() &&
            now.getDate() === targetDate.getDate();

          if (!isSameDayAsNow) {
            const records = filterActivities(chatStore.messages, start, end, { requireDuration: true });
            const actionAnalysis = classifyActivities(records);
            stats.actionAnalysis = actionAnalysis;
            stats.actionSummary = generateActionSummary(actionAnalysis);
          }
        } else {
          // Weekly/Monthly Recurring Stats
          // Group by recurrenceId or content
          const recurringGroups: Record<string, typeof relevantTodos> = {};
          relevantTodos.filter(t => t.recurrence && t.recurrence !== 'none').forEach(t => {
            const key = t.recurrenceId || t.content;
            if (!recurringGroups[key]) recurringGroups[key] = [];
            recurringGroups[key].push(t);
          });

          stats.recurringStats = Object.values(recurringGroups).map(group => {
            const completedCount = group.filter(t => t.completed).length;
            return {
              name: group[0].content,
              completed: false, // Not used for weekly
              count: completedCount,
              total: group.length,
              rate: group.length > 0 ? completedCount / group.length : 0
            };
          });

          // Daily Completion Trend
          const days = eachDayOfInterval({ start, end });
          stats.dailyCompletion = days.map(day => {
            const dayTodos = relevantTodos.filter(t => isSameDay(t.dueDate, day));
            const dayCompleted = dayTodos.filter(t => t.completed).length;
            return {
              date: format(day, 'MM-dd'),
              completed: dayCompleted,
              total: dayTodos.length,
              rate: dayTodos.length > 0 ? dayCompleted / dayTodos.length : 0
            };
          });
        }

        const moodStore = useMoodStore.getState();
        stats.moodDistribution = computeMoodDistribution(chatStore.messages, moodStore, start, end);

        // 心情简评（仅在非当天生成，零点后更新）
        const now2 = new Date();
        const isSameDayNow =
          now2.getFullYear() === targetDate.getFullYear() &&
          now2.getMonth() === targetDate.getMonth() &&
          now2.getDate() === targetDate.getDate();
        if (!isSameDayNow) {
          stats.moodSummary = generateMoodSummary(stats.moodDistribution || []);
        }

        const newReport: Report = {
          id: uuidv4(),
          title,
          date,
          startDate: start.getTime(),
          endDate: end.getTime(),
          type,
          content: 'Generated report',
          stats,
          aiAnalysis: null, // No auto-generation
          analysisStatus: 'idle',
          errorMessage: null,
        };

        // Remove existing report of same type and date (simple dedup)
        set((state) => ({
          reports: [
            ...state.reports.filter(r => !(r.type === type && isSameDay(r.date, date))),
            newReport
          ]
        }));

        // Sync to Supabase in background
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            supabase.from('reports').insert([{
              id: newReport.id,
              user_id: session.user.id,
              title: newReport.title,
              date: newReport.date,
              start_date: newReport.startDate,
              end_date: newReport.endDate,
              type: newReport.type,
              content: newReport.content,
              stats: newReport.stats
            }]).then(({ error }) => {
              if (error) console.error('Error syncing new report to Supabase:', error);
            });
          }
        });
      },

      triggerAIAnalysis: async (reportId) => {
        const state = get();
        const report = state.reports.find(r => r.id === reportId);
        if (!report) return;

        // Set loading state
        get().updateReport(reportId, { analysisStatus: 'generating', errorMessage: null });

        const todoStore = useTodoStore.getState();
        const chatStore = useChatStore.getState();

        const range = getDateRange(report.type, report.date, report.endDate);
        const start = report.startDate ? new Date(report.startDate) : range.start;
        const end = report.endDate ? new Date(report.endDate) : range.end;

        // Filter Todos
        const relevantTodos = filterRelevantTodos(todoStore.todos, start, end, report.type);

        const activities = filterActivities(chatStore.messages, start, end).map(m => ({
          time: format(m.timestamp, 'MM-dd HH:mm'),
          content: m.content,
          duration: m.duration || 0
        }));

        const analysisData = {
          date: format(start, 'yyyy-MM-dd') + (report.type !== 'daily' ? ` 至 ${format(end, 'yyyy-MM-dd')}` : ''),
          todos: relevantTodos,
          activities,
          stats: report.stats
        };

        const analysisContent = await callReportAPI({
          data: analysisData,
          type: report.type === 'custom' ? 'daily' : report.type,
        });
        get().updateReport(reportId, { aiAnalysis: analysisContent, analysisStatus: 'success' });
      },

      /**
       * Timeshine 三步走流程 - 生成观察手记
       * Step 1: 调用分类器 API 将原始输入结构化
       * Step 2: 本地计算层处理数据
       * Step 3: 调用日记 API 生成诗意观察手记
       */
      generateTimeshineDiary: async (reportId) => {
        const state = get();
        const report = state.reports.find(r => r.id === reportId);
        if (!report) return;

        const chatStore = useChatStore.getState();
        const todoStore = useTodoStore.getState();
        const moodStoreForDiary = useMoodStore.getState();

        // 设置加载状态
        get().updateReport(reportId, { analysisStatus: 'generating', errorMessage: null });

        try {
          // 准备时间范围
          const range = getDateRange(report.type, report.date, report.endDate);
          const start = report.startDate ? new Date(report.startDate) : range.start;
          const end = report.endDate ? new Date(report.endDate) : range.end;

          // 获取活动记录
          const activities = filterActivities(chatStore.messages, start, end);

          // 获取待办统计
          const relevantTodos = filterRelevantTodos(todoStore.todos, start, end, report.type);
          const completedTodos = relevantTodos.filter(t => t.completed).length;
          const totalTodos = relevantTodos.length;

          // 提取心情记录（isMood 消息是独立数据源，不经过分类器）
          const moodMessages = chatStore.messages.filter(m =>
            m.timestamp >= start.getTime() &&
            m.timestamp <= end.getTime() &&
            m.isMood === true
          );
          const moodRecords: MoodRecord[] = moodMessages.map(m => {
            const hour = new Date(m.timestamp).getHours();
            return {
              time: format(m.timestamp, 'HH:mm'),
              time_slot: hour < 12 ? 'morning' as const : hour < 18 ? 'afternoon' as const : 'evening' as const,
              content: m.content,
            };
          });

          // 获取当前语言环境
          const currentLang = (i18n.language?.split('-')[0] || 'en') as 'zh' | 'en' | 'it';
          const isZh = currentLang === 'zh';

          // 构建原始输入文本
          const rawInputLines: string[] = [];
          rawInputLines.push(isZh ? '今天的时间记录：' : 'Today\'s Time Log:');
          activities.forEach(m => {
            const timeStr = format(m.timestamp, 'HH:mm');
            const durationStr = m.duration ? (isZh ? ` (${m.duration}分钟)` : ` (${m.duration}min)`) : '';
            rawInputLines.push(`- ${timeStr} ${m.content}${durationStr}`);
            const note = moodStoreForDiary.moodNote[m.id];
            if (note && note.trim()) {
              rawInputLines.push(`  心情记录：${note.trim()}`);
            }
          });

          if (moodMessages.length > 0) {
            rawInputLines.push('');
            rawInputLines.push(isZh ? '心情与能量状态记录：' : 'Mood and Energy Log:');
            moodMessages.forEach(m => {
              const timeStr = format(m.timestamp, 'HH:mm');
              rawInputLines.push(`- ${timeStr} [${isZh ? '状态/心情' : 'Mood/Energy'}] ${m.content}`);
            });
          }

          rawInputLines.push('');
          rawInputLines.push(isZh ? `待办：完成${completedTodos}件，共${totalTodos}件` : `Todos: Completed ${completedTodos}, Total ${totalTodos}`);

          const rawInput = rawInputLines.join('\n');

          // ═══════════════════════════════════════════════════════════════
          // Step 1: 调用分类器 API
          // ═══════════════════════════════════════════════════════════════
          console.log('[Timeshine] Step 1: 调用分类器...');
          const classifyResult = await callClassifierAPI({ rawInput, lang: currentLang });

          if (!classifyResult.success || !classifyResult.data) {
            throw new Error('分类器返回数据失败');
          }

          const classifiedData = classifyResult.data;

          // ═══════════════════════════════════════════════════════════════
          // Step 2: 本地计算层
          // ═══════════════════════════════════════════════════════════════
          console.log('[Timeshine] Step 2: 计算层处理...');
          const computed = computeAll(classifiedData, state.computedHistory);
          computed.mood_records = moodRecords; // 注入心情数据
          const structuredData = formatForDiaryAI(computed, currentLang);

          // 手记编号（注意：基于本地 computedHistory 长度，清除缓存或换设备会重置）
          const reportNumber = state.computedHistory.length + 1;
          const metaTitle = isZh ? `手记编号：第 ${reportNumber} 号\n\n` : `Report No. ${reportNumber}\n\n`;
          const structuredDataWithMeta = metaTitle + structuredData;

          // 保存计算结果到历史（用于未来趋势分析）
          set(state => ({
            computedHistory: [...state.computedHistory.slice(-6), computed]
          }));

          // 构建历史上下文（给 AI 提供近几日的叙述性背景）
          let historyContext: string | undefined;
          if (state.computedHistory.length > 0) {
            const recent = state.computedHistory.slice(-3);
            const ctxLines: string[] = [isZh ? `过去${recent.length}天观察摘要：` : `Past ${recent.length} days summary:`];
            recent.forEach((h, i) => {
              const focusItem = h.spectrum.find(s => s.category === 'deep_focus');
              const dayIndex = state.computedHistory.length - recent.length + i + 1;
              const focusStr = focusItem?.duration_str || '0';
              const todoStr = h.light_quality.todo_str;
              if (isZh) {
                ctxLines.push(`  第${dayIndex}日：专注${focusStr}，待办${todoStr}`);
              } else {
                ctxLines.push(`  Day ${dayIndex}: Focus ${focusStr}, Todo ${todoStr}`);
              }
            });
            historyContext = ctxLines.join('\n');
          }

          // ═══════════════════════════════════════════════════════════════
          // Step 3: 调用日记 API
          // ═══════════════════════════════════════════════════════════════
          console.log('[Timeshine] Step 3: 生成观察手记...');
          const currentUser = useAuthStore.getState().user;
          const userNickname = currentUser?.user_metadata?.display_name || undefined;

          // 只在中文时使用 zhCN Locale，否则使用标准的国际化日期格式
          const dateStr = isZh
            ? format(start, 'yyyy年MM月dd日 EEEE', { locale: zhCN })
            : format(start, 'yyyy-MM-dd EEEE');

          const diaryResult = await callDiaryAPI({
            structuredData: structuredDataWithMeta,
            rawInput: rawInput.slice(0, 500),
            date: dateStr,
            historyContext,
            userName: userNickname,
            lang: currentLang,
          });

          if (!diaryResult.success || !diaryResult.content) {
            throw new Error('日记生成失败');
          }

          // 更新报告
          get().updateReport(reportId, { aiAnalysis: diaryResult.content, analysisStatus: 'success' });
          console.log('[Timeshine] 观察手记生成完成');

        } catch (error) {
          console.error('[Timeshine] 生成观察手记失败:', error);
          get().updateReport(reportId, {
            analysisStatus: 'error',
            errorMessage: error instanceof Error ? error.message : '未知错误'
          });
        }
      }
    }),
    {
      name: 'report-storage',
      partialize: (state) => ({
        reports: state.reports.map(r => ({ ...r, analysisStatus: r.aiAnalysis ? 'success' : 'idle', errorMessage: undefined })),
        computedHistory: state.computedHistory
      }),
    }
  )
);
