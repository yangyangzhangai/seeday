// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import OpenAI from 'openai';
import type { AnnotationPromptPackage } from './annotation-prompt-builder.js';

type AnnotationRuntimeProvider = 'qwen' | 'gemini' | 'deepseek' | 'openai';
type AnnotationLang = 'zh' | 'en' | 'it';

interface AnnotationLLMCallParams {
  provider: AnnotationRuntimeProvider;
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

function normalizeGeminiModel(model: string): string {
  const trimmed = String(model || '').trim();
  if (!trimmed) return 'gemini-2.5-flash';
  if (trimmed === 'gemini2.0-flash') return 'gemini-2.0-flash';
  if (trimmed === 'gemini2.5-flash') return 'gemini-2.5-flash';
  if (trimmed.startsWith('models/')) return trimmed.slice(7);
  return trimmed;
}

function isVertexGeminiBase(baseURL: string): boolean {
  return /aiplatform\.googleapis\.com/i.test(baseURL);
}

function buildGeminiGenerateContentUrl(baseURL: string, model: string, apiKey: string): string {
  const normalizedBase = baseURL.replace(/\/$/, '');
  const modelPath = isVertexGeminiBase(normalizedBase)
    ? `publishers/google/models/${model}`
    : `models/${model}`;
  return `${normalizedBase}/${modelPath}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

export async function callAnnotationLLM(
  client: OpenAI | undefined,
  params: AnnotationLLMCallParams,
): Promise<AnnotationLLMCallResult> {
  if (params.provider === 'gemini') {
    const apiKey = String(params.apiKey || '').trim();
    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY for annotation');
    }
    const geminiBase = String(params.baseURL || 'https://aiplatform.googleapis.com/v1').replace(/\/$/, '');
    if (/\/openai$/i.test(geminiBase)) {
      if (!client) {
        throw new Error('Missing OpenAI client for Gemini OpenAI-compatible mode');
      }
      const response = await client.responses.create({
        model: params.model,
        instructions: params.instructions,
        input: params.input,
        temperature: params.temperature,
        max_output_tokens: params.maxOutputTokens,
      });
      return {
        outputText: response.output_text || '',
        usage: response.usage,
        responseId: response.id,
      };
    }
    const geminiModel = normalizeGeminiModel(params.model);
    const response = await fetch(buildGeminiGenerateContentUrl(geminiBase, geminiModel, apiKey), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: params.instructions }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: params.input }],
          },
        ],
        generationConfig: {
          temperature: params.temperature,
          maxOutputTokens: params.maxOutputTokens,
          ...(params.expectJson ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini annotation failed: ${response.status} ${errorText}`);
    }
    const payload = (await response.json()) as {
      usageMetadata?: unknown;
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };
    const outputText = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
    return {
      outputText,
      usage: payload.usageMetadata,
    };
  }

  if (!client) {
    throw new Error(`Missing OpenAI client for provider: ${params.provider}`);
  }

  if (params.provider === 'deepseek') {
    const completion = await client.chat.completions.create({
      model: params.model,
      messages: [
        { role: 'system', content: params.instructions },
        { role: 'user', content: params.input },
      ],
      temperature: params.temperature,
      max_tokens: params.maxOutputTokens,
    });

    return {
      outputText: completion.choices?.[0]?.message?.content || '',
      usage: completion.usage,
      responseId: completion.id,
    };
  }

  const response = await client.responses.create({
    model: params.model,
    instructions: params.instructions,
    input: params.input,
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
