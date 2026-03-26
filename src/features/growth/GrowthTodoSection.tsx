import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTodoStore, type GrowthTodo } from '../../store/useTodoStore';
import { useGrowthStore } from '../../store/useGrowthStore';
import { useChatStore } from '../../store/useChatStore';
import { normalizeTodoCategory } from '../../lib/activityType';
import { GrowthTodoCard } from './GrowthTodoCard';

interface Props {
  onFocus: (todo: GrowthTodo) => void;
}

export const GrowthTodoSection = ({ onFocus }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const incrementBottleStar = useGrowthStore((s) => s.incrementBottleStar);
  const {
    todos,
    toggleTodo,
    deleteTodo,
    startTodo,
    addTodo,
    updateTodo,
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

  return (
    <section className="mb-4 px-4">
      <h2 className="text-base font-bold text-gray-800 mb-3">{t('growth_todo_section')}</h2>

      {/* Inline quick-add input */}
      <div className="flex items-center gap-2.5 bg-blue-50 rounded-xl px-3 py-3 border-2 border-blue-200 border-dashed mb-2">
        <div className="w-5 h-5 rounded-full border-2 border-blue-300 flex items-center justify-center flex-shrink-0">
          <Plus size={11} className="text-blue-400" />
        </div>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(); }}
          placeholder={t('growth_todo_quick_add_placeholder')}
          className="flex-1 text-sm focus:outline-none bg-transparent text-gray-700 placeholder-blue-300"
        />
      </div>

      {visible.length > 0 && (
        <div className="space-y-2">
          {visible.map((todo) => (
            <GrowthTodoCard
              key={todo.id}
              todo={todo}
              onToggle={handleToggle}
              onFocus={onFocus}
              onStart={handleStart}
              onDelete={handleDelete}
              onUpdate={updateTodo}
            />
          ))}
        </div>
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
