// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/AI_USAGE_INVENTORY.md -> api/README.md
import OpenAI from 'openai';
import { resolveDeepSeekRuntime } from './deepseek-runtime.js';
import { resolveAiRoute } from './ai-routing.js';

export type AnnotationProvider = 'deepseek' | 'openai';

export function resolveAnnotationRuntime(model: string, lang = 'zh'): {
  provider: AnnotationProvider;
  apiKey: string;
  baseURL?: string;
} {
  if (resolveAiRoute('annotation', lang).provider === 'deepseek') {
    const runtime = resolveDeepSeekRuntime({
      baseURL: process.env.ANNOTATION_DEEPSEEK_BASE_URL,
      model,
    });
    return {
      provider: 'deepseek',
      apiKey: runtime.apiKey,
      baseURL: runtime.baseURL,
    };
  }
  return {
    provider: 'openai',
    apiKey: String(process.env.OPENAI_API_KEY || '').trim(),
    baseURL: String(process.env.OPENAI_BASE_URL || '').trim() || undefined,
  };
}

export function createAnnotationClient(runtime: {
  apiKey: string;
  baseURL?: string;
}): OpenAI {
  return new OpenAI({
    apiKey: runtime.apiKey,
    ...(runtime.baseURL ? { baseURL: runtime.baseURL } : {}),
  });
}
