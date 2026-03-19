import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTodoStore, type GrowthTodo } from '../../store/useTodoStore';
import { useGrowthStore } from '../../store/useGrowthStore';
import { useChatStore } from '../../store/useChatStore';
import { GrowthTodoCard } from './GrowthTodoCard';
import { AddGrowthTodoModal } from './AddGrowthTodoModal';

interface Props {
  onFocus: (todo: GrowthTodo) => void;
}

export const GrowthTodoSection = ({ onFocus }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const incrementBottleStar = useGrowthStore((s) => s.incrementBottleStar);
  const { todos, toggleTodo, deleteTodo, startTodo, addTodo, generateRecurringTodos, linkMessageToTodo } = useTodoStore();
  const sendMessage = useChatStore((s) => s.sendMessage);
  const endActivity = useChatStore((s) => s.endActivity);
  const setMode = useChatStore((s) => s.setMode);
  const [showAdd, setShowAdd] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GrowthTodo | null>(null);

  // Generate recurring todos on mount / day change
  useEffect(() => {
    generateRecurringTodos();
  }, [generateRecurringTodos]);

  const handleToggle = async (id: string) => {
    const todo = todos.find((t) => t.id === id);
    const wasCompleted = todo?.completed ?? true;
    // Optimistic update — toggle immediately so the UI responds without waiting for async ops
    toggleTodo(id);
    if (todo && !wasCompleted) {
      // Increment bottle star if linked
      if (todo.bottleId) incrementBottleStar(todo.bottleId);
      // Create a completed record card:
      // Start time = todo's due time (or createdAt as fallback), end time = now
      const startTime = todo.dueAt ?? todo.createdAt;
      const msgId = await sendMessage(todo.title, startTime, 'record');
      if (msgId) {
        // Immediately end the activity so it shows as a completed card with correct duration
        await endActivity(msgId);
      }
    }
  };

  const handleDelete = (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    // If it's a recurring instance, show confirmation dialog
    if (todo.templateId) {
      setPendingDelete(todo);
    } else {
      deleteTodo(id);
    }
  };

  const handleStart = async (todo: GrowthTodo) => {
    startTodo(todo.id);
    const now = Date.now();
    const msgId = await sendMessage(todo.title, now, 'record');
    if (msgId) {
      linkMessageToTodo(msgId, todo.id);
    }
    setMode('record');
    navigate('/chat');
  };

  // Visible todos: non-templates, sorted by dueAt (via sortOrder), completed items sink to bottom
  // Completed once/weekly/daily todos from previous days are hidden (they reset or disappear at midnight)
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
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-gray-800">{t('growth_todo_section')}</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
        >
          <Plus size={18} />
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="text-center text-gray-400 py-6 text-sm">{t('growth_todo_empty')}</div>
      ) : (
        <div className="space-y-2">
          {visible.map((todo) => (
            <GrowthTodoCard
              key={todo.id}
              todo={todo}
              onToggle={handleToggle}
              onFocus={onFocus}
              onStart={handleStart}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <AddGrowthTodoModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={addTodo}
      />

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
