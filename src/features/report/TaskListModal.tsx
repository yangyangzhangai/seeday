import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Circle, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { APP_MODAL_CARD_CLASS, APP_MODAL_CLOSE_CLASS, APP_MODAL_OVERLAY_CLASS } from '../../lib/modalTheme';
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
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center p-4', APP_MODAL_OVERLAY_CLASS)}>
      <div className={cn(APP_MODAL_CARD_CLASS, 'w-full max-w-md rounded-3xl p-6 max-h-[70vh] flex flex-col animate-in zoom-in-95 fade-in')}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-800">
            {showTaskList === 'completed' ? t('report_completed_tasks') : t('report_all_tasks')}
          </h2>
          <button onClick={onClose} className={cn(APP_MODAL_CLOSE_CLASS, 'p-1')}>
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {displayTodos.length === 0 ? (
            <div className="text-center text-slate-400 py-8">{t('report_no_tasks')}</div>
          ) : (
            displayTodos.map((todo) => (
              <div key={todo.id} className="flex items-center p-3 bg-white/85 rounded-xl border border-white/70">
                <div className={cn('mr-3', todo.completed ? 'text-green-500' : 'text-gray-300')}>
                  {todo.completed ? <CheckCircle size={20} /> : <Circle size={20} />}
                </div>
                <div className="flex-1">
                  <div className={cn('text-sm font-medium', todo.completed && 'line-through text-gray-400')}>
                    {todo.title}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {format(todo.dueAt ?? todo.createdAt, 'MM-dd')} · {todo.category ?? ''}
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
