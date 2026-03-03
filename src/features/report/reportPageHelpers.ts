import { endOfDay, startOfDay } from 'date-fns';
import type { Message } from '../../store/useChatStore';
import type { Report } from '../../store/useReportStore';
import type { Todo } from '../../store/useTodoStore';

export interface MoodDistributionItem {
  mood: string;
  minutes: number;
}

export function getReportRange(report: Report): { start: number; end: number } {
  return {
    start: report.startDate || startOfDay(new Date(report.date)).getTime(),
    end: report.endDate || endOfDay(new Date(report.date)).getTime(),
  };
}

export function getDailyMoodDistribution(
  messages: Message[],
  activityMood: Record<string, string>,
  report: Report | null
): MoodDistributionItem[] {
  if (!report || report.type !== 'daily') return [];

  const { start, end } = getReportRange(report);
  const moodMinutes: Record<string, number> = {};

  messages
    .filter(
      (m) =>
        m.timestamp >= start &&
        m.timestamp <= end &&
        m.mode === 'record' &&
        !m.isMood &&
        m.duration !== undefined
    )
    .forEach((m) => {
      const mood = activityMood[m.id];
      if (!mood) return;
      const minutes = m.duration || 0;
      moodMinutes[mood] = (moodMinutes[mood] || 0) + minutes;
    });

  return Object.entries(moodMinutes).map(([mood, minutes]) => ({
    mood,
    minutes,
  }));
}

export function getReportTodosInRange(todos: Todo[], report: Report): Todo[] {
  const { start, end } = getReportRange(report);
  return todos.filter((todo) => todo.dueDate >= start && todo.dueDate <= end);
}
