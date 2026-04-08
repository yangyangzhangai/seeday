// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import { z } from 'zod';
import type { RecoveryNudgeContext } from '../types/annotation.js';

type AnnotationLang = 'zh' | 'en' | 'it';

const rawSuggestionSchema = z.object({
  type: z.enum(['activity', 'todo']).default('activity'),
  actionLabel: z.string().trim().min(1).optional(),
  activityName: z.string().trim().min(1).optional(),
  todoId: z.string().trim().min(1).optional(),
  todoTitle: z.string().trim().optional(),
  rewardStars: z.union([z.number(), z.string()]).optional(),
  rewardBottleId: z.string().trim().optional(),
  recoveryKey: z.string().trim().optional(),
});

const suggestionModeSchema = z.object({
  mode: z.literal('suggestion'),
  content: z.string().trim().min(1),
  suggestion: rawSuggestionSchema,
});

const legacySuggestionSchema = z.object({
  type: z.enum(['activity', 'todo']),
  message: z.string().trim().optional(),
  content: z.string().trim().optional(),
  actionLabel: z.string().trim().min(1).optional(),
  activityName: z.string().trim().optional(),
  todoId: z.string().trim().optional(),
  todoTitle: z.string().trim().optional(),
  rewardStars: z.union([z.number(), z.string()]).optional(),
  rewardBottleId: z.string().trim().optional(),
  recoveryKey: z.string().trim().optional(),
});

function extractJsonCandidate(raw: string): string | null {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    const candidate = fencedMatch[1].trim();
    if (candidate.startsWith('{') && candidate.endsWith('}')) {
      return candidate;
    }
  }

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const candidate = raw.slice(start, end + 1).trim();
  if (!candidate) {
    return null;
  }

  return candidate;
}

function toPlainObject(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  return raw as Record<string, unknown>;
}

export function extractSuggestionPayload(raw: string): {
  content: string;
  suggestion?: Record<string, unknown>;
} | null {
  const candidate = extractJsonCandidate(raw);
  if (!candidate) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }

  const modeResult = suggestionModeSchema.safeParse(parsed);
  if (modeResult.success) {
    return {
      content: modeResult.data.content,
      suggestion: toPlainObject(modeResult.data.suggestion) ?? undefined,
    };
  }

  const legacyResult = legacySuggestionSchema.safeParse(parsed);
  if (!legacyResult.success) {
    return null;
  }

  const content = String(legacyResult.data.message || legacyResult.data.content || '').trim();
  if (!content) {
    return null;
  }

  return {
    content,
    suggestion: toPlainObject(legacyResult.data) ?? undefined,
  };
}

export function normalizeSuggestion(
  lang: AnnotationLang,
  suggestion: Record<string, unknown> | undefined,
  recoveryNudge?: RecoveryNudgeContext,
): Record<string, unknown> | undefined {
  if (!suggestion) return undefined;

  const parsedSuggestion = rawSuggestionSchema.safeParse(suggestion);
  if (!parsedSuggestion.success) {
    return undefined;
  }

  const source = parsedSuggestion.data;
  const suggestionType = source.type === 'todo' ? 'todo' : 'activity';
  const normalized: Record<string, unknown> = {
    type: suggestionType,
    actionLabel: String(source.actionLabel || '').trim(),
  };

  if (suggestionType === 'todo' && source.todoId) {
    normalized.todoId = String(source.todoId);
    normalized.todoTitle = String(source.todoTitle || '').trim();
  } else {
    normalized.type = 'activity';
    normalized.activityName = String(source.activityName || '').trim();
  }

  if (!normalized.actionLabel) {
    const title = String(normalized.todoTitle || normalized.activityName || '').trim();
    if (lang === 'zh') {
      normalized.actionLabel = title ? `去${title}` : '去行动';
    } else if (lang === 'it') {
      normalized.actionLabel = title ? `Vai ${title}` : 'Vai ora';
    } else {
      normalized.actionLabel = title ? `Go ${title}` : 'Take action';
    }
  }

  const rewardStarsFromPayload = Number(source.rewardStars);
  if (Number.isFinite(rewardStarsFromPayload) && rewardStarsFromPayload > 1) {
    normalized.rewardStars = Math.floor(rewardStarsFromPayload);
  }

  if (typeof source.rewardBottleId === 'string' && source.rewardBottleId.trim()) {
    normalized.rewardBottleId = source.rewardBottleId.trim();
  }

  if (typeof source.recoveryKey === 'string' && source.recoveryKey.trim()) {
    normalized.recoveryKey = source.recoveryKey.trim();
  }

  if (recoveryNudge) {
    normalized.rewardStars = 2;
    normalized.recoveryKey = recoveryNudge.key;
    if (recoveryNudge.bottleId) {
      normalized.rewardBottleId = recoveryNudge.bottleId;
    }
    if (recoveryNudge.todoId) {
      normalized.type = 'todo';
      normalized.todoId = recoveryNudge.todoId;
      if (recoveryNudge.todoTitle) {
        normalized.todoTitle = recoveryNudge.todoTitle;
      }
    } else if (recoveryNudge.activityName) {
      normalized.type = 'activity';
      normalized.activityName = recoveryNudge.activityName;
    }
  }

  return normalized;
}

