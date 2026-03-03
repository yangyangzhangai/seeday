import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import i18n from '../i18n';
import { useTodoStore } from './useTodoStore';
import { useChatStore } from './useChatStore';
import { useMoodStore } from './useMoodStore';
import { type ComputedResult } from '../lib/reportCalculator';
import {
  createGeneratedReport,
  mergeReportIntoList,
  runReportAIAnalysis,
  runTimeshineDiary,
  syncReportToSupabase,
} from './reportActions';

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
        const session = await getSupabaseSession();
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

        const session = await getSupabaseSession();
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
        const moodStore = useMoodStore.getState();

        const newReport = createGeneratedReport({
          type,
          date,
          customEndDate,
          todos: todoStore.todos,
          messages: chatStore.messages,
          moodStore,
        });

        set((state) => ({
          reports: mergeReportIntoList(state.reports, type, date, newReport),
        }));

        syncReportToSupabase(newReport);
      },

      triggerAIAnalysis: async (reportId) => {
        const state = get();
        const report = state.reports.find((r) => r.id === reportId);
        if (!report) return;

        get().updateReport(reportId, { analysisStatus: 'generating', errorMessage: null });

        const todoStore = useTodoStore.getState();
        const chatStore = useChatStore.getState();

        try {
          const analysisContent = await runReportAIAnalysis(report, todoStore.todos, chatStore.messages);
          get().updateReport(reportId, { aiAnalysis: analysisContent, analysisStatus: 'success' });
        } catch (error) {
          get().updateReport(reportId, {
            analysisStatus: 'error',
            errorMessage: error instanceof Error ? error.message : i18n.t('report_error_unknown'),
          });
        }
      },

      /**
       * Timeshine 三步走流程 - 生成观察手记
       * Step 1: 调用分类器 API 将原始输入结构化
       * Step 2: 本地计算层处理数据
       * Step 3: 调用日记 API 生成诗意观察手记
       */
      generateTimeshineDiary: async (reportId) => {
        const state = get();
        const report = state.reports.find((r) => r.id === reportId);
        if (!report) return;

        const chatStore = useChatStore.getState();
        const todoStore = useTodoStore.getState();
        const moodStore = useMoodStore.getState();

        get().updateReport(reportId, { analysisStatus: 'generating', errorMessage: null });

        try {
          const result = await runTimeshineDiary({
            report,
            todos: todoStore.todos,
            messages: chatStore.messages,
            moodStore,
            computedHistory: state.computedHistory,
          });

          set((current) => ({
            computedHistory: [...current.computedHistory.slice(-6), result.computed],
          }));

          get().updateReport(reportId, { aiAnalysis: result.content, analysisStatus: 'success' });
          console.log('[Timeshine] 观察手记生成完成');

        } catch (error) {
          console.error('[Timeshine] 生成观察手记失败:', error);
          get().updateReport(reportId, {
            analysisStatus: 'error',
            errorMessage: error instanceof Error ? error.message : i18n.t('report_error_unknown')
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
