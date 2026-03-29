// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/types/annotation.ts
import type { PendingTodoSummary, TodayActivity } from '../types/annotation';

interface SuggestionDetectorInput {
  now: Date;
  todayActivities: TodayActivity[];
  pendingTodos: PendingTodoSummary[];
  recentMoodMessages?: string[];
}

interface HintCandidate {
  priority: number;
  hint: string;
}

const NEGATIVE_MOOD_KEYWORDS = [
  'anxious', 'sad', 'angry', 'upset', 'stressed', 'burnout',
  '焦虑', '难过', '烦', '累', '崩溃',
];

function minutesSinceLastActivity(now: Date, todayActivities: TodayActivity[]): number {
  const last = todayActivities.at(-1);
  if (!last) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now.getTime() - last.timestamp) / 60000));
}

function isMealTime(hour: number): boolean {
  return (hour >= 11 && hour <= 13) || (hour >= 18 && hour <= 20);
}

function containsNegativeMood(recentMoodMessages: string[]): boolean {
  const joined = recentMoodMessages.join(' ').toLowerCase();
  return NEGATIVE_MOOD_KEYWORDS.some((kw) => joined.includes(kw));
}

function pickTopHints(candidates: HintCandidate[]): string[] {
  return candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2)
    .map((item) => item.hint);
}

export function detectSuggestionContextHints(input: SuggestionDetectorInput): string[] {
  const { now, todayActivities, pendingTodos, recentMoodMessages = [] } = input;
  const hour = now.getHours();
  const idleMinutes = minutesSinceLastActivity(now, todayActivities);

  const longFocusMinutes = todayActivities
    .filter((item) => item.activityType === 'work' || item.activityType === 'study')
    .reduce((sum, item) => sum + (item.duration || 0), 0);

  const entertainmentMinutes = todayActivities
    .filter((item) => item.activityType === 'entertainment')
    .reduce((sum, item) => sum + (item.duration || 0), 0);

  const overdueTodos = pendingTodos.filter((todo) => Boolean(todo.dueAt && todo.dueAt < now.getTime()));
  const dueSoonTodos = pendingTodos.filter((todo) => {
    if (!todo.dueAt) return false;
    const diff = todo.dueAt - now.getTime();
    return diff > 0 && diff <= 2 * 60 * 60 * 1000;
  });

  const candidates: HintCandidate[] = [];

  if (containsNegativeMood(recentMoodMessages)) {
    candidates.push({ priority: 100, hint: 'Strong negative mood signal is present. Prefer supportive and concrete next step suggestions.' });
  }
  if (dueSoonTodos.length > 0) {
    candidates.push({ priority: 90, hint: 'At least one todo is due soon. A small, immediate action can reduce pressure.' });
  }
  if (isMealTime(hour) && longFocusMinutes >= 120) {
    candidates.push({ priority: 80, hint: 'User has been focused for long duration near meal time. Consider food or hydration break suggestions.' });
  }
  if (hour >= 23 || hour <= 5) {
    candidates.push({ priority: 70, hint: 'Late-night context detected. Keep suggestions gentle and low-effort.' });
  }
  if (recentMoodMessages.length >= 2 && containsNegativeMood(recentMoodMessages.slice(-2))) {
    candidates.push({ priority: 65, hint: 'Repeated low mood appears in the latest messages. Encourage a short restorative action.' });
  }
  if (hour >= 14 && hour <= 17 && todayActivities.filter((item) => item.completed).length === 0) {
    candidates.push({ priority: 60, hint: 'Afternoon and no completed activity yet. Suggest a tiny starter task.' });
  }
  if (overdueTodos.length >= 2) {
    candidates.push({ priority: 55, hint: 'Multiple overdue todos are present. Suggest one concrete todo to regain momentum.' });
  }
  if (longFocusMinutes >= 180) {
    candidates.push({ priority: 50, hint: 'Long focus stretch detected. A short reset activity may be better than text-only encouragement.' });
  }
  if (entertainmentMinutes >= 180) {
    candidates.push({ priority: 40, hint: 'Entertainment duration is high today. Suggest one practical next step to rebalance.' });
  }
  if (idleMinutes >= 120) {
    candidates.push({ priority: 30, hint: 'Long idle gap detected. Suggest a very easy action to restart.' });
  }

  return pickTopHints(candidates);
}
