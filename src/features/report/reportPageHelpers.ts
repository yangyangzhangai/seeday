import { endOfDay, startOfDay } from 'date-fns';
import type { Message } from '../../store/useChatStore';
import type { Report } from '../../store/useReportStore';
import type { Todo } from '../../store/useTodoStore';
import type { ActivityRecordType } from '../../lib/activityType';
import { ACTIVITY_RECORD_TYPES } from '../../lib/activityType';
import { normalizeMoodKey } from '../../lib/moodOptions';

export interface ActivityDistributionItem {
  type: ActivityRecordType;
  minutes: number;
}

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

export function getDailyActivityDistribution(
  messages: Message[],
  report: Report | null,
): ActivityDistributionItem[] {
  if (!report || report.type !== 'daily') return [];

  const { start, end } = getReportRange(report);
  const typeMinutes: Partial<Record<ActivityRecordType, number>> = {};

  messages
    .filter(
      (m) =>
        m.timestamp >= start &&
        m.timestamp <= end &&
        m.mode === 'record' &&
        !m.isMood &&
        m.activityType &&
        ACTIVITY_RECORD_TYPES.includes(m.activityType as ActivityRecordType) &&
        m.duration !== undefined &&
        m.duration > 0
    )
    .forEach((m) => {
      const type = m.activityType as ActivityRecordType;
      typeMinutes[type] = (typeMinutes[type] || 0) + (m.duration || 0) / 60;
    });

  return (Object.entries(typeMinutes) as [ActivityRecordType, number][])
    .map(([type, minutes]) => ({ type, minutes }))
    .filter((d) => d.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

/** Compute activity distribution from pre-filtered messages (no report needed). */
export function computeActivityDistribution(messages: Message[]): ActivityDistributionItem[] {
  const typeMinutes: Partial<Record<ActivityRecordType, number>> = {};
  messages
    .filter(
      (m) =>
        m.mode === 'record' &&
        !m.isMood &&
        m.activityType &&
        ACTIVITY_RECORD_TYPES.includes(m.activityType as ActivityRecordType) &&
        m.duration !== undefined &&
        m.duration > 0
    )
    .forEach((m) => {
      const type = m.activityType as ActivityRecordType;
      typeMinutes[type] = (typeMinutes[type] || 0) + (m.duration || 0) / 60;
    });
  return (Object.entries(typeMinutes) as [ActivityRecordType, number][])
    .map(([type, minutes]) => ({ type, minutes }))
    .filter((d) => d.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

export interface MoodEnergyPoint {
  timestamp: number;
  energy: number;
  mood: string;
}

const MOOD_ENERGY_SCORE: Record<string, number> = {
  happy: 5, focused: 5, calm: 4, satisfied: 4,
  tired: 2, bored: 2, anxious: 1, down: 1,
};

/** Compute mood distribution from pre-filtered messages (no report needed). */
export function computeMoodDistribution(
  messages: Message[],
  activityMood: Record<string, string>,
): MoodDistributionItem[] {
  const moodMinutes: Record<string, number> = {};
  messages
    .filter(m => m.mode === 'record' && !m.isMood && m.duration !== undefined)
    .forEach(m => {
      const mood = activityMood[m.id];
      if (!mood) return;
      moodMinutes[mood] = (moodMinutes[mood] || 0) + (m.duration || 0);
    });
  return Object.entries(moodMinutes).map(([mood, minutes]) => ({ mood, minutes }));
}

/** Compute chronological mood energy points for a timeline chart. */
export function computeMoodEnergyTimeline(
  messages: Message[],
  activityMood: Record<string, string>,
): MoodEnergyPoint[] {
  return messages
    .filter(m => m.mode === 'record' && !m.isMood && activityMood[m.id])
    .map(m => {
      const key = normalizeMoodKey(activityMood[m.id]) ?? 'calm';
      return { timestamp: m.timestamp, energy: MOOD_ENERGY_SCORE[key] ?? 3, mood: activityMood[m.id] };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function getReportTodosInRange(todos: Todo[], report: Report): Todo[] {
  const { start, end } = getReportRange(report);
  return todos.filter((todo) => {
    const due = todo.dueAt ?? todo.createdAt;
    return due >= start && due <= end;
  });
}
