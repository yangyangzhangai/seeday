// DOC-DEPS: LLM.md -> src/features/growth/README.md -> src/store/useTodoStore.ts
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, AlarmClock, Play } from 'lucide-react';
import { cn } from '../../lib/utils';
import { triggerLightHaptic } from '../../lib/haptics';
import { callTodoDecomposeAPI, type DecomposeStep } from '../../api/client';
import { useTodoStore, type GrowthTodo } from '../../store/useTodoStore';
import i18n from '../../i18n';
import type { SupportedLang } from '../../services/input/lexicon/getLexicon';

interface Props {
  parentTodo: GrowthTodo;
  subTodos: GrowthTodo[];
  onToggleSub: (id: string) => void;
  onFocusSub: (todo: GrowthTodo) => void;
  onSequentialFocus: (subTodos: GrowthTodo[]) => void;
}

function resolveLang(): SupportedLang {
  const lang = i18n.language?.toLowerCase() ?? 'zh';
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('it')) return 'it';
  return 'zh';
}

export const SubTodoList = ({ parentTodo, subTodos, onToggleSub, onFocusSub, onSequentialFocus }: Props) => {
  const { t } = useTranslation();
  const addSubTodos = useTodoStore((s) => s.addSubTodos);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const pendingSubs = subTodos.filter((s) => !s.completed);

  const handleDecompose = async () => {
    if (loading) return;
    triggerLightHaptic();
    setLoading(true);
    setError(false);
    try {
      const steps: DecomposeStep[] = await callTodoDecomposeAPI(parentTodo.title, resolveLang());
      if (steps.length > 0) {
        addSubTodos(parentTodo.id, steps);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const hasSubTodos = subTodos.length > 0;

  return (
    <div className="pt-2 border-t border-gray-100">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400">{t('todo_decompose_steps_label')}</p>
        {!hasSubTodos && (
          <button
            onClick={handleDecompose}
            disabled={loading}
            className={cn(
              'text-xs px-2.5 py-1 rounded-lg border transition-all',
              loading
                ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                : 'border-sky-200 text-sky-600 bg-sky-50 hover:bg-sky-100 active:scale-95'
            )}
          >
            {loading ? t('todo_decompose_loading') : t('todo_decompose_btn')}
          </button>
        )}
        {hasSubTodos && (
          <button
            onClick={handleDecompose}
            disabled={loading}
            className="text-[10px] text-gray-400 hover:text-sky-500 transition-colors"
          >
            {loading ? t('todo_decompose_loading') : t('todo_decompose_btn')}
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-2">{t('todo_decompose_error')}</p>
      )}

      {/* Sub-todo list */}
      {hasSubTodos && (
        <>
          <div className="space-y-1.5 mb-3">
            {subTodos.map((sub) => (
              <div
                key={sub.id}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50',
                  sub.completed && 'opacity-50'
                )}
              >
                {/* Checkbox */}
                <button
                  onPointerUp={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    triggerLightHaptic();
                    onToggleSub(sub.id);
                  }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  className={cn(
                    'w-4.5 h-4.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors',
                    sub.completed ? 'bg-blue-400 border-blue-400' : 'border-gray-300'
                  )}
                >
                  {sub.completed && <Check size={9} className="text-white" />}
                </button>

                {/* Title + duration */}
                <span className={cn('flex-1 text-xs text-gray-700 truncate', sub.completed && 'line-through text-gray-400')}>
                  {sub.title}
                </span>
                {sub.suggestedDuration && !sub.completed && (
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {sub.suggestedDuration}{t('todo_decompose_min')}
                  </span>
                )}

                {/* Single-step focus */}
                {!sub.completed && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); triggerLightHaptic(); onFocusSub(sub); }}
                      className="p-1 rounded hover:bg-gray-200 text-gray-400 transition-colors"
                    >
                      <AlarmClock size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Sequential focus button — only when 2+ pending sub-todos */}
          {pendingSubs.length >= 2 && (
            <button
              onClick={(e) => { e.stopPropagation(); triggerLightHaptic(); onSequentialFocus(pendingSubs); }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all active:scale-95"
              style={{
                background: 'rgba(125, 211, 252, 0.10)',
                border: '1px solid rgba(125, 211, 252, 0.35)',
                color: 'rgb(14, 116, 144)',
              }}
            >
              <Play size={12} />
              {t('todo_sequential_focus')}
            </button>
          )}
        </>
      )}
    </div>
  );
};
