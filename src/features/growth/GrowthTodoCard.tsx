import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlarmClock, Check, Play, GripVertical, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useGrowthStore } from '../../store/useGrowthStore';
import { type GrowthTodo, type GrowthPriority, type Recurrence } from '../../store/useTodoStore';

// Re-export for consumers
export type { GrowthTodo, GrowthPriority };

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

interface Props {
  todo: GrowthTodo;
  onToggle: (id: string) => void;
  onFocus: (todo: GrowthTodo) => void;
  onStart?: (todo: GrowthTodo) => void;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Omit<GrowthTodo, 'id' | 'createdAt'>>) => Promise<void>;
  isHighlighted?: boolean;
}

const priorityConfig: Record<GrowthPriority, { color: string; bg: string; border: string }> = {
  high: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-500' },
  medium: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-500' },
  low: { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-500' },
};

function normalizePriority(p: string): GrowthPriority {
  if (p === 'high' || p === 'medium' || p === 'low') return p as GrowthPriority;
  if (p === 'urgent-important') return 'high';
  if (p === 'urgent-not-important' || p === 'important-not-urgent') return 'medium';
  return 'low';
}

function tsToDatetimeLocal(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const GrowthTodoCard = ({ todo, onToggle, onFocus, onStart, onDelete, onUpdate, isHighlighted }: Props) => {
  const { t } = useTranslation();
  const bottles = useGrowthStore((s) => s.bottles.filter((b) => b.status === 'active'));
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // AI 建议高亮：滚动到视图中心并闪烁
  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlighted]);

  const normalizedPriority = normalizePriority(todo.priority);
  const cfg = priorityConfig[normalizedPriority];

  const dueStr = todo.dueAt
    ? new Date(todo.dueAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;
  const isOverdue = todo.dueAt && !todo.completed && todo.dueAt < Date.now();

  // Collapse on click outside
  useEffect(() => {
    if (!expanded) return;
    const handleOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [expanded]);

  const handlePriority = (p: GrowthPriority) => {
    onUpdate?.(todo.id, { priority: p });
  };

  const handleDueAt = (val: string) => {
    onUpdate?.(todo.id, { dueAt: val ? new Date(val).getTime() : undefined });
  };

  const handleRecurrence = (r: Recurrence) => {
    onUpdate?.(todo.id, { recurrence: r });
  };

  const handleToggleDay = (day: number) => {
    const days = todo.recurrenceDays ?? [];
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    onUpdate?.(todo.id, { recurrenceDays: next });
  };

  const handleBottle = (bottleId: string) => {
    onUpdate?.(todo.id, { bottleId: bottleId || undefined });
  };

  const recurrences: Recurrence[] = ['once', 'daily', 'weekly'];

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative bg-white rounded-xl border border-gray-100 shadow-sm transition-all duration-300",
        todo.completed && "opacity-50",
        isHighlighted && "ring-2 ring-green-400 animate-[highlightPulse_0.6s_ease-in-out_3]"
      )}
    >
      {/* Delete button — appears on hover */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(todo.id); }}
          className="absolute -top-1.5 -right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gray-400 text-white transition-colors hover:bg-red-500 md:hidden md:group-hover:flex"
          title={t('delete')}
        >
          <X size={10} />
        </button>
      )}

      {/* Main row — tap to expand */}
      <div
        className="flex items-center gap-2 p-3 cursor-pointer"
        onClick={() => !todo.completed && setExpanded((v) => !v)}
      >
        {/* Drag handle */}
        <GripVertical size={14} className="text-gray-300 flex-shrink-0 cursor-grab" onClick={(e) => e.stopPropagation()} />

        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(todo.id); }}
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
          {t(`growth_todo_priority_${normalizedPriority}`)}
        </span>

        {/* Action buttons */}
        {!todo.completed && (
          <>
            {onStart && (
              <button
                onClick={(e) => { e.stopPropagation(); onStart(todo); }}
                className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                title={t('growth_todo_start')}
              >
                <Play size={16} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onFocus(todo); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <AlarmClock size={16} />
            </button>
          </>
        )}
      </div>

      {/* Expanded edit panel */}
      {expanded && !todo.completed && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-3">
          {/* Priority */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">{t('growth_todo_priority')}</p>
            <div className="flex gap-2">
              {(['high', 'medium', 'low'] as GrowthPriority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePriority(p)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                    normalizedPriority === p
                      ? `${priorityConfig[p].color} ${priorityConfig[p].bg} ${priorityConfig[p].border}`
                      : "border-gray-200 text-gray-400"
                  )}
                >
                  {t(`growth_todo_priority_${p}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">{t('growth_todo_due_datetime')}</p>
            <input
              type="datetime-local"
              defaultValue={tsToDatetimeLocal(todo.dueAt)}
              onChange={(e) => handleDueAt(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* Recurrence */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">{t('growth_todo_recurrence')}</p>
            <div className="flex gap-2">
              {recurrences.map((r) => (
                <button
                  key={r}
                  onClick={() => handleRecurrence(r)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                    (todo.recurrence ?? 'once') === r
                      ? "border-blue-500 bg-blue-50 text-blue-600"
                      : "border-gray-200 text-gray-400"
                  )}
                >
                  {t(`growth_todo_recurrence_${r}`)}
                </button>
              ))}
            </div>
            {todo.recurrence === 'weekly' && (
              <div className="flex gap-1 mt-2">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => handleToggleDay(i)}
                    className={cn(
                      "w-8 h-8 rounded-full text-xs font-medium transition-all",
                      (todo.recurrenceDays ?? []).includes(i)
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bottle link */}
          {bottles.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">{t('growth_todo_link_bottle')}</p>
              <select
                value={todo.bottleId ?? ''}
                onChange={(e) => handleBottle(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">{t('growth_todo_none')}</option>
                {bottles.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
