// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/onboarding/OnboardingFlow.tsx
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight, Clock, Flag, Repeat, X } from 'lucide-react';

type TodoUrgency = 'low' | 'medium' | 'high';

type DraftTodo = {
  id: string;
  text: string;
  done: boolean;
  time: string;
  urgency: TodoUrgency;
  repeat: boolean;
};

type StoredTodo = {
  id: string;
  title: string;
  done: boolean;
  time: string;
  urgency: TodoUrgency;
  repeat: boolean;
};

type StepTodoProps = {
  onNext: () => void;
};

export function StepTodo({ onNext }: StepTodoProps) {
  const [todo, setTodo] = useState('');
  const [time, setTime] = useState(
    `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,
  );
  const [urgency, setUrgency] = useState<TodoUrgency>('medium');
  const [isRepeating, setIsRepeating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [todos, setTodos] = useState<DraftTodo[]>([]);

  const addTodo = () => {
    if (!todo.trim()) return;
    const newTodo: DraftTodo = {
      id: Date.now().toString(),
      text: todo,
      done: false,
      time,
      urgency,
      repeat: isRepeating,
    };

    setTodos([newTodo, ...todos]);
    setTodo('');
    setIsExpanded(false);

    const existing = JSON.parse(localStorage.getItem('at_todos') || '[]') as StoredTodo[];
    localStorage.setItem(
      'at_todos',
      JSON.stringify([
        {
          id: newTodo.id,
          title: newTodo.text,
          done: false,
          time: newTodo.time,
          urgency: newTodo.urgency,
          repeat: newTodo.repeat,
        },
        ...existing,
      ]),
    );
  };

  const removeTodo = (id: string) => {
    setTodos(todos.filter((t) => t.id !== id));
    const existing = JSON.parse(localStorage.getItem('at_todos') || '[]') as StoredTodo[];
    localStorage.setItem('at_todos', JSON.stringify(existing.filter((t) => t.id !== id)));
  };

  const URGENCY_LEVELS: { id: TodoUrgency; label: string; color: string }[] = [
    { id: 'low', label: '普通', color: 'bg-blue-100 text-blue-600 border-blue-200' },
    { id: 'medium', label: '重要', color: 'bg-orange-100 text-orange-600 border-orange-200' },
    { id: 'high', label: '紧急', color: 'bg-red-100 text-red-600 border-red-200' },
  ];

  return (
    <div className="flex-1 flex flex-col px-8 pt-16 pb-12 overflow-y-auto no-scrollbar bg-[#f4f7f4]">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-[#4a5d4c]">设置一个小待办</h2>
        <p className="text-[#4a5d4c]/50 text-sm mt-2">万事开头难，先从最简单的一件开始</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white border border-[#4a5d4c]/5 p-6 rounded-[32px] shadow-sm space-y-4 focus-within:border-[#8fae91] transition-all overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="w-6 h-6 rounded-full border-2 border-[#8fae91]/30 flex-shrink-0" />
            <input
              type="text"
              value={todo}
              onChange={(e) => setTodo(e.target.value)}
              onFocus={() => setIsExpanded(true)}
              onKeyDown={(e) => e.key === 'Enter' && addTodo()}
              className="flex-1 bg-transparent border-none outline-none text-[#4a5d4c] font-bold placeholder:text-[#4a5d4c]/20 text-sm"
              placeholder="添加一个新的待办..."
            />
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-4"
              >
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#4a5d4c]/5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-[#4a5d4c]/40 uppercase tracking-widest flex items-center gap-1">
                      <Clock size={10} /> 执行时间
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="bg-[#4a5d4c]/5 border-none rounded-xl px-3 py-2 text-xs font-bold text-[#4a5d4c] outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-[#4a5d4c]/40 uppercase tracking-widest flex items-center gap-1">
                      <Repeat size={10} /> 是否重复
                    </label>
                    <button
                      onClick={() => setIsRepeating(!isRepeating)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        isRepeating ? 'bg-[#8fae91] text-white' : 'bg-[#4a5d4c]/5 text-[#4a5d4c]/40'
                      }`}
                    >
                      {isRepeating ? '每天' : '仅一次'}
                      <div
                        className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${
                          isRepeating ? 'translate-x-0' : '-translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-[#4a5d4c]/40 uppercase tracking-widest flex items-center gap-1">
                    <Flag size={10} /> 紧急程度
                  </label>
                  <div className="flex gap-2">
                    {URGENCY_LEVELS.map((level) => (
                      <button
                        key={level.id}
                        onClick={() => setUrgency(level.id)}
                        className={`flex-1 py-2 px-1 rounded-xl text-xs font-bold border transition-all ${
                          urgency === level.id
                            ? `${level.color} shadow-sm`
                            : 'bg-[#4a5d4c]/5 text-[#4a5d4c]/40 border-transparent hover:border-[#4a5d4c]/10'
                        }`}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="flex-1 py-4 rounded-2xl bg-[#4a5d4c]/5 text-[#4a5d4c]/40 font-bold text-sm"
                  >
                    取消
                  </button>
                  <button
                    onClick={addTodo}
                    disabled={!todo.trim()}
                    className={`flex-[2] py-4 rounded-2xl flex items-center justify-center gap-2 transition-all font-bold text-sm ${
                      todo.trim() ? 'bg-[#4a5d4c] text-white shadow-lg shadow-[#4a5d4c]/20' : 'bg-[#4a5d4c]/5 text-[#4a5d4c]/20'
                    }`}
                  >
                    <Check size={18} strokeWidth={3} />
                    加入清单
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence initial={false}>
          {todos.length > 0 && (
            <div className="space-y-3">
              {todos.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white/40 border border-white p-4 rounded-2xl flex items-center justify-between group backdrop-blur-sm shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-5 h-5 rounded-full border-2 border-[#8fae91]" />
                    <div>
                      <span className="text-sm font-bold text-[#4a5d4c] block">{t.text}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-[#4a5d4c]/50 flex items-center gap-1">
                          <Clock size={10} /> {t.time}
                        </span>
                        {t.repeat && (
                          <span className="text-[10px] text-[#4a5d4c]/50">
                            <Repeat size={10} />
                          </span>
                        )}
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${
                            t.urgency === 'high'
                              ? 'bg-red-50 text-red-500 border-red-100'
                              : t.urgency === 'medium'
                                ? 'bg-orange-50 text-orange-500 border-orange-100'
                                : 'bg-blue-50 text-blue-500 border-blue-100'
                          }`}
                        >
                          {t.urgency === 'high' ? '紧急' : t.urgency === 'medium' ? '重要' : '普通'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeTodo(t.id)} className="p-2 text-[#4a5d4c]/20 hover:text-red-400 transition-colors">
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        <div className="p-6 bg-white/30 border border-white rounded-[28px]">
          <p className="text-[10px] font-black text-[#4a5d4c]/40 uppercase tracking-widest mb-4">或者尝试以下推荐</p>
          <div className="flex flex-wrap gap-2">
            {['冥想 5 分钟', '整理桌面', '喝一杯温水', '深呼吸'].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setTodo(suggestion);
                  setIsExpanded(true);
                }}
                className="px-4 py-2 bg-white rounded-xl text-xs font-bold text-[#4a5d4c] shadow-sm border border-[#8fae91]/10 hover:border-[#8fae91] transition-all active:scale-95"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-8">
        {todos.length > 0 ? (
          <button
            onClick={onNext}
            className="w-full bg-[#4a5d4c] text-white py-5 rounded-[28px] font-bold text-lg shadow-xl shadow-[#4a5d4c]/20 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            全部计划完毕 <ChevronRight size={20} />
          </button>
        ) : (
          <div className="py-5 text-center text-[11px] text-[#4a5d4c]/30 font-bold uppercase tracking-[0.2em]">
            请至少添加一个待办事项以继续
          </div>
        )}
      </div>
    </div>
  );
}
