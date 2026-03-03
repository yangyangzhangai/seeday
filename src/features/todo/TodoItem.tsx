import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ArrowUp, CheckCircle, ChevronDown, ChevronUp, Circle, Edit2, Play, Repeat } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Priority, Todo } from '../../store/useTodoStore';

interface TodoItemProps {
  todo: Todo;
  activeTodoId: string | null;
  onToggleTodo: (id: string) => void | Promise<void>;
  onTogglePin: (id: string) => void | Promise<void>;
  onOpenEdit: (todo: Todo) => void;
  onStartTodo: (todo: Todo) => void | Promise<void>;
  getPriorityColor: (p: Priority) => string;
  getPriorityLabel: (p: Priority) => string;
  getCategoryLabel: (category: string) => string;
}

export function TodoItem({
  todo,
  activeTodoId,
  onToggleTodo,
  onTogglePin,
  onOpenEdit,
  onStartTodo,
  getPriorityColor,
  getPriorityLabel,
  getCategoryLabel,
}: TodoItemProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current && !isExpanded) {
        setIsOverflowing(textRef.current.scrollWidth > textRef.current.clientWidth);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [todo.content, isExpanded]);

  return (
    <div
      className={cn(
        'bg-white p-2 rounded-lg border flex items-start space-x-3 transition-all',
        todo.isPinned ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
      )}
    >
      <button onClick={() => onToggleTodo(todo.id)} className="mt-1 flex-shrink-0 text-gray-400 hover:text-blue-600">
        {todo.completed ? <CheckCircle className="text-green-500" size={20} /> : <Circle size={20} />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start">
          <p
            ref={textRef}
            className={cn(
              'text-sm font-medium text-gray-900 flex-1',
              todo.completed && 'line-through text-gray-400',
              !isExpanded && 'truncate'
            )}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {todo.content}
          </p>
          {isOverflowing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0 p-0.5"
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-2 items-center">
          <span className={cn('text-xs px-2 py-0.5 rounded border', getPriorityColor(todo.priority))}>
            {getPriorityLabel(todo.priority)}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
            {getCategoryLabel(todo.category)}
          </span>
          {todo.recurrence && todo.recurrence !== 'none' && (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1">
              <Repeat size={10} />
              {todo.recurrence === 'daily'
                ? t('recurrence_daily')
                : todo.recurrence === 'weekly'
                  ? t('recurrence_weekly')
                  : t('recurrence_monthly')}
            </span>
          )}
          <span className="text-xs text-gray-400 ml-auto">{format(todo.createdAt, 'MM-dd HH:mm')}</span>
        </div>
      </div>

      <div className="flex flex-col items-end space-y-1 flex-shrink-0">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onTogglePin(todo.id)}
            className={cn(
              'p-1 rounded transition-colors',
              todo.isPinned ? 'text-blue-600 bg-blue-100 hover:bg-blue-200' : 'text-gray-300 hover:text-blue-500 hover:bg-gray-50'
            )}
            title={todo.isPinned ? t('todo_unpin') : t('todo_pin')}
          >
            <ArrowUp size={18} />
          </button>
          {!todo.completed && (
            <button
              onClick={() => onStartTodo(todo)}
              className={cn(
                'p-1 rounded transition-colors',
                activeTodoId === todo.id
                  ? 'text-green-600 bg-green-100 hover:bg-green-200 animate-pulse'
                  : 'text-green-500 hover:text-green-600 hover:bg-green-50'
              )}
              title={activeTodoId === todo.id ? t('todo_in_progress') : t('todo_start')}
            >
              <Play size={18} fill={activeTodoId === todo.id ? 'currentColor' : 'none'} />
            </button>
          )}
          <button onClick={() => onOpenEdit(todo)} className="text-gray-300 hover:text-blue-500 p-1 hover:bg-gray-50 rounded">
            <Edit2 size={18} />
          </button>
        </div>
        {todo.completed && todo.duration !== undefined && (
          <span className="text-xs font-bold text-green-600">{t('todo_duration', { minutes: todo.duration })}</span>
        )}
      </div>
    </div>
  );
}
