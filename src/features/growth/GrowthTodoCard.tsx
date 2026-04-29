import { useState, useRef, useEffect, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AlarmClock, Check, Play, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useGrowthStore } from '../../store/useGrowthStore';
import { type GrowthTodo, type GrowthPriority, type Recurrence } from '../../store/useTodoStore';
import { triggerLightHaptic } from '../../lib/haptics';
import { SubTodoList } from './SubTodoList';

// Re-export for consumers
export type { GrowthTodo, GrowthPriority };

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const BLUE_SELECTED_STYLE = {
  background:
    'linear-gradient(135deg, rgba(219,234,254,0.95) 0%, rgba(191,219,254,0.90) 45%, rgba(147,197,253,0.72) 100%) padding-box, linear-gradient(140deg, rgba(147,197,253,0.52) 0%, rgba(239,246,255,0.95) 55%, rgba(255,255,255,0.98) 100%) border-box',
  border: '0.5px solid transparent',
  boxShadow: '0 6px 14px rgba(59,130,246,0.14)',
} as const;

interface Props {
  todo: GrowthTodo;
  subTodos?: GrowthTodo[];
  onToggle: (id: string) => void;
  onFocus: (todo: GrowthTodo) => void;
  onStart?: (todo: GrowthTodo) => void;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Omit<GrowthTodo, 'id' | 'createdAt'>>) => Promise<void>;
  onSequentialFocus?: (subTodos: GrowthTodo[]) => void;
  isHighlighted?: boolean;
  onTogglePin?: (id: string) => void;
  onEditingChange?: (todoId: string | null) => void;
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

