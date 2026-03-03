import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTodoStore, Priority, Todo, Recurrence } from '../../store/useTodoStore';
import { useChatStore } from '../../store/useChatStore';
import { Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getCategoryLabel } from '../../lib/todoHelpers';
import { TodoEditorModal } from './TodoEditorModal';
import { TodoItem } from './TodoItem';
import { filterTodosByScopeAndVisibility, getPriorityColor, getPriorityLabel, sortTodos, type TodoFilter } from './todoPageHelpers';

export const TodoPage = () => {
  const { todos, categories, addTodo, updateTodo, toggleTodo, togglePin, deleteTodo, addCategory, fetchTodos, activeTodoId, startTodo, setActiveTodoId } = useTodoStore();
  const { sendMessage, setMode } = useChatStore();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const tCat = (key: string) => getCategoryLabel(key, t);
  const [filter, setFilter] = useState<TodoFilter>('daily');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  // Form State
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<Priority>('urgent-important');
  const [category, setCategory] = useState(categories[0] || 'work');
  const [customCategory, setCustomCategory] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');

  const sortedTodos = useMemo(() => {
    const filtered = filterTodosByScopeAndVisibility(todos, filter);
    return sortTodos(filtered);
  }, [todos, filter]);

  const handleOpenModal = (todo?: Todo) => {
    if (todo) {
      setEditingId(todo.id);
      setContent(todo.content);
      setPriority(todo.priority);
      setCategory(todo.category);
      setCustomCategory('');
      setRecurrence(todo.recurrence || 'none');
    } else {
      setEditingId(null);
      setContent('');
      setPriority('urgent-important');
      setCategory(categories[0] || 'work');
      setCustomCategory('');
      setRecurrence('none');
    }
    setIsAdding(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const finalCategory = customCategory.trim() || category;
    if (customCategory.trim() && !categories.includes(customCategory.trim())) {
      addCategory(customCategory.trim());
    }

    if (editingId) {
      updateTodo(editingId, {
        content,
        priority,
        category: finalCategory,
        recurrence,
      });
    } else {
      addTodo(content, priority, finalCategory, filter, undefined, recurrence);
    }

    setContent('');
    setCustomCategory('');
    setRecurrence('none');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleStartTodo = async (todo: Todo) => {
    // 1. 更新 todo 状态（开始计时）
    await startTodo(todo.id);

    // 2. 立即创建消息记录（关键：在跳转前创建，避免 Effect 竞态条件）
    const now = Date.now();
    await sendMessage(todo.content, now, 'record');

    // 3. 设置活跃待办和模式（消息已创建，不需要通过 URL 传递）
    setActiveTodoId(todo.id);
    setMode('record');

    // 4. 跳转到记录模式页面
    navigate('/chat');
  };

  const handleDeleteFromModal = async () => {
    if (editingId) {
      await deleteTodo(editingId);
      setIsAdding(false);
      setEditingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-center mb-4">{t('todo_title')}</h1>
        <div className="flex p-1 bg-gray-100 rounded-lg">
          {(['daily', 'weekly', 'monthly'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                filter === f ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {f === 'daily' ? t('todo_filter_daily') : f === 'weekly' ? t('todo_filter_weekly') : t('todo_filter_monthly')}
            </button>
          ))}
        </div>
      </header>

      {/* Todo List */}
      <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-3">
        {sortedTodos.length === 0 && (
          <div className="text-center text-gray-400 py-10">
            <p>{t('todo_empty')}</p>
          </div>
        )}

        {sortedTodos.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggleTodo={toggleTodo}
            onTogglePin={togglePin}
            onOpenEdit={handleOpenModal}
            onStartTodo={handleStartTodo}
            activeTodoId={activeTodoId}
            getPriorityColor={getPriorityColor}
            getPriorityLabel={(priorityValue) => getPriorityLabel(priorityValue, t)}
            getCategoryLabel={tCat}
          />
        ))}
      </div>

      {/* Add Button */}
      <button
        onClick={() => handleOpenModal()}
        className="fixed right-6 z-20 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-transform active:scale-95"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        <Plus size={24} />
      </button>

      <TodoEditorModal
        isOpen={isAdding}
        editingId={editingId}
        content={content}
        priority={priority}
        recurrence={recurrence}
        category={category}
        customCategory={customCategory}
        categories={categories}
        onContentChange={setContent}
        onPriorityChange={setPriority}
        onRecurrenceChange={setRecurrence}
        onCategoryChange={setCategory}
        onCustomCategoryChange={setCustomCategory}
        onSubmit={handleSubmit}
        onDelete={handleDeleteFromModal}
        onClose={() => {
          setIsAdding(false);
          setEditingId(null);
        }}
        getCategoryLabel={tCat}
      />
    </div>
  );
};
