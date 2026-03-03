import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTodoStore, Priority, Todo, Recurrence } from '../../store/useTodoStore';
import { useChatStore } from '../../store/useChatStore';
import { Plus, Trash2, CheckCircle, Circle, Edit2, ChevronDown, ChevronUp, Repeat, ArrowUp, Play, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format, startOfDay, startOfWeek, startOfMonth } from 'date-fns';

const TodoItem = ({
  todo,
  toggleTodo,
  togglePin,
  handleOpenModal,
  handleStartTodo,
  activeTodoId,
  getPriorityColor,
  getPriorityLabel
}: {
  todo: Todo;
  toggleTodo: (id: string) => void;
  togglePin: (id: string) => void;
  handleOpenModal: (todo: Todo) => void;
  handleStartTodo: (todo: Todo) => void;
  activeTodoId: string | null;
  getPriorityColor: (p: Priority) => string;
  getPriorityLabel: (p: Priority) => string;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const { t } = useTranslation();

  // Translate category key to localized label
  const catMap: Record<string, string> = {
    study: t('category_study'), work: t('category_work'), social: t('category_social'),
    life: t('category_life'), entertainment: t('category_entertainment'),
    '学习': t('category_study'), '工作': t('category_work'), '社交': t('category_social'),
    '生活': t('category_life'), '娱乐': t('category_entertainment'),
  };
  const tCat = (key: string) => catMap[key] || key;
  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current && !isExpanded) {
        setIsOverflowing(textRef.current.scrollWidth > textRef.current.clientWidth);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [todo.content, isExpanded]);

  return (
    <div className={cn(
      "bg-white p-2 rounded-lg border flex items-start space-x-3 transition-all",
      todo.isPinned ? "border-blue-200 bg-blue-50/30" : "border-gray-200"
    )}>
      <button onClick={() => toggleTodo(todo.id)} className="mt-1 flex-shrink-0 text-gray-400 hover:text-blue-600">
        {todo.completed ? <CheckCircle className="text-green-500" size={20} /> : <Circle size={20} />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start">
          <p
            ref={textRef}
            className={cn(
              "text-sm font-medium text-gray-900 flex-1",
              todo.completed && "line-through text-gray-400",
              !isExpanded && "truncate"
            )}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {todo.content}
          </p>
          {isOverflowing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0 p-0.5"
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-2 items-center">
          <span className={cn("text-xs px-2 py-0.5 rounded border", getPriorityColor(todo.priority))}>
            {getPriorityLabel(todo.priority)}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
            {tCat(todo.category)}
          </span>
          {todo.recurrence && todo.recurrence !== 'none' && (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1">
              <Repeat size={10} />
              {todo.recurrence === 'daily' ? t('recurrence_daily') : todo.recurrence === 'weekly' ? t('recurrence_weekly') : t('recurrence_monthly')}
            </span>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            {format(todo.createdAt, 'MM-dd HH:mm')}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end space-y-1 flex-shrink-0">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => togglePin(todo.id)}
            className={cn(
              "p-1 rounded transition-colors",
              todo.isPinned ? "text-blue-600 bg-blue-100 hover:bg-blue-200" : "text-gray-300 hover:text-blue-500 hover:bg-gray-50"
            )}
            title={todo.isPinned ? t('todo_unpin') : t('todo_pin')}
          >
            <ArrowUp size={18} />
          </button>
          {!todo.completed && (
            <button
              onClick={() => handleStartTodo(todo)}
              className={cn(
                "p-1 rounded transition-colors",
                activeTodoId === todo.id
                  ? "text-green-600 bg-green-100 hover:bg-green-200 animate-pulse"
                  : "text-green-500 hover:text-green-600 hover:bg-green-50"
              )}
              title={activeTodoId === todo.id ? t('todo_in_progress') : t('todo_start')}
            >
              <Play size={18} fill={activeTodoId === todo.id ? "currentColor" : "none"} />
            </button>
          )}
          <button onClick={() => handleOpenModal(todo)} className="text-gray-300 hover:text-blue-500 p-1 hover:bg-gray-50 rounded">
            <Edit2 size={18} />
          </button>
        </div>
        {todo.completed && todo.duration !== undefined && (
          <span className="text-xs font-bold text-green-600">
            {t('todo_duration', { minutes: todo.duration })}
          </span>
        )}
      </div>
    </div>
  );
};

export const TodoPage = () => {
  const { todos, categories, addTodo, updateTodo, toggleTodo, togglePin, deleteTodo, addCategory, checkDueDates, fetchTodos, activeTodoId, startTodo, setActiveTodoId } = useTodoStore();
  const { sendMessage, setMode } = useChatStore();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Translate category key to localized label
  const catMap: Record<string, string> = {
    study: t('category_study'), work: t('category_work'), social: t('category_social'),
    life: t('category_life'), entertainment: t('category_entertainment'),
    '学习': t('category_study'), '工作': t('category_work'), '社交': t('category_social'),
    '生活': t('category_life'), '娱乐': t('category_entertainment'),
  };
  const tCat = (key: string) => catMap[key] || key;
  const [filter, setFilter] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTodos();
    checkDueDates();
  }, [checkDueDates, fetchTodos]);

  // Form State
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<Priority>('urgent-important');
  const [category, setCategory] = useState(categories[0] || 'Work');
  const [customCategory, setCustomCategory] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');

  // Filter by scope and visibility
  const filteredTodos = todos.filter(todo => {
    const scope = todo.scope || 'daily';
    if (scope !== filter) return false;

    // Visibility Logic for Completed Tasks
    if (todo.completed) {
      // If completedAt is missing, treat as old (epoch 0) so it gets hidden
      const completedDate = todo.completedAt ? new Date(todo.completedAt) : new Date(0);
      const now = new Date();

      if (filter === 'daily') {
        // Daily: Hide if completed before today
        const todayStart = startOfDay(now);
        if (completedDate < todayStart) return false;
      } else if (filter === 'weekly') {
        // Weekly: Hide if completed before this week (Monday start)
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        if (completedDate < weekStart) return false;
      } else if (filter === 'monthly') {
        // Monthly: Hide if completed before this month
        const monthStart = startOfMonth(now);
        if (completedDate < monthStart) return false;
      }
    }

    return true;
  });

  // Sort by Priority
  const priorityOrder: Record<Priority, number> = {
    'urgent-important': 1,
    'important-not-urgent': 2,
    'urgent-not-important': 3,
    'not-important-not-urgent': 4,
  };

  const sortedTodos = filteredTodos.sort((a, b) => {
    // Pinned items first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    const pA = priorityOrder[a.priority];
    const pB = priorityOrder[b.priority];
    if (pA !== pB) return pA - pB;
    return b.createdAt - a.createdAt; // Secondary sort by time (newest first)
  });

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
      setCategory(categories[0] || 'Work');
      setCustomCategory('');
      setRecurrence('none');
    }
    setIsAdding(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
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

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case 'urgent-important': return 'text-red-600 bg-red-50 border-red-200';
      case 'urgent-not-important': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'important-not-urgent': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'not-important-not-urgent': return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityLabel = (p: Priority) => {
    switch (p) {
      case 'urgent-important': return t('priority_urgent_important');
      case 'urgent-not-important': return t('priority_urgent_not_important');
      case 'important-not-urgent': return t('priority_important_not_urgent');
      case 'not-important-not-urgent': return t('priority_not_important_not_urgent');
    }
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
            toggleTodo={toggleTodo}
            togglePin={togglePin}
            handleOpenModal={handleOpenModal}
            handleStartTodo={handleStartTodo}
            activeTodoId={activeTodoId}
            getPriorityColor={getPriorityColor}
            getPriorityLabel={getPriorityLabel}
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

      {/* Add/Edit Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom-10 fade-in">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">{editingId ? t('todo_edit') : t('todo_add')}</h2>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('todo_label_content')}</label>
                <input
                  type="text"
                  required
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder={t('todo_placeholder_content')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('todo_label_priority')}</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as Priority)}
                  className="w-full p-2 border border-gray-300 rounded-lg outline-none bg-white"
                >
                  <option value="urgent-important">{t('priority_urgent_important')}</option>
                  <option value="important-not-urgent">{t('priority_important_not_urgent')}</option>
                  <option value="urgent-not-important">{t('priority_urgent_not_important')}</option>
                  <option value="not-important-not-urgent">{t('priority_not_important_not_urgent')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('todo_label_recurrence')}</label>
                <select
                  value={recurrence}
                  onChange={e => setRecurrence(e.target.value as Recurrence)}
                  className="w-full p-2 border border-gray-300 rounded-lg outline-none bg-white"
                >
                  <option value="none">{t('recurrence_none')}</option>
                  <option value="daily">{t('recurrence_daily')}</option>
                  <option value="weekly">{t('recurrence_weekly')}</option>
                  <option value="monthly">{t('recurrence_monthly')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('todo_label_category')}</label>
                <div className="flex space-x-2">
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded-lg outline-none bg-white"
                  >
                    {categories.map(c => <option key={c} value={c}>{tCat(c)}</option>)}
                  </select>
                  <input
                    type="text"
                    value={customCategory}
                    onChange={e => setCustomCategory(e.target.value)}
                    placeholder={t('todo_placeholder_custom_category')}
                    className="flex-1 p-2 border border-gray-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                {editingId ? (
                  <button
                    type="button"
                    onClick={handleDeleteFromModal}
                    className="flex-1 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 border border-red-200"
                  >
                    {t('todo_delete_confirm')}
                  </button>
                ) : (
                  <div className="flex-1" />
                )}
                <button
                  type="submit"
                  className="flex-1 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  {t('confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
