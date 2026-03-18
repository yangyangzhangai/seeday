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

  // Generate recurring todos on mount / day change
  useEffect(() => {
    generateRecurringTodos();
  }, [generateRecurringTodos]);

  const handleToggle = async (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (todo && !todo.completed) {
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
    toggleTodo(id);
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

  // Visible todos: non-templates, default sorted by dueAt (via sortOrder), completed items sink to bottom
  const visible = todos
    .filter((t) => !t.isTemplate)
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
              onDelete={deleteTodo}
            />
          ))}
        </div>
      )}

      <AddGrowthTodoModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={addTodo}
      />
    </section>
  );
};
