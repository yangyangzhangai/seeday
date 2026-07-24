// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { RecoveryNudgeContext } from '../types/annotation.js';
import {
  buildForcedFallbackSuggestion,
  buildRecoveryFallbackSuggestion,
  isRecoveryContentCompliant,
  normalizeRecoverySuggestion,
  normalizeSuggestion,
} from './annotation-suggestion.js';

type AnnotationLang = 'zh' | 'en' | 'it';

type PendingTodoCandidate = {
  id: string;
  title: string;
  category?: string;
};

type ParsedSuggestionPayload = {
  content: string;
  suggestion?: Record<string, unknown>;
};

type ResolvedSuggestionResult = {
  content: string;
  suggestion?: Record<string, unknown>;
  usedFallback: boolean;
};

function normalizeComparableText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findTodoById(todos: PendingTodoCandidate[], todoId: unknown): PendingTodoCandidate | undefined {
  if (typeof todoId !== 'string' || !todoId.trim()) return undefined;
  return todos.find((todo) => todo.id === todoId.trim());
}

function contentMentionsOtherTodo(
  content: string,
  selectedTodoId: string,
  todos: PendingTodoCandidate[],
): boolean {
  const normalizedContent = normalizeComparableText(content);
  if (!normalizedContent) return false;

  return todos.some((todo) => {
    if (todo.id === selectedTodoId) return false;
    const normalizedTitle = normalizeComparableText(todo.title);
    return normalizedTitle.length >= 2 && normalizedContent.includes(normalizedTitle);
  });
}

function buildWholeFallback(
  lang: AnnotationLang,
  todos: PendingTodoCandidate[],
  recoveryNudge?: RecoveryNudgeContext,
): ResolvedSuggestionResult {
  const fallback = recoveryNudge
    ? buildRecoveryFallbackSuggestion(lang, recoveryNudge)
    : buildForcedFallbackSuggestion(lang, todos);
  return {
    content: fallback.content,
    suggestion: fallback.suggestion,
    usedFallback: true,
  };
}

function resolveTodoSuggestion(
  content: string,
  suggestion: Record<string, unknown>,
  todos: PendingTodoCandidate[],
): ResolvedSuggestionResult | null {
  const selectedTodo = findTodoById(todos, suggestion.todoId);
  if (!selectedTodo) return null;
  if (contentMentionsOtherTodo(content, selectedTodo.id, todos)) return null;

  return {
    content,
    suggestion: {
      ...suggestion,
      todoId: selectedTodo.id,
      todoTitle: selectedTodo.title,
    },
    usedFallback: false,
  };
}

export function resolveSuggestionResult(input: {
  lang: AnnotationLang;
  parsedPayload: ParsedSuggestionPayload;
  pendingTodos: PendingTodoCandidate[];
  forceSuggestion: boolean;
  recoveryNudge?: RecoveryNudgeContext;
}): ResolvedSuggestionResult {
  const { lang, parsedPayload, pendingTodos, forceSuggestion, recoveryNudge } = input;
  const content = parsedPayload.content;
  const normalizedSuggestion = recoveryNudge
    ? normalizeRecoverySuggestion(lang, parsedPayload.suggestion, recoveryNudge)
    : normalizeSuggestion(lang, parsedPayload.suggestion, recoveryNudge);

  if (!normalizedSuggestion) {
    return forceSuggestion
      ? buildWholeFallback(lang, pendingTodos, recoveryNudge)
      : { content, suggestion: undefined, usedFallback: false };
  }

  if (normalizedSuggestion.type === 'todo') {
    const resolvedTodo = resolveTodoSuggestion(content, normalizedSuggestion, pendingTodos);
    if (!resolvedTodo) {
      return forceSuggestion
        ? buildWholeFallback(lang, pendingTodos, recoveryNudge)
        : { content, suggestion: undefined, usedFallback: false };
    }
    if (recoveryNudge && !isRecoveryContentCompliant(lang, resolvedTodo.content)) {
      return buildWholeFallback(lang, pendingTodos, recoveryNudge);
    }
    return resolvedTodo;
  }

  if (recoveryNudge && !isRecoveryContentCompliant(lang, content)) {
    return buildWholeFallback(lang, pendingTodos, recoveryNudge);
  }

  return {
    content,
    suggestion: normalizedSuggestion,
    usedFallback: false,
  };
}

export function resolveForcedSuggestionFallback(input: {
  lang: AnnotationLang;
  pendingTodos: PendingTodoCandidate[];
  recoveryNudge?: RecoveryNudgeContext;
}): ResolvedSuggestionResult {
  return buildWholeFallback(input.lang, input.pendingTodos, input.recoveryNudge);
}
