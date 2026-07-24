// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/report/README.md
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import { fromDbReport } from '../lib/dbMappers';
import i18n from '../i18n';
import { useTodoStore } from './useTodoStore';
import { useChatStore } from './useChatStore';
import { useMoodStore } from './useMoodStore';
import { useAuthStore } from './useAuthStore';
import { useGrowthStore } from './useGrowthStore';
import { useOutboxStore } from './useOutboxStore';
import { type ComputedResult } from '../lib/reportCalculator';
import {
  createGeneratedReport,
  mergeReportIntoList,
  runAIDiary,
  syncReportToSupabase,
  triggerWeeklyProfileExtraction,
} from './reportActions';
import { getDateRange } from './reportHelpers';
import { PERSIST_KEYS, LEGACY_PERSIST_KEYS } from './persistKeys';
import { readLegacyPersistedState } from './persistMigrationHelpers';
import { createScopedJSONStorage } from './scopedPersistStorage';
import {
  buildDiaryPageSnapshot,
  generateDiaryPageSnapshot,
  upgradeDiaryPageSnapshot,
  type DiaryPageSnapshot,
  type DiarySnapshotLang,
} from './reportDiarySnapshot';
import {
  dedupeReportsByWindow,
  findPreferredReportForWindow,
  hasStoredDiaryText,
  mergeSameReportRecord,
} from './reportRecordResolver';

const diarySnapshotUpgradeRequests = new Map<string, Promise<DiaryPageSnapshot>>();

