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
import type { SupportedLang } from '../services/input/lexicon/getLexicon';
import type { Message } from './useChatStore';
import type { Todo } from './useTodoStore';
import { moodKeyToLegacyLabel, normalizeMoodKey } from '../lib/moodOptions';

type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom';
type ActionCategory = ActivityRecordType;

const CUSTOM_MOOD_LABEL = '自定义';

const FALLBACK_SUMMARY: Record<SupportedLang, string> = {
  zh: '今天的你是一个很棒自己。',
  en: 'You did great today.',
  it: 'Oggi hai fatto del tuo meglio.',
};

const ACTION_CATEGORY_LABELS: Record<SupportedLang, Record<ActionCategory, string>> = {
  zh: { study: '学习', work: '工作', social: '社交', life: '生活', entertainment: '娱乐', health: '健康' },
  en: { study: 'Study', work: 'Work', social: 'Social', life: 'Life', entertainment: 'Entertainment', health: 'Health' },
  it: { study: 'Studio', work: 'Lavoro', social: 'Sociale', life: 'Vita', entertainment: 'Intrattenimento', health: 'Salute' },
};

const ACTION_CATEGORY_ENCOURAGEMENT: Record<SupportedLang, Record<ActionCategory, string>> = {
  zh: {
    study: '稳稳向前，哪怕一点点，都是积累与突破。',
    work: '你在把事情一件件落地，执行力很扎实。',
    social: '好的人际让能量流动，你在建立支持与被支持。',
    life: '生活有序是长期状态的底座，你在打磨日常节奏。',
    entertainment: '适度放松是前进的缓冲区，恢复之后会更有劲。',
    health: '你在照顾身体和心理的边界，这份自我照护很重要。',
  },
  en: {
    study: 'Every step forward, no matter how small, is progress.',
    work: 'You are getting things done — solid execution.',
    social: 'Good connections keep energy flowing. You are building support.',
    life: 'An ordered life is the foundation of long-term wellbeing.',
    entertainment: 'Rest is a buffer for progress. You will come back stronger.',
    health: 'Taking care of your body and mind is always worth it.',
  },
  it: {
    study: 'Ogni passo avanti, per quanto piccolo, è un progresso.',
    work: 'Stai portando a termine le cose — esecuzione solida.',
    social: 'Le buone relazioni mantengono l\'energia in movimento.',
    life: 'Una vita ordinata è la base del benessere a lungo termine.',
    entertainment: 'Il riposo è un buffer per il progresso. Tornerai più forte.',
    health: 'Prendersi cura di corpo e mente vale sempre la pena.',
  },
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
    if (t.isTemplate) return false;
    const due = t.dueAt ?? t.createdAt;
    const inDateRange = due >= start.getTime() && due <= end.getTime();
    if (!inDateRange) return false;
    if (type === 'weekly' && t.scope === 'monthly') return false;
    return true;
  });
}

export function classifyActivities(
  records: Message[],
  lang: SupportedLang = 'zh',
): { category: ActionCategory; minutes: number; percent: number }[] {
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
    const normalized = normalizeActivityType(m.activityType, m.content, lang);
    const category: ActionCategory = normalized === 'mood'
      ? classifyRecordActivityType(m.content, lang).activityType
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
  lang: SupportedLang = 'zh',
): string {
  if (actionAnalysis.length === 0) return FALLBACK_SUMMARY[lang];

  const sorted = [...actionAnalysis].sort((a, b) => b.minutes - a.minutes);
  const top = sorted[0];
  const second = sorted[1];
  const labels = ACTION_CATEGORY_LABELS[lang];
  const encouragement = ACTION_CATEGORY_ENCOURAGEMENT[lang];

  const parts: string[] = [];
  if (lang === 'zh') {
    parts.push(`今天你的行动重心在「${labels[top.category]}」，约${Math.round(top.percent * 100)}%。`);
    if (second) parts.push(`其次是「${labels[second.category]}」，节奏平衡。`);
    parts.push(encouragement[top.category]);
    parts.push('继续保持这份诚实与投入，明天也会更好。');
  } else {
    parts.push(`Today your main focus was "${labels[top.category]}" (~${Math.round(top.percent * 100)}%).`);
    if (second) parts.push(`"${labels[second.category]}" followed — good balance.`);
    parts.push(encouragement[top.category]);
  }
  return clampText50(parts.join(' '));
}

// ── Daily todo stats ─────────────────────────────────────────

interface BottleInfo {
  id: string;
  name: string;
  type: 'habit' | 'goal';
  stars: number;
}

export interface HabitCheckinItem {
  bottleId: string;
  name: string;
  done: boolean;
  recurrence: string;
}

export interface GoalProgressItem {
  bottleId: string;
  bottleName: string;
  doneToday: boolean;
  currentStars: number;
}

