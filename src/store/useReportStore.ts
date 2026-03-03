import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../api/supabase';
import { useTodoStore } from './useTodoStore';
import { useChatStore } from './useChatStore';
import { useMoodStore } from './useMoodStore';
import { useAuthStore } from './useAuthStore';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, format, eachDayOfInterval, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale/zh-CN';
import { callReportAPI, callClassifierAPI, callDiaryAPI } from '../api/client';
import { computeAll, formatForDiaryAI, type ComputedResult, type ClassifiedData, type MoodRecord } from '../lib/reportCalculator';
import i18n from '../i18n';

const FALLBACK_SUMMARY = '今天的你是一个很棒自己。';
function clampText100(s: string): string {
  // 粗略按字符数截断到约50字，确保不外溢
  const MAX = 50;
  if (!s) return s;
  const arr = Array.from(s); // 处理多字节字符
  if (arr.length <= MAX) return s;
  return arr.slice(0, MAX).join('');
}

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

        let start: Date, end: Date;
        let title = '';

        if (type === 'daily') {
          start = startOfDay(targetDate);
          end = endOfDay(targetDate);
          title = `${format(targetDate, 'yyyy-MM-dd')} 日报`;
        } else if (type === 'weekly') {
          start = startOfWeek(targetDate, { weekStartsOn: 1 });
          end = endOfWeek(targetDate, { weekStartsOn: 1 });
          title = `${format(start, 'MM-dd')} 至 ${format(end, 'MM-dd')} 周报`;
        } else if (type === 'monthly') {
          start = startOfMonth(targetDate);
          end = endOfMonth(targetDate);
          title = `${format(targetDate, 'yyyy-MM')} 月报`;
        } else if (type === 'custom' && customEndDate) {
          start = startOfDay(targetDate);
          end = endOfDay(new Date(customEndDate));
          title = `${format(start, 'yyyy-MM-dd')} 至 ${format(end, 'yyyy-MM-dd')} 定制报告`;
        } else {
          start = startOfDay(targetDate);
          end = endOfDay(targetDate);
          title = '定制报告';
        }

        // Filter Todos in range
        const allTodos = todoStore.todos;
        const relevantTodos = allTodos.filter(t => {
          const inDateRange = t.dueDate >= start.getTime() && t.dueDate <= end.getTime();
          if (!inDateRange) return false;

          // Scope filtering: Exclude monthly scope from weekly report
          if (type === 'weekly' && t.scope === 'monthly') {
            return false;
          }

          return true;
        });

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
            // 五大类关键词（字符串数组，便于匹配）
            const kw: Record<'生存' | '连接与交互' | '成长与创造' | '修复与娱乐' | '巅峰体验', string[]> = {
              生存: [
                '吃饭', '用餐', '餐', '午餐', '晚餐', '早餐', '睡', '睡觉', '小憩', '午休', '卫生', '洗澡', '刷牙', '如厕', '上厕所', '排泄',
                '工作', '上班', '打工', '谋生', '收入', '加班', '通勤', '地铁', '公交', '打车',
                '看病', '就医', '体检', '保险', '储蓄', '理财', '交房租', '交水电', '缴费',
                '打扫', '清洁', '扫地', '拖地', '收纳', '整理', '洗衣', '做饭', '买菜'
              ],
              连接与交互: [
                '家人', '父母', '孩子', '朋友', '同学', '聊天', '闲聊', '约会', '恋爱', '拥抱', '陪伴', '育儿',
                '沟通', '会议', '面谈', '讨论', '协作', '对接', '商务', '谈判',
                '聚会', '酒局', '发朋友圈', '社交媒体', '微博', '小红书', '点赞', '私信', '人情', '联络'
              ],
              成长与创造: [
                '学习', '读书', '阅读', '复盘', '复习', '上课', '课程', '作业', '考试', '备考', '练习', '刻意练习', '训练',
                '写作', '绘画', '画画', '设计', '编程', '开发', '产品', '发明', '创造', '深度思考', '笔记',
                '宗教', '信仰', '哲学', '志愿', '公益', '义工', '意义'
              ],
              修复与娱乐: [
                '短视频', '刷视频', '刷抖音', '刷快手', '追剧', '电影', '电视剧', '音乐', '听歌', '发呆',
                '旅行', '旅游', '出游', '游戏', '打游戏', '电竞', '运动', '跑步', '健身', '瑜伽', '看演出', '观演',
                '冥想', '正念', '心理', '咨询', '日记', '倾诉'
              ],
              巅峰体验: [
                '心流', '忘我', '沉浸', '人琴合一', '上头', '出神', '状态拉满',
                '登山', '攀登', '冲顶', '破 PB', '比赛夺冠',
                '婚礼', '结婚', '毕业典礼', '节日', '团聚', '庆典'
              ]
            };

            const categories: Array<'生存' | '连接与交互' | '成长与创造' | '修复与娱乐' | '巅峰体验' | '其他'> =
              ['生存', '连接与交互', '成长与创造', '修复与娱乐', '巅峰体验', '其他'];
            const minutesByCat: Record<(typeof categories)[number], number> = {
              生存: 0, 连接与交互: 0, 成长与创造: 0, 修复与娱乐: 0, 巅峰体验: 0, 其他: 0
            };

            const recs = useChatStore.getState().messages.filter(m =>
              m.timestamp >= start.getTime() &&
              m.timestamp <= end.getTime() &&
              m.mode === 'record' &&
              !m.isMood &&
              m.duration !== undefined &&
              m.duration > 0
            );

            recs.forEach(m => {
              const c = m.content || '';
              const mm = m.duration || 0;
              const has = (arr: readonly string[]) => arr.some(k => c.includes(k));
              let cat: (typeof categories)[number] = '其他';
              if (has(kw.巅峰体验)) cat = '巅峰体验';
              else if (has(kw.成长与创造)) cat = '成长与创造';
              else if (has(kw.连接与交互)) cat = '连接与交互';
              else if (has(kw.修复与娱乐)) cat = '修复与娱乐';
              else if (has(kw.生存)) cat = '生存';
              minutesByCat[cat] += mm;
            });

            const totalActMin = Object.values(minutesByCat).reduce((s, v) => s + v, 0);
            if (totalActMin > 0) {
              const entries = (Object.keys(minutesByCat) as Array<(typeof categories)[number]>)
                .map(k => ({ category: k, minutes: minutesByCat[k], percent: minutesByCat[k] / totalActMin }))
                .filter(e => e.minutes > 0);
              stats.actionAnalysis = entries;

              // 生成约100字的鼓励式总结
              const top = [...entries].sort((a, b) => b.minutes - a.minutes)[0];
              const sec = [...entries].sort((a, b) => b.minutes - a.minutes)[1];
              const parts: string[] = [];
              parts.push(`今天你的行动重心在「${top.category}」，约${Math.round(top.percent * 100)}%。`);
              if (sec) parts.push(`其次是「${sec.category}」，节奏平衡。`);
              if (top.category === '生存') parts.push('稳定打底很重要，你在打磨生活的地基。');
              if (top.category === '连接与交互') parts.push('好的人际让能量流动，你在建立支持与被支持。');
              if (top.category === '成长与创造') parts.push('稳稳向前，哪怕一点点，都是积累与突破。');
              if (top.category === '修复与娱乐') parts.push('适度放松是前进的缓冲区，恢复之后会更有劲。');
              if (top.category === '巅峰体验') parts.push('你触到了心流的边界，这份专注很珍贵。');
              parts.push('继续保持这份诚实与投入，明天也会更好。');
              stats.actionSummary = clampText100(parts.join(''));
            } else {
              // 无数据时的零点后兜底
              stats.actionSummary = FALLBACK_SUMMARY;
            }
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
        const moodMinutes: Record<string, number> = {};
        chatStore.messages
          .filter(m =>
            m.timestamp >= start.getTime() &&
            m.timestamp <= end.getTime() &&
            m.mode === 'record' &&
            !m.isMood &&
            m.duration !== undefined
          )
          .forEach(m => {
            const baseMood = moodStore.activityMood[m.id];
            const customLabel = moodStore.customMoodLabel[m.id];
            const useCustom = (moodStore as any).customMoodApplied?.[m.id] === true;
            const mood = (useCustom && customLabel && customLabel.trim() && customLabel.trim() !== '自定义')
              ? customLabel.trim()
              : baseMood;
            if (!mood) return;
            const minutes = m.duration || 0;
            moodMinutes[mood] = (moodMinutes[mood] || 0) + minutes;
          });
        stats.moodDistribution = Object.entries(moodMinutes)
          .map(([mood, minutes]) => ({ mood, minutes }))
          .sort((a, b) => b.minutes - a.minutes);

        // 心情简评（仅在非当天生成，零点后更新）
        const now2 = new Date();
        const isSameDayNow =
          now2.getFullYear() === targetDate.getFullYear() &&
          now2.getMonth() === targetDate.getMonth() &&
          now2.getDate() === targetDate.getDate();
        if (!isSameDayNow) {
          if (stats.moodDistribution && stats.moodDistribution.length > 0) {
            const totalMin = stats.moodDistribution.reduce((s, v) => s + v.minutes, 0);
            const top = stats.moodDistribution[0];
            const sec = stats.moodDistribution[1];
            const parts: string[] = [];
            parts.push(`今天你的情绪主色调是「${top.mood}」，约${Math.round(top.minutes / totalMin * 100)}%。`);
            if (sec) parts.push(`同时也有「${sec.mood}」穿插其间，节奏自然。`);
            parts.push('谢谢你真诚地记录心情，每一步都不白费。愿你在照顾感受的同时，继续把自己放在第一位。');
            stats.moodSummary = clampText100(parts.join(''));
          } else {
            // 零点后兜底
            stats.moodSummary = FALLBACK_SUMMARY;
          }
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

        let start = report.startDate ? new Date(report.startDate) : startOfDay(new Date(report.date));
        let end = report.endDate ? new Date(report.endDate) : endOfDay(new Date(report.date));

        // Legacy support for reports without start/end
        if (!report.startDate) {
          if (report.type === 'weekly') {
            start = startOfWeek(new Date(report.date), { weekStartsOn: 1 });
            end = endOfWeek(new Date(report.date), { weekStartsOn: 1 });
          } else if (report.type === 'monthly') {
            start = startOfMonth(new Date(report.date));
            end = endOfMonth(new Date(report.date));
          }
        }

        // Filter Todos
        const allTodos = todoStore.todos;
        const relevantTodos = allTodos.filter(t => {
          return t.dueDate >= start.getTime() && t.dueDate <= end.getTime();
        });

        const activities = chatStore.messages.filter(m =>
          m.timestamp >= start.getTime() && m.timestamp <= end.getTime() && m.type !== 'system' && m.mode === 'record'
        ).map(m => ({
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
          let start = report.startDate ? new Date(report.startDate) : startOfDay(new Date(report.date));
          let end = report.endDate ? new Date(report.endDate) : endOfDay(new Date(report.date));

          if (!report.startDate) {
            if (report.type === 'weekly') {
              start = startOfWeek(new Date(report.date), { weekStartsOn: 1 });
              end = endOfWeek(new Date(report.date), { weekStartsOn: 1 });
            } else if (report.type === 'monthly') {
              start = startOfMonth(new Date(report.date));
              end = endOfMonth(new Date(report.date));
            }
          }

          // 获取活动记录
          const activities = chatStore.messages.filter(m =>
            m.timestamp >= start.getTime() &&
            m.timestamp <= end.getTime() &&
            m.type !== 'system' &&
            m.mode === 'record'
          );

          // 获取待办统计
          const relevantTodos = todoStore.todos.filter(t =>
            t.dueDate >= start.getTime() && t.dueDate <= end.getTime()
          );
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
