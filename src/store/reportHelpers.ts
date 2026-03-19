import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  classifyRecordActivityType,
  normalizeActivityType,
  type ActivityRecordType,
} from '../lib/activityType';
import type { Message } from './useChatStore';
import type { Todo } from './useTodoStore';
import { moodKeyToLegacyLabel, normalizeMoodKey } from '../lib/moodOptions';

type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom';
type ActionCategory = ActivityRecordType;

const FALLBACK_SUMMARY = '今天的你是一个很棒自己。';
const CUSTOM_MOOD_LABEL = '自定义';

const ACTION_CATEGORY_LABELS: Record<ActionCategory, string> = {
  study: '学习',
  work: '工作',
  social: '社交',
  life: '生活',
  entertainment: '娱乐',
  health: '健康',
};

const ACTION_CATEGORY_ENCOURAGEMENT: Record<ActionCategory, string> = {
  study: '稳稳向前，哪怕一点点，都是积累与突破。',
  work: '你在把事情一件件落地，执行力很扎实。',
  social: '好的人际让能量流动，你在建立支持与被支持。',
  life: '生活有序是长期状态的底座，你在打磨日常节奏。',
  entertainment: '适度放松是前进的缓冲区，恢复之后会更有劲。',
  health: '你在照顾身体和心理的边界，这份自我照护很重要。',
};

function clampText50(s: string): string {
  if (!s) return s;
  const chars = Array.from(s);
  if (chars.length <= 50) return s;
  return chars.slice(0, 50).join('');
}

export function getDateRange(type: ReportType, date: number, customEndDate?: number): { start: Date; end: Date; title: string } {
  const targetDate = new Date(date);

  if (type === 'daily') {
    const start = startOfDay(targetDate);
    const end = endOfDay(targetDate);
    return { start, end, title: `${format(targetDate, 'yyyy-MM-dd')} 日报` };
  }

  if (type === 'weekly') {
    const start = startOfWeek(targetDate, { weekStartsOn: 1 });
    const end = endOfWeek(targetDate, { weekStartsOn: 1 });
    return { start, end, title: `${format(start, 'MM-dd')} 至 ${format(end, 'MM-dd')} 周报` };
  }

  if (type === 'monthly') {
    const start = startOfMonth(targetDate);
    const end = endOfMonth(targetDate);
    return { start, end, title: `${format(targetDate, 'yyyy-MM')} 月报` };
  }

  if (type === 'custom' && customEndDate) {
    const start = startOfDay(targetDate);
    const end = endOfDay(new Date(customEndDate));
    return { start, end, title: `${format(start, 'yyyy-MM-dd')} 至 ${format(end, 'yyyy-MM-dd')} 定制报告` };
  }

  const start = startOfDay(targetDate);
  const end = endOfDay(targetDate);
  return { start, end, title: '定制报告' };
}

export function filterActivities(
  messages: Message[],
  start: Date,
  end: Date,
  options?: { requireDuration?: boolean },
): Message[] {
  return messages.filter((m) => {
    if (m.timestamp < start.getTime() || m.timestamp > end.getTime()) return false;
    if (m.type === 'system') return false;
    if (m.mode !== 'record') return false;
    if (m.isMood) return false;
    if (options?.requireDuration && (m.duration === undefined || m.duration <= 0)) return false;
    return true;
  });
}

export function filterRelevantTodos(todos: Todo[], start: Date, end: Date, type: ReportType): Todo[] {
  return todos.filter((t) => {
    const due = t.dueAt ?? t.createdAt;
    const inDateRange = due >= start.getTime() && due <= end.getTime();
    if (!inDateRange) return false;
    if (type === 'weekly' && t.scope === 'monthly') return false;
    return true;
  });
}

