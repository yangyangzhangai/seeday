import { useState, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTodoStore, type GrowthTodo } from '../../store/useTodoStore';
import { useGrowthStore } from '../../store/useGrowthStore';
import { useChatStore } from '../../store/useChatStore';
import { normalizeTodoCategory } from '../../lib/activityType';
import { GrowthTodoCard } from './GrowthTodoCard';

interface Props {
  onFocus: (todo: GrowthTodo) => void;
  highlightTodoId?: string | null;
}

export const GrowthTodoSection = ({ onFocus, highlightTodoId }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const incrementBottleStar = useGrowthStore((s) => s.incrementBottleStar);
  const {
    todos,
    isLoading,
    hasHydrated,
    lastSyncError,
    fetchTodos,
    toggleTodo,
    deleteTodo,
    startTodo,
    addTodo,
    updateTodo,
    reorderTodosByIds,
    generateRecurringTodos,
    linkMessageToTodo,
    setTodoCompletionMessage,
    getTodoCompletionMessage,
    clearTodoCompletionMessage,
  } = useTodoStore();
  const sendMessage = useChatStore((s) => s.sendMessage);
  const endActivity = useChatStore((s) => s.endActivity);
  const deleteActivity = useChatStore((s) => s.deleteActivity);
  const [pendingDelete, setPendingDelete] = useState<GrowthTodo | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const dragOrderRef = useRef<string[] | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragSessionRef = useRef<{
    sourceId: string;
    startY: number;
    lastY: number;
    activatedY: number;
    activated: boolean;
    pointerId: number;
    initialOrder: string[];
    timerId: number | null;
  } | null>(null);

  // Generate recurring todos on mount / day change
  useEffect(() => {
    generateRecurringTodos();
  }, [generateRecurringTodos]);

  const handleQuickAdd = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    addTodo({ title: trimmed, priority: 'medium' });
    setNewTitle('');
  };

  const handleRetrySync = () => {
    void fetchTodos();
  };

  const handleToggle = async (id: string) => {
    const todo = todos.find((t) => t.id === id);
    const wasCompleted = todo?.completed ?? true;
    toggleTodo(id);
    if (todo && wasCompleted) {
      const generatedMessageId = getTodoCompletionMessage(todo.id);
      if (generatedMessageId) {
        await deleteActivity(generatedMessageId);
      }
      clearTodoCompletionMessage(todo.id);
      return;
    }

    if (todo && !wasCompleted) {
      const now = Date.now();
      if (todo.bottleId) incrementBottleStar(todo.bottleId);
      const startTime = todo.startedAt ?? now;
      const msgId = await sendMessage(todo.title, startTime, {
        activityTypeOverride: normalizeTodoCategory(todo.category, todo.title),
      });
      if (msgId) {
        setTodoCompletionMessage(todo.id, msgId);
        await endActivity(msgId, { skipBottleStar: !!todo.bottleId });
      } else {
        clearTodoCompletionMessage(todo.id);
      }
    }
  };

  const handleDelete = (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    if (todo.templateId) {
      setPendingDelete(todo);
    } else {
      deleteTodo(id);
    }
  };

  const handleStart = async (todo: GrowthTodo) => {
    startTodo(todo.id);
    const now = Date.now();
    const msgId = await sendMessage(todo.title, now, {
      activityTypeOverride: normalizeTodoCategory(todo.category, todo.title),
    });
    if (msgId) {
      linkMessageToTodo(msgId, todo.id);
    }
    navigate('/chat');
  };

  const todayStartMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const visible = todos
    .filter((t) => {
      if (t.isTemplate) return false;
      if (t.completed && t.completedAt && t.completedAt < todayStartMs) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.sortOrder - b.sortOrder;
    });

  const visibleMap = new Map(visible.map((todo) => [todo.id, todo]));
  const orderedVisible = (dragOrder ?? visible.map((todo) => todo.id))
    .map((id) => visibleMap.get(id))
    .filter((todo): todo is GrowthTodo => Boolean(todo));

  useEffect(() => {
    dragOrderRef.current = dragOrder;
  }, [dragOrder]);

  const clearDragTimer = () => {
    const session = dragSessionRef.current;
    if (!session?.timerId) return;
    window.clearTimeout(session.timerId);
    session.timerId = null;
  };

  const stopDragging = (commit: boolean) => {
    const session = dragSessionRef.current;
    if (!session) return;

    clearDragTimer();
    const currentOrder = dragOrderRef.current;
    if (session.activated && commit && currentOrder) {
      const original = session.initialOrder.join('|');
      const next = currentOrder.join('|');
      if (original !== next) {
        reorderTodosByIds(currentOrder);
      }
    }

    dragSessionRef.current = null;
    setDraggingId(null);
    setDragOffsetY(0);
    setDragOrder(null);
    document.body.style.userSelect = '';
  };

  const handleCardPointerDown = (todoId: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, [data-no-drag="true"]')) return;

    const initialOrder = visible.map((todo) => todo.id);
    const session = {
      sourceId: todoId,
      startY: e.clientY,
      lastY: e.clientY,
      activatedY: e.clientY,
      activated: false,
      pointerId: e.pointerId,
      initialOrder,
      timerId: window.setTimeout(() => {
        const current = dragSessionRef.current;
        if (!current || current.pointerId !== e.pointerId) return;
        current.activated = true;
        current.activatedY = current.lastY;
        setDraggingId(todoId);
        setDragOffsetY(0);
        setDragOrder(current.initialOrder);
        document.body.style.userSelect = 'none';
      }, 320),
    };
    dragSessionRef.current = session;

    const onPointerMove = (evt: PointerEvent) => {
      const current = dragSessionRef.current;
      if (!current || evt.pointerId !== current.pointerId) return;
      current.lastY = evt.clientY;

      if (!current.activated) {
        if (Math.abs(evt.clientY - current.startY) > 8) {
          clearDragTimer();
          dragSessionRef.current = null;
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerCancel);
        }
        return;
      }

      evt.preventDefault();
      setDragOffsetY(evt.clientY - current.activatedY);
      setDragOrder((prev) => {
        const order = prev ?? current.initialOrder;
        const nextBase = order.filter((id) => id !== current.sourceId);
        let insertIndex = 0;

        for (const id of nextBase) {
          const el = cardRefs.current[id];
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (evt.clientY > rect.top + rect.height / 2) insertIndex += 1;
        }

        const next = [...nextBase];
        next.splice(insertIndex, 0, current.sourceId);
        return next.join('|') === order.join('|') ? order : next;
      });
    };

    const onPointerUp = (evt: PointerEvent) => {
      const current = dragSessionRef.current;
      if (!current || evt.pointerId !== current.pointerId) return;
      stopDragging(true);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };

    const onPointerCancel = (evt: PointerEvent) => {
      const current = dragSessionRef.current;
      if (!current || evt.pointerId !== current.pointerId) return;
      stopDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  };

  useEffect(() => () => {
    clearDragTimer();
    document.body.style.userSelect = '';
  }, []);

  return (
    <section className="mb-4 px-4">
      <h2 className="mb-3 text-[14px] font-extrabold text-[#1e293b]">{t('growth_todo_section')}</h2>

      {/* Inline quick-add input */}
      <div
        className="mb-2 flex items-center gap-2.5 rounded-xl px-3 py-3"
        style={{
          background: '#F7F9F8',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        }}
      >
        <div className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-[#8FAF92]/50" />
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(); }}
          placeholder={t('growth_todo_quick_add_placeholder')}
          className="flex-1 bg-transparent text-sm text-[#334155] placeholder:text-[#94a3b8] focus:outline-none"
        />
      </div>

      {visible.length > 0 && (
        <div className="space-y-2">
          {orderedVisible.map((todo) => (
            <div
              key={todo.id}
              ref={(node) => {
                cardRefs.current[todo.id] = node;
              }}
              onPointerDown={handleCardPointerDown(todo.id)}
              className="transition-transform duration-150"
              style={
                draggingId === todo.id
                  ? {
                      transform: `translateY(${dragOffsetY}px) scale(1.02)`,
                      zIndex: 20,
                      position: 'relative',
                    }
                  : undefined
              }
            >
              <GrowthTodoCard
                todo={todo}
                onToggle={handleToggle}
                onFocus={onFocus}
                onStart={handleStart}
                onDelete={handleDelete}
                onUpdate={updateTodo}
                isHighlighted={highlightTodoId === todo.id}
              />
            </div>
          ))}
        </div>
      )}

      {visible.length === 0 && (isLoading && !hasHydrated) && (
        <div className="py-6 text-center text-sm text-gray-400">{t('loading')}</div>
      )}

      {visible.length === 0 && hasHydrated && lastSyncError && (
        <div className="flex flex-col items-center gap-2 py-6">
          <p className="text-center text-xs text-orange-500">{lastSyncError}</p>
          <button
            onClick={handleRetrySync}
            className="rounded-lg bg-[#A86B2B] px-3 py-1.5 text-xs font-medium text-white"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {visible.length === 0 && hasHydrated && !lastSyncError && !isLoading && (
        <div className="py-6 text-center text-sm text-gray-400">{t('no_data')}</div>
      )}

      {/* Recurring delete confirmation dialog */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl p-5 pb-8 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-gray-800 text-center">
              {t('todo_delete_recurring_title')}
            </p>
            <p className="text-xs text-gray-400 text-center">{t('todo_delete_recurring_desc')}</p>
            <button
              className="w-full py-3 rounded-xl bg-orange-50 text-orange-600 font-medium text-sm"
              onClick={() => {
                deleteTodo(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              {t('todo_delete_today_only')}
            </button>
            <button
              className="w-full py-3 rounded-xl bg-red-50 text-red-600 font-medium text-sm"
              onClick={() => {
                if (pendingDelete.templateId) deleteTodo(pendingDelete.templateId);
                setPendingDelete(null);
              }}
            >
              {t('todo_delete_all_future')}
            </button>
            <button
              className="w-full py-3 rounded-xl bg-gray-50 text-gray-500 font-medium text-sm"
              onClick={() => setPendingDelete(null)}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