export function buildRecoveryFallbackSuggestion(
  lang: AnnotationLang,
  recoveryNudge: RecoveryNudgeContext,
): { content: string; suggestion: Record<string, unknown> } {
  const actionLabel = lang === 'en'
    ? 'Start now'
    : lang === 'it'
      ? 'Inizia ora'
      : '现在开始';

  const title = recoveryNudge.todoTitle || recoveryNudge.bottleName || recoveryNudge.activityName || '';
  const content = lang === 'en'
    ? `You can bounce back today - finish ${title || 'one small step'} and earn two stars ⭐`
    : lang === 'it'
      ? `Puoi ripartire oggi: completa ${title || 'un piccolo passo'} e ottieni due stelle ⭐`
      : `你今天补回来就能拿到两颗星，先完成${title || '一个小步骤'} ⭐`;

  return {
    content,
    suggestion: {
      type: recoveryNudge.todoId ? 'todo' : 'activity',
      actionLabel,
      todoId: recoveryNudge.todoId,
      todoTitle: recoveryNudge.todoTitle,
      activityName: recoveryNudge.activityName,
      rewardStars: 2,
      rewardBottleId: recoveryNudge.bottleId,
      recoveryKey: recoveryNudge.key,
    },
  };
}

export function buildForcedFallbackSuggestion(
  lang: AnnotationLang,
  pendingTodos: Array<{ id: string; title: string; category?: string }> = [],
): { content: string; suggestion: Record<string, unknown> } {
  const firstTodo = pendingTodos[0];

  if (firstTodo) {
    if (lang === 'en') {
      return {
        content: `Let's start small: ${firstTodo.title}, just begin now 🌿`,
        suggestion: {
          type: 'todo',
          todoId: firstTodo.id,
          todoTitle: firstTodo.title,
          actionLabel: 'Start now',
        },
      };
    }

    if (lang === 'it') {
      return {
        content: `Partiamo in piccolo: ${firstTodo.title}, inizia ora 🌿`,
        suggestion: {
          type: 'todo',
          todoId: firstTodo.id,
          todoTitle: firstTodo.title,
          actionLabel: 'Inizia ora',
        },
      };
    }

    return {
      content: `先从小步开始：${firstTodo.title}，现在就动一下 🌿`,
      suggestion: {
        type: 'todo',
        todoId: firstTodo.id,
        todoTitle: firstTodo.title,
        actionLabel: '现在去做',
      },
    };
  }

  if (lang === 'en') {
    return {
      content: 'Try a tiny reset: drink water and walk for two minutes 🌿',
      suggestion: {
        type: 'activity',
        activityName: 'drink water and walk for two minutes',
        actionLabel: 'Do it now',
      },
    };
  }

  if (lang === 'it') {
    return {
      content: 'Fai un reset minimo: acqua e due minuti di movimento 🌿',
      suggestion: {
        type: 'activity',
        activityName: 'bevi acqua e cammina due minuti',
        actionLabel: 'Vai ora',
      },
    };
  }

  return {
    content: '先做一个两分钟的小动作：喝水并走一走 🌿',
    suggestion: {
      type: 'activity',
      activityName: '喝水并走两分钟',
      actionLabel: '去行动',
    },
  };
}
