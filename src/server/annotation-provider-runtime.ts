// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import OpenAI from 'openai';

type AnnotationProvider = 'qwen' | 'gemini' | 'deepseek' | 'openai';

const DEFAULT_QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

function resolveProviderFromModel(model: string): AnnotationProvider {
  const normalized = String(model || '').toLowerCase();
  if (normalized.includes('deepseek')) return 'deepseek';
  if (normalized.includes('gemini')) return 'gemini';
  if (normalized.includes('qwen')) return 'qwen';
  return 'openai';
}

export function resolveAnnotationRuntime(model: string): {
  provider: AnnotationProvider;
  apiKey: string;
  baseURL?: string;
} {
  const provider = resolveProviderFromModel(model);
  if (provider === 'deepseek') {
    return {
      provider,
      apiKey: String(process.env.DEEPSEEK_API_KEY || '').trim(),
      baseURL: String(
        process.env.ANNOTATION_DEEPSEEK_BASE_URL
        || process.env.DEEPSEEK_BASE_URL
        || DEFAULT_DEEPSEEK_BASE_URL,
      ).trim(),
    };
  }
  if (provider === 'gemini') {
    return {
      provider,
      apiKey: String(process.env.GEMINI_API_KEY || '').trim(),
      baseURL: String(process.env.ANNOTATION_GEMINI_BASE_URL || DEFAULT_GEMINI_BASE_URL).trim(),
    };
  }
  if (provider === 'qwen') {
    return {
      provider,
      apiKey: String(process.env.QWEN_API_KEY || '').trim(),
      baseURL: String(
        process.env.ANNOTATION_QWEN_BASE_URL
        || process.env.DASHSCOPE_BASE_URL
        || DEFAULT_QWEN_BASE_URL,
      ).trim(),
    };
  }
  return {
    provider,
    apiKey: String(process.env.OPENAI_API_KEY || '').trim(),
  };
}

export function createAnnotationClient(runtime: { apiKey: string; baseURL?: string }): OpenAI {
  return new OpenAI({
    apiKey: runtime.apiKey,
    ...(runtime.baseURL ? { baseURL: runtime.baseURL } : {}),
  });
}