export const GrowthTodoCard = ({
  todo,
  subTodos = [],
  onToggle,
  onFocus,
  onStart,
  onDelete,
  onUpdate,
  onSequentialFocus,
  isHighlighted,
  onTogglePin,
  onEditingChange,
}: Props) => {
  const { t } = useTranslation();
  const bottles = useGrowthStore((s) => s.bottles.filter((b) => b.status === 'active'));
  const [expanded, setExpanded] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(todo.title);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleEditingTargetIdRef = useRef<string | null>(null);

  // AI 建议高亮：滚动到视图中心并闪烁
  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlighted]);

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(todo.title);
    }
  }, [todo.title, isEditingTitle]);

  useEffect(() => {
    return () => {
      onEditingChange?.(null);
    };
  }, [onEditingChange]);

  useEffect(() => {
    if (!isEditingTitle) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isEditingTitle]);

  const normalizedPriority = normalizePriority(todo.priority);
  const cfg = priorityConfig[normalizedPriority];

  const dueStr = todo.dueAt
    ? new Date(todo.dueAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;
  const isOverdue = todo.dueAt && !todo.completed && todo.dueAt < Date.now();

  const getDueBadge = (): { label: string; className: string } | null => {
    if (!todo.dueAt || todo.completed) return null;
    const now = Date.now();
    const todayEnd = (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); })();
    const tomorrowEnd = todayEnd + 24 * 60 * 60 * 1000;
    if (todo.dueAt < now) return { label: t('todo_due_badge_overdue'), className: 'text-red-600 bg-red-50 border border-red-200' };
    if (todo.dueAt <= todayEnd) return { label: t('todo_due_badge_today'), className: 'text-orange-500 bg-orange-50 border border-orange-200' };
    if (todo.dueAt <= tomorrowEnd) return { label: t('todo_due_badge_tomorrow'), className: 'text-blue-500 bg-sky-50 border border-sky-200' };
    return null;
  };
  const dueBadge = getDueBadge();

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
    triggerLightHaptic();
    onUpdate?.(todo.id, { priority: p });
  };

  const handleDueAt = (val: string) => {
    onUpdate?.(todo.id, { dueAt: val ? new Date(val).getTime() : undefined });
  };

  const handleRecurrence = (r: Recurrence) => {
    triggerLightHaptic();
    onUpdate?.(todo.id, { recurrence: r });
  };

  const handleToggleDay = (day: number) => {
    triggerLightHaptic();
    const days = todo.recurrenceDays ?? [];
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    onUpdate?.(todo.id, { recurrenceDays: next });
  };

  const handleBottle = (bottleId: string) => {
    triggerLightHaptic();
    onUpdate?.(todo.id, { bottleId: bottleId || undefined });
  };

  const startEditTitle = () => {
    if (todo.completed || !expanded) return;
    titleEditingTargetIdRef.current = todo.id;
    setIsEditingTitle(true);
    onEditingChange?.(todo.id);
  };

  const cancelEditTitle = () => {
    setTitleDraft(todo.title);
    setIsEditingTitle(false);
    titleEditingTargetIdRef.current = null;
    onEditingChange?.(null);
  };

  const commitTitle = async () => {
    const targetTodoId = titleEditingTargetIdRef.current ?? todo.id;
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      cancelEditTitle();
      return;
    }
    if (nextTitle !== todo.title) {
      await onUpdate?.(targetTodoId, { title: nextTitle });
    }
    setIsEditingTitle(false);
    titleEditingTargetIdRef.current = null;
    onEditingChange?.(null);
  };

  const confirmExpandedEdits = async () => {
    triggerLightHaptic();
    if (isEditingTitle) {
      await commitTitle();
    }
    setExpanded(false);
  };

  const recurrences: Recurrence[] = ['once', 'daily', 'weekly'];
  const getPrioritySelectedStyle = (priority: GrowthPriority) => {
    if (priority === 'high') {
      return {
        background:
          'linear-gradient(135deg, rgba(254,226,226,0.96) 0%, rgba(254,202,202,0.92) 50%, rgba(252,165,165,0.72) 100%) padding-box, linear-gradient(140deg, rgba(252,165,165,0.55) 0%, rgba(254,242,242,0.95) 55%, rgba(255,255,255,0.98) 100%) border-box',
        border: '0.5px solid transparent',
        boxShadow: '0 6px 14px rgba(239,68,68,0.12)',
      } as const;
    }
    if (priority === 'medium') {
      return {
        background:
          'linear-gradient(135deg, rgba(255,237,213,0.96) 0%, rgba(254,215,170,0.92) 50%, rgba(251,191,36,0.66) 100%) padding-box, linear-gradient(140deg, rgba(251,191,36,0.50) 0%, rgba(255,247,237,0.95) 55%, rgba(255,255,255,0.98) 100%) border-box',
        border: '0.5px solid transparent',
        boxShadow: '0 6px 14px rgba(245,158,11,0.12)',
      } as const;
    }
    return {
      background:
        'linear-gradient(135deg, rgba(220,252,231,0.96) 0%, rgba(187,247,208,0.92) 50%, rgba(134,239,172,0.68) 100%) padding-box, linear-gradient(140deg, rgba(134,239,172,0.50) 0%, rgba(240,253,244,0.95) 55%, rgba(255,255,255,0.98) 100%) border-box',
      border: '0.5px solid transparent',
      boxShadow: '0 6px 14px rgba(34,197,94,0.12)',
    } as const;
  };

  const handleTogglePress = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    triggerLightHaptic();
    onToggle(todo.id);
  };

  const consumeGhostClick = (e: ReactMouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDeletePress = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    triggerLightHaptic();
    onDelete?.(todo.id);
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative bg-white rounded-xl border border-gray-100 shadow-sm transition-all duration-300",
        todo.completed && "opacity-50",
        isHighlighted && "ring-2 ring-green-400 animate-[highlightPulse_0.6s_ease-in-out_3]"
      )}
    >
      {/* Delete button — appears after card is selected */}
      {onDelete && (
        <button
          type="button"
          data-no-drag="true"
          onPointerUp={handleDeletePress}
          onClick={consumeGhostClick}
          className={cn(
            'absolute -top-2 -right-2 z-10 h-8 w-8 items-center justify-center rounded-full bg-gray-400 text-white transition-colors hover:bg-red-500 touch-manipulation',
            expanded ? 'flex' : 'hidden'
          )}
          title={t('delete')}
          aria-label={t('delete')}
        >
          <X size={14} />
        </button>
      )}

      {/* Main row — tap to expand */}
      <div
        className="flex items-center gap-2 p-3 cursor-pointer"
        onPointerUp={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button, input, textarea, select, [data-no-expand="true"]')) return;
          if (isEditingTitle) return;
          triggerLightHaptic();
          setExpanded((v) => !v);
        }}
        onClick={consumeGhostClick}
      >
        {/* Checkbox */}
        <button
          onPointerUp={handleTogglePress}
          onClick={(e) => {
            // iOS WebView may dispatch a delayed synthetic click after pointer events.
            // We consume it to avoid triggering a nearby card when layout updates.
            e.preventDefault();
            e.stopPropagation();
          }}
          className={cn(
            "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors touch-manipulation",
            todo.completed ? "bg-blue-500 border-blue-500" : "border-gray-300"
          )}
          aria-label={t('growth_todo_complete')}
        >
          {todo.completed && <Check size={12} className="text-white" />}
        </button>

        {/* Title + due date */}
        <div
          className="flex-1 min-w-0"
          data-no-drag="true"
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!expanded) return;
            triggerLightHaptic();
            startEditTitle();
          }}
          title={t('todo_edit')}
        >
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelEditTitle();
                }
              }}
              onBlur={() => { void commitTitle(); }}
              enterKeyHint="done"
              placeholder={t('growth_todo_title_placeholder')}
              className="w-full bg-transparent text-sm text-[#334155] focus:outline-none"
            />
          ) : (
            <span className={cn("text-sm block truncate", todo.completed && "line-through text-gray-400")}>
              {todo.title}
            </span>
          )}
          {dueBadge ? (
            <span className={cn("inline-block text-xs px-1.5 py-0.5 rounded-full font-medium leading-none mt-0.5", dueBadge.className)}>
              {dueBadge.label}
            </span>
          ) : dueStr ? (
            <span className="text-xs text-gray-400">{dueStr}</span>
          ) : null}
        </div>

        {/* Priority badge */}
        <span
          className={cn("text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0", cfg.color, cfg.bg)}
          onClick={(e) => e.stopPropagation()}
        >
          {t(`growth_todo_priority_${normalizedPriority}`)}
        </span>

        {/* Action buttons */}
        {!todo.completed && (
          <>
            {onStart && (
              <button
                onPointerUp={(e) => {
                  e.stopPropagation();
                  triggerLightHaptic();
                  onStart(todo);
                }}
                onClick={consumeGhostClick}
                className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                title={t('growth_todo_start')}
              >
                <Play size={16} strokeWidth={1.5} />
              </button>
            )}
            <button
              onPointerUp={(e) => {
                e.stopPropagation();
                triggerLightHaptic();
                onFocus(todo);
              }}
              onClick={consumeGhostClick}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <AlarmClock size={16} strokeWidth={1.5} />
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
                    "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all",
                    normalizedPriority === p
                      ? `${priorityConfig[p].color}`
                      : "border-gray-200 bg-white text-gray-400"
                  )}
                  style={normalizedPriority === p ? getPrioritySelectedStyle(p) : undefined}
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
                    "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all",
                    (todo.recurrence ?? 'once') === r
                      ? "text-blue-600"
                      : "border-gray-200 bg-white text-gray-400"
                  )}
                  style={(todo.recurrence ?? 'once') === r ? BLUE_SELECTED_STYLE : undefined}
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
                      "w-8 h-8 rounded-full border text-xs font-medium transition-all",
                      (todo.recurrenceDays ?? []).includes(i)
                        ? "text-blue-600"
                        : "border-gray-200 bg-gray-100 text-gray-500"
                    )}
                    style={(todo.recurrenceDays ?? []).includes(i) ? BLUE_SELECTED_STYLE : undefined}
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

          {/* Sub-todos (AI decompose) */}
          <SubTodoList
            parentTodo={todo}
            subTodos={subTodos}
            onToggleSub={onToggle}
            onFocusSub={onFocus}
            onSequentialFocus={onSequentialFocus ?? (() => {})}
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              data-no-drag="true"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerLightHaptic();
                onTogglePin?.(todo.id);
              }}
              className={cn(
                "text-xs px-3 py-1.5 rounded-lg font-medium border transition-all",
                todo.isPinned ? "text-blue-600" : "border-gray-200 bg-white text-gray-400"
              )}
              style={todo.isPinned ? BLUE_SELECTED_STYLE : undefined}
            >
              {todo.isPinned ? t('todo_unpin') : t('todo_pin')}
            </button>
            <button
              type="button"
              data-no-drag="true"
              aria-label={t('confirm')}
              title={t('confirm')}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void confirmExpandedEdits();
              }}
              className="flex items-center justify-center transition-opacity active:scale-[0.98]"
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                background: 'rgba(144.67, 212.06, 122.21, 0.20)',
                boxShadow: '0px 2px 2px #C8C8C8',
                color: '#5F7A63',
                border: 'none',
              }}
            >
              <Check size={18} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
