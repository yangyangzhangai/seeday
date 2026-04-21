// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/types/annotation.ts
import type { PendingTodoSummary, TodayActivity } from '../types/annotation';

interface BuildStatusSummaryInput {
  now: Date;
  timezone?: string;
  todayActivities: TodayActivity[];
  pendingTodos: PendingTodoSummary[];
  recentMoodMessages?: string[];
}

interface BuildStatusSummaryResult {
  statusSummary: string;
  frequentActivities: string[];
}

function formatNow(now: Date, timezone?: string): string {
  const locale = 'en-US';
  return now.toLocaleString(locale, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours}h`;
  return `${hours}h${rest}m`;
}

function getFrequentActivities(todayActivities: TodayActivity[], limit: number): string[] {
  const counter = new Map<string, number>();
  for (const activity of todayActivities) {
    const key = activity.content.trim().toLowerCase();
    if (!key) continue;
    counter.set(key, (counter.get(key) ?? 0) + 1);
  }

  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([content]) => content);
}

export function buildStatusSummary(input: BuildStatusSummaryInput): BuildStatusSummaryResult {
  const { now, timezone, todayActivities, pendingTodos, recentMoodMessages = [] } = input;
  const currentTime = formatNow(now, timezone);

  const recentActivities = todayActivities
    .slice(-2)
    .map((item) => `${item.content} (${formatMinutes(item.duration || 0)})`)
    .join(' -> ') || 'none';

  const totalDuration = todayActivities.reduce((sum, item) => sum + (item.duration || 0), 0);
  const completedCount = todayActivities.filter((item) => item.completed).length;

  const moodText = recentMoodMessages
    .slice(-2)
    .map((text) => text.trim())
    .filter(Boolean)
    .join(' / ') || 'stable or unknown';

  const dueTodayCount = pendingTodos.filter((todo) => {
    if (!todo.dueAt) return false;
    const dueDate = new Date(todo.dueAt);
    return dueDate.toDateString() === now.toDateString();
  }).length;

  const frequentActivities = getFrequentActivities(todayActivities, 3);
  const frequentText = frequentActivities.join(', ') || 'none';

  const statusSummary = [
    `Current time: ${currentTime}`,
    `Recent activities: ${recentActivities}`,
    `Today overview: ${todayActivities.length} activities, ${formatMinutes(totalDuration)}, ${completedCount} completed`,
    `Recent mood: ${moodText}`,
    `Todo snapshot: ${pendingTodos.length} open, ${dueTodayCount} due today`,
    `Frequent activities: ${frequentText}`,
  ].join('\n');

  return {
    statusSummary,
    frequentActivities,
  };
}
