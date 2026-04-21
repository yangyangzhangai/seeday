import {
  type ClassifiedData,
  type ClassifiedItem,
  type ComputedResult,
} from './types';
import { classifyRecordActivityType } from '../activityType';

export function parseClassifierResponse(raw: string): ClassifiedData {
  try {
    return JSON.parse(raw.trim()) as ClassifiedData;
  } catch {
    // keep fallback flow
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]) as ClassifiedData;
    } catch {
      // keep fallback flow
    }
  }

  console.warn('⚠️ 分类器输出无法解析，返回空结构');
  return {
    total_duration_min: 0,
    items: [],
    todos: { completed: 0, total: 0 },
    energy_log: [],
  };
}

export function minutesToDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function computeFocusMinutes(items: ClassifiedItem[]): number {
  return items.reduce((sum, item) => {
    const type = classifyRecordActivityType(item.name).activityType;
    if (type !== 'study' && type !== 'work') {
      return sum;
    }
    return sum + (item.duration_min || 0);
  }, 0);
}

export function computeAll(
  classifiedJson: ClassifiedData,
  _history: ComputedResult[] | null = null,
  _lang: 'zh' | 'en' | 'it' = 'zh',
): ComputedResult {
  const items = classifiedJson.items || [];
  const totalMin = classifiedJson.total_duration_min || 0;
  const todos = classifiedJson.todos || { completed: 0, total: 0 };

  return {
    total_duration_str: minutesToDisplay(totalMin),
    focus_duration_min: computeFocusMinutes(items),
    todo_completed: todos.completed || 0,
    todo_total: todos.total || 0,
    raw_items: items,
  };
}
