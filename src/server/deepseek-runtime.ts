// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/AI_USAGE_INVENTORY.md -> api/README.md
import OpenAI from 'openai';

export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-flash';

type DeepSeekRuntimeOverrides = {
  apiKey?: string;
  baseURL?: string;
  model?: string;
};

function firstNonEmpty(...values: Array<string | undefined>): string {
  return values.map((value) => String(value || '').trim()).find(Boolean) || '';
}

export function resolveDeepSeekRuntime(overrides: DeepSeekRuntimeOverrides = {}): {
  provider: 'deepseek';
  apiKey: string;
  baseURL: string;
  model: string;
} {
  return {
    provider: 'deepseek',
    apiKey: firstNonEmpty(overrides.apiKey, process.env.DEEPSEEK_API_KEY),
    baseURL: firstNonEmpty(
      overrides.baseURL,
      process.env.DEEPSEEK_BASE_URL,
      DEFAULT_DEEPSEEK_BASE_URL,
    ).replace(/\/+$/, ''),
    model: firstNonEmpty(overrides.model, DEFAULT_DEEPSEEK_MODEL),
  };
}

export function createDeepSeekClient(runtime: {
  apiKey: string;
  baseURL: string;
}): OpenAI {
  return new OpenAI({
    apiKey: runtime.apiKey,
    baseURL: runtime.baseURL,
  });
}

export function getDeepSeekChatCompletionsUrl(baseURL: string): string {
  return `${baseURL.replace(/\/+$/, '')}/chat/completions`;
}
