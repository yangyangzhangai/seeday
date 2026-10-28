// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type OpenAI from 'openai';
import type { AnnotationPromptPackage } from './annotation-prompt-builder.js';
import type { AnnotationProvider } from './annotation-provider-runtime.js';
import { aiChatRequestOptions } from './ai-routing.js';

type AnnotationLang = 'zh' | 'en' | 'it';

interface AnnotationLLMCallParams {
  provider: AnnotationProvider;
  model: string;
  instructions: string;
  input: string;
  temperature: number;
  maxOutputTokens: number;
  apiKey?: string;
  baseURL?: string;
  expectJson?: boolean;
}

interface AnnotationLLMCallResult {
  outputText: string;
  usage?: unknown;
  responseId?: string;
  finishReason?: string;
}

const STALE_TODO_DAYS_THRESHOLD = 3;
const OVERDUE_TODO_MS_THRESHOLD = 24 * 60 * 60 * 1000;

export type PendingTodoLite = {
  id: string;
  title: string;
  dueAt?: number | string;
  createdAt?: number | string;
  ageDays?: number;
};

export async function callAnnotationLLM(
  client: OpenAI,
  params: AnnotationLLMCallParams,
): Promise<AnnotationLLMCallResult> {
  if (params.provider === 'deepseek') {
    const completion = await client.chat.completions.create({
      model: params.model,
      messages: [
        { role: 'system', content: params.instructions },
        { role: 'user', content: params.input },
      ],
      temperature: params.temperature,
      max_tokens: params.maxOutputTokens,
      ...aiChatRequestOptions('deepseek'),
      ...(params.expectJson ? { response_format: { type: 'json_object' } } : {}),
    });

    return {
      outputText: completion.choices?.[0]?.message?.content || '',
      usage: completion.usage,
      responseId: completion.id,
      finishReason: completion.choices?.[0]?.finish_reason,
    };
  }

  const response = await client.responses.create({
    model: params.model,
    instructions: params.instructions,
    input: params.input,
    store: false,
    temperature: params.temperature,
    max_output_tokens: params.maxOutputTokens,
  });

  return {
    outputText: response.output_text || '',
    usage: response.usage,
    responseId: response.id,
  };
}

export function buildPromptDebugPayload(
  promptPackage: AnnotationPromptPackage | undefined,
  includePromptDebug: boolean,
): {
  debugPromptPackage?: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
  };
} {
  if (!includePromptDebug || !promptPackage) return {};
  return {
    debugPromptPackage: {
      model: promptPackage.model,
      systemPrompt: promptPackage.instructions,
      userPrompt: promptPackage.input,
    },
  };
}

function toTimestampMs(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw < 1e11 ? raw * 1000 : raw;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return numeric < 1e11 ? numeric * 1000 : numeric;
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function shouldPreDecomposeTodo(todo: PendingTodoLite | undefined, nowMs: number): boolean {
  if (!todo) return false;
  if (typeof todo.ageDays === 'number' && Number.isFinite(todo.ageDays) && todo.ageDays >= STALE_TODO_DAYS_THRESHOLD) {
    return true;
  }

  const createdAtMs = toTimestampMs(todo.createdAt);
  if (createdAtMs !== null && nowMs - createdAtMs >= STALE_TODO_DAYS_THRESHOLD * 24 * 60 * 60 * 1000) {
    return true;
  }

  const dueAtMs = toTimestampMs(todo.dueAt);
  if (dueAtMs !== null && nowMs - dueAtMs >= OVERDUE_TODO_MS_THRESHOLD) {
    return true;
  }

  return false;
}

export function buildDecomposeReadyContent(lang: AnnotationLang, todoTitle: string, stepCount: number): string {
  if (lang === 'en') {
    return `I've already split "${todoTitle}" into ${stepCount} small steps. Tap start and begin step 1 🌿`;
  }
  if (lang === 'it') {
    return `Ho gia diviso "${todoTitle}" in ${stepCount} piccoli passi. Tocca avvia e inizia dal primo 🌿`;
  }
  return `我已经把「${todoTitle}」拆成${stepCount}个小步骤了，点开始就先做第一步 🌿`;
}

export function buildDecomposeReadyActionLabel(lang: AnnotationLang): string {
  if (lang === 'en') return 'Start step 1';
  if (lang === 'it') return 'Inizia dal passo 1';
  return '开始第一步';
}
