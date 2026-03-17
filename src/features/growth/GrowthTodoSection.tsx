import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useGrowthStore } from '../../store/useGrowthStore';
import { GrowthTodoCard, type GrowthTodo, type GrowthPriority } from './GrowthTodoCard';
import { AddGrowthTodoModal } from './AddGrowthTodoModal';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  onFocus: (todo: GrowthTodo) => void;
}

export const GrowthTodoSection = ({ onFocus }: Props) => {
  const { t } = useTranslation();
  const incrementBottleStar = useGrowthStore((s) => s.incrementBottleStar);
  const [todos, setTodos] = useState<GrowthTodo[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const handleAdd = (title: string, priority: GrowthPriority, bottleId?: string) => {
    const todo: GrowthTodo = {
      id: uuidv4(),
      title,
      priority,
      bottleId,
      completed: false,
      createdAt: Date.now(),
    };
    setTodos((prev) => [todo, ...prev]);
  };

  const handleToggle = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) => {
        if (todo.id !== id) return todo;
        const nowCompleted = !todo.completed;
        // If completing and linked to a bottle, increment star
        if (nowCompleted && todo.bottleId) {
          incrementBottleStar(todo.bottleId);
        }
        return { ...todo, completed: nowCompleted };
      })
    );
  };

  const priorityOrder: Record<GrowthPriority, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
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

      {sorted.length === 0 ? (
        <div className="text-center text-gray-400 py-6 text-sm">{t('growth_todo_empty')}</div>
      ) : (
        <div className="space-y-2">
          {sorted.map((todo) => (
            <GrowthTodoCard
              key={todo.id}
              todo={todo}
              onToggle={handleToggle}
              onFocus={onFocus}
            />
          ))}
        </div>
      )}

      <AddGrowthTodoModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={handleAdd}
      />
    </section>
  );
};
