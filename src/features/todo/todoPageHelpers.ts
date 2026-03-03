import type { TFunction } from 'i18next';
import { startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import type { Priority, Todo } from '../../store/useTodoStore';

export type TodoFilter = 'daily' | 'weekly' | 'monthly';

const PRIORITY_ORDER: Record<Priority, number> = {
  'urgent-important': 1,
  'important-not-urgent': 2,
  'urgent-not-important': 3,
  'not-important-not-urgent': 4,
};

export function filterTodosByScopeAndVisibility(todos: Todo[], filter: TodoFilter): Todo[] {
  return todos.filter((todo) => {
    const scope = todo.scope || 'daily';
    if (scope !== filter) return false;

    if (!todo.completed) return true;

    const completedDate = todo.completedAt ? new Date(todo.completedAt) : new Date(0);
    const now = new Date();

    if (filter === 'daily') {
      return completedDate >= startOfDay(now);
    }

    if (filter === 'weekly') {
      return completedDate >= startOfWeek(now, { weekStartsOn: 1 });
    }

    return completedDate >= startOfMonth(now);
  });
}

export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    const priorityCompare = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityCompare !== 0) return priorityCompare;

    return b.createdAt - a.createdAt;
  });
}

export function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case 'urgent-important':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'urgent-not-important':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'important-not-urgent':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'not-important-not-urgent':
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

export function getPriorityLabel(priority: Priority, t: TFunction): string {
  switch (priority) {
    case 'urgent-important':
      return t('priority_urgent_important');
    case 'urgent-not-important':
      return t('priority_urgent_not_important');
    case 'important-not-urgent':
      return t('priority_important_not_urgent');
    case 'not-important-not-urgent':
      return t('priority_not_important_not_urgent');
  }
}