export interface DailyTodoStats {
  habitCheckin: HabitCheckinItem[];
  goalProgress: GoalProgressItem[];
  independentRecurring: { completed: number; total: number };
  oneTimeTasks: {
    high: { completed: number; total: number };
    medium: { completed: number; total: number };
    low: { completed: number; total: number };
    completedTitles: string[];
  };
}

function normalizePriorityForReport(p: string): 'high' | 'medium' | 'low' {
  if (p === 'high' || p === 'urgent-important') return 'high';
  if (p === 'medium' || p === 'urgent-not-important' || p === 'important-not-urgent') return 'medium';
  return 'low';
}

export function computeDailyTodoStats(todos: Todo[], bottles: BottleInfo[], start: Date, end: Date): DailyTodoStats {
  const relevant = filterRelevantTodos(todos, start, end, 'daily');
  const bottleMap = new Map(bottles.map((b) => [b.id, b]));

  const bottled = relevant.filter((t) => t.bottleId && bottleMap.has(t.bottleId));
  const independent = relevant.filter((t) => !t.bottleId || !bottleMap.has(t.bottleId));

  const habitCheckin: HabitCheckinItem[] = bottled
    .filter((t) => bottleMap.get(t.bottleId!)?.type === 'habit')
    .map((t) => ({ bottleId: t.bottleId!, name: t.title, done: t.completed, recurrence: t.recurrence || 'once' }));

  const goalByBottle = new Map<string, boolean>();
  bottled
    .filter((t) => bottleMap.get(t.bottleId!)?.type === 'goal')
    .forEach((t) => {
      if (!goalByBottle.has(t.bottleId!)) goalByBottle.set(t.bottleId!, false);
      if (t.completed) goalByBottle.set(t.bottleId!, true);
    });
  const goalProgress: GoalProgressItem[] = Array.from(goalByBottle.entries()).map(([id, doneToday]) => {
    const b = bottleMap.get(id)!;
    return { bottleId: id, bottleName: b.name, doneToday, currentStars: b.stars };
  });

  const recurring = independent.filter((t) => t.recurrence && t.recurrence !== 'none' && t.recurrence !== 'once');
  const independentRecurring = { completed: recurring.filter((t) => t.completed).length, total: recurring.length };

  const onetime = independent.filter((t) => !t.recurrence || t.recurrence === 'none' || t.recurrence === 'once');
  const byP = (p: 'high' | 'medium' | 'low') => onetime.filter((t) => normalizePriorityForReport(t.priority) === p);
  const high = byP('high'), medium = byP('medium'), low = byP('low');
  const oneTimeTasks = {
    high: { completed: high.filter((t) => t.completed).length, total: high.length },
    medium: { completed: medium.filter((t) => t.completed).length, total: medium.length },
    low: { completed: low.filter((t) => t.completed).length, total: low.length },
    completedTitles: onetime.filter((t) => t.completed).map((t) => t.title).slice(0, 10),
  };

  return { habitCheckin, goalProgress, independentRecurring, oneTimeTasks };
}

export function generateMoodSummary(
  moodDistribution: { mood: string; minutes: number }[],
  lang: SupportedLang = 'zh',
): string {
  if (moodDistribution.length === 0) return FALLBACK_SUMMARY[lang];

  const totalMinutes = moodDistribution.reduce((acc, item) => acc + item.minutes, 0);
  const top = moodDistribution[0];
  const second = moodDistribution[1];

  const topMoodKey = normalizeMoodKey(top.mood);
  const secondMoodKey = second ? normalizeMoodKey(second.mood) : undefined;
  const topMoodLabel = topMoodKey ? moodKeyToLegacyLabel(topMoodKey) : top.mood;
  const secondMoodLabel = second ? (secondMoodKey ? moodKeyToLegacyLabel(secondMoodKey) : second.mood) : undefined;

  const parts: string[] = [];
  if (lang === 'zh') {
    parts.push(`今天你的情绪主色调是「${topMoodLabel}」，约${Math.round((top.minutes / totalMinutes) * 100)}%。`);
    if (secondMoodLabel) parts.push(`同时也有「${secondMoodLabel}」穿插其间，节奏自然。`);
    parts.push('谢谢你真诚地记录心情，每一步都不白费。愿你在照顾感受的同时，继续把自己放在第一位。');
  } else {
    parts.push(`Your main mood today was "${topMoodLabel}" (~${Math.round((top.minutes / totalMinutes) * 100)}%).`);
    if (secondMoodLabel) parts.push(`"${secondMoodLabel}" also weaved through — natural rhythm.`);
    parts.push('Thank you for recording your feelings honestly. Every step counts.');
  }
  return clampText50(parts.join(' '));
}
