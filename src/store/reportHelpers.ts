import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { Message } from './useChatStore';
import type { Todo } from './useTodoStore';
import { moodKeyToLegacyLabel, normalizeMoodKey } from '../lib/moodOptions';

type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom';
type ActionCategory = '生存' | '连接与交互' | '成长与创造' | '修复与娱乐' | '巅峰体验' | '其他';

const FALLBACK_SUMMARY = '今天的你是一个很棒自己。';
const CUSTOM_MOOD_LABEL = '自定义';

const KEYWORDS: Record<Exclude<ActionCategory, '其他'>, string[]> = {
  生存: [
    '吃饭', '用餐', '餐', '午餐', '晚餐', '早餐', '睡', '睡觉', '小憩', '午休', '卫生', '洗澡', '刷牙', '如厕', '上厕所', '排泄',
    '工作', '上班', '打工', '谋生', '收入', '加班', '通勤', '地铁', '公交', '打车',
    '看病', '就医', '体检', '保险', '储蓄', '理财', '交房租', '交水电', '缴费',
    '打扫', '清洁', '扫地', '拖地', '收纳', '整理', '洗衣', '做饭', '买菜',
  ],
  连接与交互: [
    '家人', '父母', '孩子', '朋友', '同学', '聊天', '闲聊', '约会', '恋爱', '拥抱', '陪伴', '育儿',
    '沟通', '会议', '面谈', '讨论', '协作', '对接', '商务', '谈判',
    '聚会', '酒局', '发朋友圈', '社交媒体', '微博', '小红书', '点赞', '私信', '人情', '联络',
  ],
  成长与创造: [
    '学习', '读书', '阅读', '复盘', '复习', '上课', '课程', '作业', '考试', '备考', '练习', '刻意练习', '训练',
    '写作', '绘画', '画画', '设计', '编程', '开发', '产品', '发明', '创造', '深度思考', '笔记',
    '宗教', '信仰', '哲学', '志愿', '公益', '义工', '意义',
  ],
  修复与娱乐: [
    '短视频', '刷视频', '刷抖音', '刷快手', '追剧', '电影', '电视剧', '音乐', '听歌', '发呆',
    '旅行', '旅游', '出游', '游戏', '打游戏', '电竞', '运动', '跑步', '健身', '瑜伽', '看演出', '观演',
    '冥想', '正念', '心理', '咨询', '日记', '倾诉',
  ],
  巅峰体验: [
    '心流', '忘我', '沉浸', '人琴合一', '上头', '出神', '状态拉满',
    '登山', '攀登', '冲顶', '破 PB', '比赛夺冠',
    '婚礼', '结婚', '毕业典礼', '节日', '团聚', '庆典',
  ],
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
    const inDateRange = t.dueDate >= start.getTime() && t.dueDate <= end.getTime();
    if (!inDateRange) return false;
    if (type === 'weekly' && t.scope === 'monthly') return false;
    return true;
  });
}

export function classifyActivities(records: Message[]): { category: ActionCategory; minutes: number; percent: number }[] {
  const categories: ActionCategory[] = ['生存', '连接与交互', '成长与创造', '修复与娱乐', '巅峰体验', '其他'];
  const minutesByCategory: Record<ActionCategory, number> = {
    生存: 0,
    连接与交互: 0,
    成长与创造: 0,
    修复与娱乐: 0,
    巅峰体验: 0,
    其他: 0,
  };

  records.forEach((m) => {
    const content = m.content || '';
    const minutes = m.duration || 0;
    const match = (keywords: readonly string[]) => keywords.some((k) => content.includes(k));

    let category: ActionCategory = '其他';
    if (match(KEYWORDS.巅峰体验)) category = '巅峰体验';
    else if (match(KEYWORDS.成长与创造)) category = '成长与创造';
    else if (match(KEYWORDS.连接与交互)) category = '连接与交互';
    else if (match(KEYWORDS.修复与娱乐)) category = '修复与娱乐';
    else if (match(KEYWORDS.生存)) category = '生存';

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
  parts.push(`今天你的行动重心在「${top.category}」，约${Math.round(top.percent * 100)}%。`);
  if (second) parts.push(`其次是「${second.category}」，节奏平衡。`);

  if (top.category === '生存') parts.push('稳定打底很重要，你在打磨生活的地基。');
  if (top.category === '连接与交互') parts.push('好的人际让能量流动，你在建立支持与被支持。');
  if (top.category === '成长与创造') parts.push('稳稳向前，哪怕一点点，都是积累与突破。');
  if (top.category === '修复与娱乐') parts.push('适度放松是前进的缓冲区，恢复之后会更有劲。');
  if (top.category === '巅峰体验') parts.push('你触到了心流的边界，这份专注很珍贵。');

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
