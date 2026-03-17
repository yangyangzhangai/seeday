import { useTranslation } from 'react-i18next';
import { AlarmClock, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export type GrowthPriority = 'high' | 'medium' | 'low';

export interface GrowthTodo {
  id: string;
  title: string;
  priority: GrowthPriority;
  dueAt?: number;
  bottleId?: string;
  completed: boolean;
  createdAt: number;
}

interface Props {
  todo: GrowthTodo;
  onToggle: (id: string) => void;
  onFocus: (todo: GrowthTodo) => void;
}

const priorityConfig: Record<GrowthPriority, { color: string; bg: string }> = {
  high: { color: 'text-red-600', bg: 'bg-red-100' },
  medium: { color: 'text-orange-600', bg: 'bg-orange-100' },
  low: { color: 'text-green-600', bg: 'bg-green-100' },
};

export const GrowthTodoCard = ({ todo, onToggle, onFocus }: Props) => {
  const { t } = useTranslation();
  const cfg = priorityConfig[todo.priority];

  return (
    <div className={cn(
      "flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 shadow-sm",
      todo.completed && "opacity-50"
    )}>
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

      {/* Title */}
      <span className={cn("flex-1 text-sm", todo.completed && "line-through text-gray-400")}>
        {todo.title}
      </span>

      {/* Priority badge */}
      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", cfg.color, cfg.bg)}>
        {t(`growth_todo_priority_${todo.priority}`)}
      </span>

      {/* Focus button */}
      {!todo.completed && (
        <button
          onClick={() => onFocus(todo)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <AlarmClock size={18} />
        </button>
      )}
    </div>
  );
};
