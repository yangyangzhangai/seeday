import { v4 as uuidv4 } from 'uuid';
import { eachDayOfInterval, format, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale/zh-CN';
import { supabase } from '../api/supabase';
import { callClassifierAPI, callDiaryAPI, callReportAPI } from '../api/client';
import { computeAll, formatForDiaryAI, type ComputedResult, type MoodRecord } from '../lib/reportCalculator';
import { getSupabaseSession } from '../lib/supabase-utils';
import { toDbReport } from '../lib/dbMappers';
import i18n from '../i18n';
import { useAuthStore } from './useAuthStore';
import {
  classifyActivities,
  computeMoodDistribution,
  filterActivities,
  filterRelevantTodos,
  generateActionSummary,
  generateMoodSummary,
  getDateRange,
} from './reportHelpers';
import type { Message } from './useChatStore.types';
import type { Todo } from './useTodoStore';
import type { Report, ReportStats } from './useReportStore';

type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom';

interface MoodStoreSnapshot {
  moodNote: Record<string, string>;
  activityMood: Record<string, string | undefined>;
  customMoodLabel: Record<string, string | undefined>;
  customMoodApplied?: Record<string, boolean | undefined>;
}

interface GenerateReportInput {
  type: ReportType;
  date: number;
  customEndDate?: number;
  todos: Todo[];
  messages: Message[];
  moodStore: MoodStoreSnapshot;
}

export function createGeneratedReport({
  type,
  date,
  customEndDate,
  todos,
  messages,
  moodStore,
}: GenerateReportInput): Report {
  const targetDate = new Date(date);
  const isToday = isSameDay(targetDate, new Date());
  const { start, end, title } = getDateRange(type, date, customEndDate);
  const relevantTodos = filterRelevantTodos(todos, start, end, type);
  const total = relevantTodos.length;
  const completed = relevantTodos.filter((todo) => todo.completed).length;

  const stats: ReportStats = {
    completedTodos: completed,
    totalTodos: total,
    completionRate: total > 0 ? completed / total : 0,
    priorityStats: [],
    recurringStats: [],
    dailyCompletion: [],
  };

  const priorities = ['urgent-important', 'urgent-not-important', 'important-not-urgent', 'not-important-not-urgent'];
  stats.priorityStats = priorities.map((priority) => {
    const todosByPriority = relevantTodos.filter((todo) => todo.priority === priority);
    return {
      priority,
      count: todosByPriority.length,
      completed: todosByPriority.filter((todo) => todo.completed).length,
    };
  });

  if (type === 'daily') {
    stats.recurringStats = relevantTodos
      .filter((todo) => todo.recurrence && todo.recurrence !== 'none' && todo.recurrence !== 'once')
      .map((todo) => ({
        name: todo.title,
        completed: todo.completed,
      }));

    if (!isToday) {
      const records = filterActivities(messages, start, end, { requireDuration: true });
      const currentLang = (i18n.language?.split('-')[0] || 'zh') as 'zh' | 'en' | 'it';
      const actionAnalysis = classifyActivities(records, currentLang);
      stats.actionAnalysis = actionAnalysis;
      stats.actionSummary = generateActionSummary(actionAnalysis);
    }
  } else {
    const recurringGroups: Record<string, Todo[]> = {};
    relevantTodos
      .filter((todo) => todo.recurrence && todo.recurrence !== 'none' && todo.recurrence !== 'once')
      .forEach((todo) => {
        const key = todo.recurrenceId || todo.title;
        if (!recurringGroups[key]) recurringGroups[key] = [];
        recurringGroups[key].push(todo);
      });

    stats.recurringStats = Object.values(recurringGroups).map((group) => {
      const completedCount = group.filter((todo) => todo.completed).length;
      return {
        name: group[0].title,
        completed: false,
        count: completedCount,
        total: group.length,
        rate: group.length > 0 ? completedCount / group.length : 0,
      };
    });

    const days = eachDayOfInterval({ start, end });
    stats.dailyCompletion = days.map((day) => {
      const dayTodos = relevantTodos.filter((todo) => isSameDay(todo.dueAt ?? todo.createdAt, day));
      const dayCompleted = dayTodos.filter((todo) => todo.completed).length;
      return {
        date: format(day, 'MM-dd'),
        completed: dayCompleted,
        total: dayTodos.length,
        rate: dayTodos.length > 0 ? dayCompleted / dayTodos.length : 0,
      };
    });
  }

  stats.moodDistribution = computeMoodDistribution(messages, moodStore, start, end);

  if (!isToday) {
    stats.moodSummary = generateMoodSummary(stats.moodDistribution || []);
  }

  return {
    id: uuidv4(),
    title,
    date,
    startDate: start.getTime(),
    endDate: end.getTime(),
    type,
    content: 'Generated report',
    stats,
    aiAnalysis: null,
    analysisStatus: 'idle',
    errorMessage: null,
  };
}

export function mergeReportIntoList(reports: Report[], type: ReportType, date: number, newReport: Report): Report[] {
  return [...reports.filter((report) => !(report.type === type && isSameDay(report.date, date))), newReport];
}

export async function syncReportToSupabase(report: Report): Promise<void> {
  const session = await getSupabaseSession();

  if (!session) return;

  const { error } = await supabase.from('reports').insert([toDbReport(report, session.user.id)]);

  if (error) {
    console.error('Error syncing new report to Supabase:', error);
  }
}

export async function runReportAIAnalysis(report: Report, todos: Todo[], messages: Message[]): Promise<string> {
  const range = getDateRange(report.type, report.date, report.endDate);
  const start = report.startDate ? new Date(report.startDate) : range.start;
  const end = report.endDate ? new Date(report.endDate) : range.end;
  const relevantTodos = filterRelevantTodos(todos, start, end, report.type);
  const activities = filterActivities(messages, start, end).map((message) => ({
    time: format(message.timestamp, 'MM-dd HH:mm'),
    content: message.content,
    duration: message.duration || 0,
  }));

  return callReportAPI({
    data: {
      date: format(start, 'yyyy-MM-dd') + (report.type !== 'daily' ? ` 至 ${format(end, 'yyyy-MM-dd')}` : ''),
      todos: relevantTodos,
      activities,
      stats: report.stats,
    },
    type: report.type === 'custom' ? 'daily' : report.type,
  });
}

interface TimeshineResult {
  content: string;
  computed: ComputedResult;
}

interface RunTimeshineDiaryInput {
  report: Report;
  todos: Todo[];
  messages: Message[];
  moodStore: MoodStoreSnapshot;
  computedHistory: ComputedResult[];
}

export async function runTimeshineDiary({
  report,
  todos,
  messages,
  moodStore,
  computedHistory,
}: RunTimeshineDiaryInput): Promise<TimeshineResult> {
  const range = getDateRange(report.type, report.date, report.endDate);
  const start = report.startDate ? new Date(report.startDate) : range.start;
  const end = report.endDate ? new Date(report.endDate) : range.end;

  const activities = filterActivities(messages, start, end);
  const relevantTodos = filterRelevantTodos(todos, start, end, report.type);
  const completedTodos = relevantTodos.filter((todo) => todo.completed).length;
  const totalTodos = relevantTodos.length;

  const moodMessages = messages.filter(
    (message) =>
      message.timestamp >= start.getTime() &&
      message.timestamp <= end.getTime() &&
      message.isMood === true
  );

  const moodRecords: MoodRecord[] = moodMessages.map((message) => {
    const hour = new Date(message.timestamp).getHours();
    return {
      time: format(message.timestamp, 'HH:mm'),
      time_slot: hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening',
      content: message.content,
    };
  });

  const currentLang = (i18n.language?.split('-')[0] || 'en') as 'zh' | 'en' | 'it';
  const isZh = currentLang === 'zh';
  const rawInput = buildRawInput(activities, moodMessages, moodStore.moodNote, completedTodos, totalTodos, isZh);

  console.log('[Timeshine] Step 1: 调用分类器...');
  const classifyResult = await callClassifierAPI({ rawInput, lang: currentLang });
  if (!classifyResult.success || !classifyResult.data) {
    throw new Error('分类器返回数据失败');
  }

  console.log('[Timeshine] Step 2: 计算层处理...');
  const computed = computeAll(classifyResult.data, computedHistory);
  computed.mood_records = moodRecords;
  const structuredData = formatForDiaryAI(computed, currentLang);

  const reportNumber = computedHistory.length + 1;
  const metaTitle = isZh ? `手记编号：第 ${reportNumber} 号\n\n` : `Report No. ${reportNumber}\n\n`;
  const structuredDataWithMeta = metaTitle + structuredData;

  let historyContext: string | undefined;
  if (computedHistory.length > 0) {
    historyContext = buildHistoryContext(computedHistory, isZh);
  }

  console.log('[Timeshine] Step 3: 生成观察手记...');
  const currentUser = useAuthStore.getState().user;
  const userNickname = currentUser?.user_metadata?.display_name || undefined;

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

  return {
    content: diaryResult.content,
    computed,
  };
}

function buildRawInput(
  activities: Message[],
  moodMessages: Message[],
  moodNotes: Record<string, string>,
  completedTodos: number,
  totalTodos: number,
  isZh: boolean
): string {
  const rawInputLines: string[] = [];
  rawInputLines.push(isZh ? '今天的时间记录：' : "Today's Time Log:");

  activities.forEach((message) => {
    const timeStr = format(message.timestamp, 'HH:mm');
    const durationStr = message.duration ? (isZh ? ` (${message.duration}分钟)` : ` (${message.duration}min)`) : '';
    rawInputLines.push(`- ${timeStr} ${message.content}${durationStr}`);

    const note = moodNotes[message.id];
    if (note && note.trim()) {
      rawInputLines.push(`  心情记录：${note.trim()}`);
    }
  });

  if (moodMessages.length > 0) {
    rawInputLines.push('');
    rawInputLines.push(isZh ? '心情与能量状态记录：' : 'Mood and Energy Log:');
    moodMessages.forEach((message) => {
      const timeStr = format(message.timestamp, 'HH:mm');
      rawInputLines.push(`- ${timeStr} [${isZh ? '状态/心情' : 'Mood/Energy'}] ${message.content}`);
    });
  }

  rawInputLines.push('');
  rawInputLines.push(
    isZh
      ? `待办：完成${completedTodos}件，共${totalTodos}件`
      : `Todos: Completed ${completedTodos}, Total ${totalTodos}`
  );

  return rawInputLines.join('\n');
}

function buildHistoryContext(history: ComputedResult[], isZh: boolean): string {
  const recent = history.slice(-3);
  const contextLines: string[] = [
    isZh ? `过去${recent.length}天观察摘要：` : `Past ${recent.length} days summary:`,
  ];

  recent.forEach((item, index) => {
    const focusItem = item.spectrum.find((spectrum) => spectrum.category === 'deep_focus');
    const dayIndex = history.length - recent.length + index + 1;
    const focusStr = focusItem?.duration_str || '0';
    const todoStr = item.light_quality.todo_str;

    if (isZh) {
      contextLines.push(`  第${dayIndex}日：专注${focusStr}，待办${todoStr}`);
    } else {
      contextLines.push(`  Day ${dayIndex}: Focus ${focusStr}, Todo ${todoStr}`);
    }
  });

  return contextLines.join('\n');
}
