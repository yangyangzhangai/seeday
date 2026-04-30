// DOC-DEPS: LLM.md -> src/features/growth/README.md -> src/store/useTodoStore.ts
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, AlarmClock, Play, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { triggerLightHaptic } from '../../lib/haptics';
import { callTodoDecomposeAPI, isMembershipRequiredError } from '../../api/client';
import { reportTelemetryEvent } from '../../services/input/reportTelemetryEvent';
import { useTodoStore, type GrowthTodo } from '../../store/useTodoStore';
import { useAuthStore } from '../../store/useAuthStore';
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
  const navigate = useNavigate();
  const isPlus = useAuthStore((s) => s.isPlus);
  const addSubTodos = useTodoStore((s) => s.addSubTodos);
  const [loading, setLoading] = useState(false);
  const [errorType, setErrorType] = useState<'request' | 'empty' | null>(null);
  const [expandedSubTitle, setExpandedSubTitle] = useState<string | null>(null);

  const pendingSubs = subTodos.filter((s) => !s.completed);
  const hasSubTodos = subTodos.length > 0;

  const handleDecompose = async () => {
    if (loading) return;
    if (!isPlus) {
      window.alert(t('profile_plus_only'));
      navigate('/upgrade');
      return;
    }
    const lang = resolveLang();
    const requestId = `decompose_${parentTodo.id}_${Date.now()}`;
    const telemetryBase = {
      requestId,
      todoId: parentTodo.id,
      lang,
      isRegenerate: hasSubTodos,
      entry: 'growth_manual',
    };
    triggerLightHaptic();
    setLoading(true);
    setErrorType(null);
    void reportTelemetryEvent('todo_decompose_requested', telemetryBase);
    if (hasSubTodos) {
      void reportTelemetryEvent('todo_decompose_regenerate_clicked', telemetryBase);
    }
    try {
      const result = await callTodoDecomposeAPI(parentTodo.title, lang);
      const normalizedSteps = result.steps
        .map((step) => ({
          title: step.title,
          suggestedDuration: step.durationMinutes,
        }))
        .filter((step) => step.title.trim());
      if (normalizedSteps.length === 0) {
        void reportTelemetryEvent(
          result.parseStatus === 'parse_failed' ? 'todo_decompose_parse_failed' : 'todo_decompose_empty',
          {
            ...telemetryBase,
            model: result.model,
            provider: result.provider,
          },
        );
        setErrorType('empty');
        return;
      }
      addSubTodos(parentTodo.id, normalizedSteps, { replaceExisting: hasSubTodos });
      void reportTelemetryEvent('todo_decompose_succeeded', {
        ...telemetryBase,
        model: result.model,
        provider: result.provider,
        stepsCount: normalizedSteps.length,
        durationTotalMin: normalizedSteps.reduce((sum, step) => sum + step.suggestedDuration, 0),
      });
    } catch (error) {
      void reportTelemetryEvent('todo_decompose_failed', telemetryBase);
      if (isMembershipRequiredError(error)) {
        window.alert(t('profile_plus_only'));
        navigate('/upgrade');
        return;
      }
      setErrorType('request');
    } finally {
      setLoading(false);
    }
  };

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
            className="text-xs text-gray-400 hover:text-sky-500 transition-colors"
          >
            {loading ? t('todo_decompose_loading') : t('todo_decompose_regenerate_btn')}
          </button>
        )}
      </div>

      {errorType && (
        <p className="text-xs text-red-400 mb-2">{t(errorType === 'empty' ? 'todo_decompose_empty' : 'todo_decompose_error')}</p>
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
                <button
                  type="button"
                  title={sub.title}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setExpandedSubTitle(sub.title);
                  }}
                  className={cn(
                    'flex-1 min-w-0 text-left text-xs text-gray-700 break-words leading-5',
                    sub.completed && 'line-through text-gray-400'
                  )}
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {sub.title}
                </button>
                {sub.suggestedDuration && !sub.completed && (
                  <span className="text-xs text-gray-400 flex-shrink-0">
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
                      <AlarmClock size={16} strokeWidth={1.5} />
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
              <Play size={16} strokeWidth={1.5} />
              {t('todo_sequential_focus')}
            </button>
          )}
        </>
      )}

      {expandedSubTitle && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/35"
          onClick={() => setExpandedSubTitle(null)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-1">
              <button
                type="button"
                onClick={() => setExpandedSubTitle(null)}
                className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100"
                aria-label={t('confirm')}
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-gray-700 leading-6 break-words">{expandedSubTitle}</p>
          </div>
        </div>
      )}
    </div>
  );
};
