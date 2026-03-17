import { useTranslation } from 'react-i18next';
import { AlarmClock, Check, Play, GripVertical, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { type GrowthTodo, type GrowthPriority } from '../../store/useGrowthTodoStore';

// Re-export for consumers
export type { GrowthTodo, GrowthPriority };

interface Props {
  todo: GrowthTodo;
  onToggle: (id: string) => void;
  onFocus: (todo: GrowthTodo) => void;
  onStart?: (todo: GrowthTodo) => void;
  onDelete?: (id: string) => void;
}

const priorityConfig: Record<GrowthPriority, { color: string; bg: string }> = {
  high: { color: 'text-red-600', bg: 'bg-red-100' },
  medium: { color: 'text-orange-600', bg: 'bg-orange-100' },
  low: { color: 'text-green-600', bg: 'bg-green-100' },
};

export const GrowthTodoCard = ({ todo, onToggle, onFocus, onStart, onDelete }: Props) => {
  const { t } = useTranslation();
  const cfg = priorityConfig[todo.priority];

  const dueStr = todo.dueAt
    ? new Date(todo.dueAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;

  const isOverdue = todo.dueAt && !todo.completed && todo.dueAt < Date.now();

  return (
    <div className={cn(
      "group relative flex items-center gap-2 bg-white rounded-xl p-3 border border-gray-100 shadow-sm",
      todo.completed && "opacity-50"
    )}>
      {/* Delete button — appears on hover */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(todo.id); }}
          className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 bg-gray-400 hover:bg-red-500 text-white rounded-full items-center justify-center transition-colors hidden group-hover:flex"
          title={t('delete')}
        >
          <X size={10} />
        </button>
      )}

      {/* Drag handle */}
      <GripVertical size={14} className="text-gray-300 flex-shrink-0 cursor-grab" />

      {/* Checkbox */}
      <button
        onClick={() => onToggle(todo.id)}
        className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
          todo.completed ? "bg-blue-500 border-blue-500" : "border-gray-300"
        )}
      >
        {todo.completed && <Check size={12} className="text-white" />}
      </button>

      {/* Title + due date */}
      <div className="flex-1 min-w-0">
        <span className={cn("text-sm block truncate", todo.completed && "line-through text-gray-400")}>
          {todo.title}
        </span>
        {dueStr && (
          <span className={cn("text-[10px]", isOverdue ? "text-red-500" : "text-gray-400")}>
            {dueStr}
          </span>
        )}
      </div>

      {/* Priority badge */}
      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0", cfg.color, cfg.bg)}>
        {t(`growth_todo_priority_${todo.priority}`)}
      </span>

      {/* Action buttons */}
      {!todo.completed && (
        <>
          {onStart && (
            <button
              onClick={() => onStart(todo)}
              className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
              title={t('growth_todo_start')}
            >
              <Play size={16} />
            </button>
          )}
          <button
            onClick={() => onFocus(todo)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <AlarmClock size={16} />
          </button>
        </>
      )}
    </div>
  );
};