export function classifyActivities(records: Message[]): { category: ActionCategory; minutes: number; percent: number }[] {
  const categories: ActionCategory[] = ['study', 'work', 'social', 'life', 'entertainment', 'health'];
  const minutesByCategory: Record<ActionCategory, number> = {
    study: 0,
    work: 0,
    social: 0,
    life: 0,
    entertainment: 0,
    health: 0,
  };

  records.forEach((m) => {
    const minutes = m.duration || 0;
    const normalized = normalizeActivityType(m.activityType, m.content);
    const category: ActionCategory = normalized === 'chat' || normalized === 'mood'
      ? classifyRecordActivityType(m.content).activityType
      : normalized;
    minutesByCategory[category] += minutes;
  });

  const totalMinutes = Object.values(minutesByCategory).reduce((acc, n) => acc + n, 0);
  if (totalMinutes <= 0) return [];

  return categories
    .map((category) => ({
      category,
      minutes: minutesByCategory[category],
      percent: minutesByCategory[category] / totalMinutes,
    }))
    .filter((entry) => entry.minutes > 0);
}

export function computeMoodDistribution(
  messages: Message[],
  moodStore: {
    activityMood: Record<string, string | undefined>;
    customMoodLabel: Record<string, string | undefined>;
    customMoodApplied?: Record<string, boolean | undefined>;
  },
  start: Date,
  end: Date,
): { mood: string; minutes: number }[] {
  const moodMinutes: Record<string, number> = {};

  filterActivities(messages, start, end, { requireDuration: false }).forEach((m) => {
    const baseMood = moodStore.activityMood[m.id];
    const customLabel = moodStore.customMoodLabel[m.id];
    const useCustom = moodStore.customMoodApplied?.[m.id] === true;
    const mood = useCustom && customLabel && customLabel.trim() && customLabel.trim() !== CUSTOM_MOOD_LABEL
      ? customLabel.trim()
      : baseMood;

    if (!mood) return;

    const minutes = m.duration || 0;
    moodMinutes[mood] = (moodMinutes[mood] || 0) + minutes;
  });

  return Object.entries(moodMinutes)
    .map(([mood, minutes]) => ({ mood, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

export function generateActionSummary(
  actionAnalysis: { category: ActionCategory; minutes: number; percent: number }[],
): string {
  if (actionAnalysis.length === 0) return FALLBACK_SUMMARY;

  const sorted = [...actionAnalysis].sort((a, b) => b.minutes - a.minutes);
  const top = sorted[0];
  const second = sorted[1];

  const parts: string[] = [];
  parts.push(`今天你的行动重心在「${ACTION_CATEGORY_LABELS[top.category]}」，约${Math.round(top.percent * 100)}%。`);
  if (second) parts.push(`其次是「${ACTION_CATEGORY_LABELS[second.category]}」，节奏平衡。`);
  parts.push(ACTION_CATEGORY_ENCOURAGEMENT[top.category]);

  parts.push('继续保持这份诚实与投入，明天也会更好。');
  return clampText50(parts.join(''));
}

export function generateMoodSummary(moodDistribution: { mood: string; minutes: number }[]): string {
  if (moodDistribution.length === 0) return FALLBACK_SUMMARY;

  const totalMinutes = moodDistribution.reduce((acc, item) => acc + item.minutes, 0);
  const top = moodDistribution[0];
  const second = moodDistribution[1];

  const parts: string[] = [];
  const topMoodKey = normalizeMoodKey(top.mood);
  const secondMoodKey = second ? normalizeMoodKey(second.mood) : undefined;
  const topMoodLabel = topMoodKey ? moodKeyToLegacyLabel(topMoodKey) : top.mood;
  const secondMoodLabel = second ? (secondMoodKey ? moodKeyToLegacyLabel(secondMoodKey) : second.mood) : undefined;

  parts.push(`今天你的情绪主色调是「${topMoodLabel}」，约${Math.round((top.minutes / totalMinutes) * 100)}%。`);
  if (secondMoodLabel) parts.push(`同时也有「${secondMoodLabel}」穿插其间，节奏自然。`);
  parts.push('谢谢你真诚地记录心情，每一步都不白费。愿你在照顾感受的同时，继续把自己放在第一位。');

  return clampText50(parts.join(''));
}
