import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Circle, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import type { Report } from '../../store/useReportStore';
import type { Todo } from '../../store/useTodoStore';
import { getReportTodosInRange } from './reportPageHelpers';

interface TaskListModalProps {
  showTaskList: 'completed' | 'total' | null;
  selectedReport: Report | null;
  todos: Todo[];
  onClose: () => void;
}

export const TaskListModal: React.FC<TaskListModalProps> = ({
  showTaskList,
  selectedReport,
  todos,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!showTaskList || !selectedReport) return null;

  const reportTodos = getReportTodosInRange(todos, selectedReport);
  const displayTodos = showTaskList === 'completed'
    ? reportTodos.filter((todo) => todo.completed)
    : reportTodos;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 max-h-[70vh] flex flex-col animate-in zoom-in-95 fade-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">
            {showTaskList === 'completed' ? t('report_completed_tasks') : t('report_all_tasks')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {displayTodos.length === 0 ? (
            <div className="text-center text-gray-400 py-8">{t('report_no_tasks')}</div>
          ) : (
            displayTodos.map((todo) => (
              <div key={todo.id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                <div className={cn('mr-3', todo.completed ? 'text-green-500' : 'text-gray-300')}>
                  {todo.completed ? <CheckCircle size={20} /> : <Circle size={20} />}
                </div>
                <div className="flex-1">
                  <div className={cn('text-sm font-medium', todo.completed && 'line-through text-gray-400')}>
                    {todo.title}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {todo.dueAt ? format(todo.dueAt, 'MM-dd') : '--'} · {todo.category || ''}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