export interface ReportStats {
  completedTodos: number;
  totalTodos: number;
  completionRate: number;
  actionAnalysis?: {
    category: 'study' | 'work' | 'social' | 'life' | 'entertainment' | 'health';
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
  dailyCompletion?: {
    date: string;
    completed: number;
    total: number;
    rate: number;
  }[];
  // Daily-only: new todo breakdown
  habitCheckin?: {
    bottleId: string;
    name: string;
    done: boolean;
    recurrence: string;
  }[];
  goalProgress?: {
    bottleId: string;
    bottleName: string;
    doneToday: boolean;
    currentStars: number;
  }[];
  independentRecurring?: { completed: number; total: number };
  oneTimeTasks?: {
    high: { completed: number; total: number };
    medium: { completed: number; total: number };
    low: { completed: number; total: number };
    completedTitles: string[];
  };
  diaryPageSnapshot?: DiaryPageSnapshot;
}

export interface StickerItem {
  id: 'activity' | 'mood';
  visible: boolean;
  x: number;
  y: number;
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
  teaserText?: string | null;
  userNote?: string;
  stats?: ReportStats;
  analysisStatus?: 'idle' | 'generating' | 'success' | 'error';
  errorMessage?: string | null;
  stickerLayout?: StickerItem[];
}

interface ReportState {
  reports: Report[];
  lastFetchedAt: number | null;
  fetchReports: () => Promise<void>;
  generateReport: (type: 'daily' | 'weekly' | 'monthly' | 'custom', date: number, endDate?: number) => Promise<string>;
  updateReport: (id: string, updates: Partial<Report>) => void;
  // 日记三步流程
  generateAIDiary: (reportId: string) => Promise<void>;
  ensureDiaryPageSnapshot: (reportId: string) => void;
  // 存储计算结果供历史对比
  computedHistory: ComputedResult[];
}

export const useReportStore = create<ReportState>()(
  persist(
    (set, get) => ({
      reports: [],
      computedHistory: [],
      lastFetchedAt: null,

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
            const mappedReports: Report[] = data.map(fromDbReport);
            const localReports = get().reports;
            const mergedReports = dedupeReportsByWindow([...localReports, ...mappedReports]);
            set({ reports: mergedReports, lastFetchedAt: Date.now() });

            mergedReports.filter((report) => {
              const cloud = mappedReports.find(item => item.id === report.id);
              return !cloud || (hasStoredDiaryText(report) && !hasStoredDiaryText(cloud));
            }).forEach((report) => {
              void syncReportToSupabase(report);
            });
          } else {
            const localReports = get().reports;
            set({ reports: localReports, lastFetchedAt: Date.now() });
            localReports.forEach((report) => {
              void syncReportToSupabase(report);
            });
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error('Error fetching reports:', error);
          }
        }
      },

      updateReport: async (id, updates) => {
        let nextReport: Report | null = null;
        set(state => {
          const nextReports = state.reports.map((report) => {
            if (report.id !== id) return report;
            nextReport = mergeSameReportRecord(report, { ...report, ...updates });
            return nextReport;
          });
          return { reports: nextReports };
        });

        if (!nextReport) {
          return;
        }

        const session = await getSupabaseSession();
        if (!session) {
          useOutboxStore.getState().enqueue({
            kind: 'report.upsert',
            payload: { report: nextReport },
          });
          return;
        }

        const dbUpdates: any = {};
        if (updates.aiAnalysis !== undefined) dbUpdates.ai_analysis = updates.aiAnalysis;
        if (updates.teaserText !== undefined) dbUpdates.teaser_text = updates.teaserText;
        if (updates.title !== undefined) dbUpdates.title = updates.title;
        if (updates.content !== undefined) dbUpdates.content = updates.content;
        if (updates.stats !== undefined) dbUpdates.stats = updates.stats;
        if (updates.userNote !== undefined) dbUpdates.user_note = updates.userNote;

        if (Object.keys(dbUpdates).length > 0) {
          const { error } = await supabase.from('reports').update(dbUpdates).eq('id', id).eq('user_id', session.user.id);
          if (error) {
            useOutboxStore.getState().enqueue({
              kind: 'report.upsert',
              payload: { report: nextReport },
            });
            if (import.meta.env.DEV) {
              console.error('[updateReport] supabase error; queued full upsert fallback', error, 'columns attempted:', Object.keys(dbUpdates));
            }
            return;
          }
        }
      },
      generateReport: async (type, date, customEndDate) => {
        const todoStore = useTodoStore.getState();
        const chatStore = useChatStore.getState();
        const moodStore = useMoodStore.getState();
        const growthStore = useGrowthStore.getState();
        const existingReport = findPreferredReportForWindow(get().reports, type, date);
        if (existingReport && hasStoredDiaryText(existingReport)) {
          return existingReport.id;
        }

        // Fetch messages for the target date range from Supabase (not just today's in-memory messages)
        const { start, end } = getDateRange(type, date, customEndDate);
        const messages = await chatStore.getMessagesForDateRange(start, end);

        const generatedReport = createGeneratedReport({
          type,
          date,
          customEndDate,
          todos: todoStore.todos,
          messages,
          moodStore,
          bottles: growthStore.bottles,
        });
        const newReport = existingReport
          ? { ...generatedReport, id: existingReport.id }
          : generatedReport;

        set((state) => ({
          reports: mergeReportIntoList(state.reports, type, date, newReport),
        }));

        syncReportToSupabase(newReport);

        if (type === 'weekly') {
          void triggerWeeklyProfileExtraction(messages);
        }

        return newReport.id;
      },

      /**
       * 日记三步流程
       * Step 1: 调用分类器 API 将原始输入结构化
       * Step 2: 本地计算层处理数据
       * Step 3: 调用日记 API 生成 AI 日记
       */
      generateAIDiary: async (reportId) => {
        const state = get();
        const report = state.reports.find((r) => r.id === reportId);
        if (!report) return;

        const isAlreadyGenerated = Boolean((report.aiAnalysis && report.aiAnalysis.trim()) || (report.teaserText && report.teaserText.trim()));
        if (isAlreadyGenerated) return;

        const chatStore = useChatStore.getState();
        const todoStore = useTodoStore.getState();
        const moodStore = useMoodStore.getState();
        const growthStore = useGrowthStore.getState();

        get().updateReport(reportId, { analysisStatus: 'generating', errorMessage: null });

        try {
          const isPlus = useAuthStore.getState().isPlus;

          // Fetch messages for this report's date range from Supabase
          const start = new Date(report.startDate ?? report.date);
          const end = new Date(report.endDate ?? report.date);
          const messages = await chatStore.getMessagesForDateRange(start, end);
          const generationStats = report.type === 'daily'
            ? createGeneratedReport({
              type: report.type,
              date: report.date,
              customEndDate: report.endDate,
              todos: todoStore.todos,
              messages,
              moodStore,
              bottles: growthStore.bottles,
            }).stats
            : report.stats;
          const reportAtGeneration = {
            ...report,
            stats: generationStats,
          };

          const result = await runAIDiary({
            report: reportAtGeneration,
            todos: todoStore.todos,
            messages,
            moodStore,
            computedHistory: state.computedHistory,
            bottles: growthStore.bottles,
            dailyGoal: growthStore.dailyGoal,
            goalDate: growthStore.goalDate,
            mode: isPlus ? 'full' : 'teaser',
          });

          if (result.computed) {
            set((current) => ({
              computedHistory: [...current.computedHistory.slice(-6), result.computed],
            }));
          }

          const snapshotLang = (i18n.language?.split('-')[0] || 'en') as DiarySnapshotLang;
          const diaryPageSnapshot = report.type === 'daily' && generationStats
            ? await generateDiaryPageSnapshot(generationStats, snapshotLang)
            : undefined;
          get().updateReport(reportId, {
            aiAnalysis: isPlus ? result.content : report.aiAnalysis,
            teaserText: isPlus ? report.teaserText : result.content,
            analysisStatus: 'success',
            stats: generationStats
              ? { ...generationStats, diaryPageSnapshot }
              : generationStats,
          });

        } catch (error) {
          if (import.meta.env.DEV) {
            console.error('[Diary] 生成 AI 日记失败:', error);
          }
          get().updateReport(reportId, {
            analysisStatus: 'error',
            errorMessage: error instanceof Error ? error.message : i18n.t('report_error_unknown')
          });
        }
      },

      ensureDiaryPageSnapshot: (reportId) => {
        const report = get().reports.find(item => item.id === reportId);
        if (!report?.stats) return;
        if (!report.aiAnalysis?.trim() && !report.teaserText?.trim()) return;
        const storedSnapshot = report.stats.diaryPageSnapshot;
        if (storedSnapshot?.version === 2) return;
        const lang = (i18n.language?.split('-')[0] || 'en') as DiarySnapshotLang;
        if (!storedSnapshot) {
          get().updateReport(reportId, {
            stats: {
              ...report.stats,
              diaryPageSnapshot: buildDiaryPageSnapshot(report.stats, lang),
            },
          });
          return;
        }
        if (diarySnapshotUpgradeRequests.has(reportId)) return;

        const request = upgradeDiaryPageSnapshot(storedSnapshot);
        diarySnapshotUpgradeRequests.set(reportId, request);
        void request.then((upgradedSnapshot) => {
          const latest = get().reports.find(item => item.id === reportId);
          if (!latest?.stats || latest.stats.diaryPageSnapshot?.version !== 1) return;
          get().updateReport(reportId, {
            stats: { ...latest.stats, diaryPageSnapshot: upgradedSnapshot },
          });
        }).finally(() => {
          diarySnapshotUpgradeRequests.delete(reportId);
        });
      }
    }),
    {
      name: PERSIST_KEYS.report,
      storage: createScopedJSONStorage<Partial<ReportState>>('report'),
      skipHydration: true,
      partialize: (state) => ({
        reports: state.reports.map(r => ({
          ...r,
          analysisStatus: (r.aiAnalysis || r.teaserText) ? 'success' : 'idle',
          errorMessage: undefined,
        })),
        computedHistory: state.computedHistory,
        lastFetchedAt: state.lastFetchedAt,
      }),
      merge: (persistedState, currentState) => {
        const merged = {
          ...(currentState as ReportState),
          ...(readLegacyPersistedState<ReportState>(LEGACY_PERSIST_KEYS.report) || {}),
          ...((persistedState as Partial<ReportState>) || {}),
        };
        return {
          ...merged,
          reports: dedupeReportsByWindow(merged.reports ?? []),
        };
      },
    }
  )
);
