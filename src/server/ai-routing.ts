// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/AI_USAGE_INVENTORY.md -> api/README.md
import OpenAI from 'openai';
import { resolveDeepSeekRuntime } from './deepseek-runtime.js';

export type AiFeature = 'annotation' | 'classify' | 'magic_pen' | 'todo_decompose'
  | 'diary' | 'insight' | 'profile' | 'plant';
export type AiProvider = 'deepseek' | 'openai' | 'gemini';
export interface AiRoute { provider: AiProvider; model: string }
export interface AiChatRuntime extends AiRoute { apiKey: string; baseURL: string }

const LEGACY_OPENAI_MODELS: Partial<Record<AiFeature, string>> = {
  annotation: 'gpt-4.1-mini', diary: 'gpt-4o', insight: 'gpt-4o-mini',
  profile: 'gpt-4o-mini', plant: 'gpt-4.1-mini',
};

export function usesLegacyAiRouting(): boolean {
  // Unknown values stay on DeepSeek; a typo must never enable another provider.
  return process.env.AI_PROVIDER_MODE?.trim().toLowerCase() === 'legacy';
}

function legacyRoute(feature: AiFeature, lang: string): AiRoute {
  if (feature === 'todo_decompose' && (lang === 'en' || lang === 'it')) {
    return { provider: 'gemini', model: process.env.TODO_DECOMPOSE_MODEL?.trim() || 'gemini-2.5-flash' };
  }
  const openaiModel = LEGACY_OPENAI_MODELS[feature];
  if (openaiModel && (feature !== 'annotation' || lang === 'en' || lang === 'it')) {
    return { provider: 'openai', model: feature === 'profile'
      ? process.env.PROFILE_EXTRACT_MODEL?.trim() || openaiModel : openaiModel };
  }
  const overrides: Partial<Record<AiFeature, string | undefined>> = {
    classify: process.env.CLASSIFY_MODEL, magic_pen: process.env.MAGIC_PEN_MODEL,
    todo_decompose: process.env.TODO_DECOMPOSE_MODEL_ZH,
  };
  return { provider: 'deepseek', model: overrides[feature]?.trim() || 'deepseek-flash' };
}

export function resolveAiRoute(feature: AiFeature, lang = 'zh'): AiRoute {
  if (usesLegacyAiRouting()) return legacyRoute(feature, lang);
  const model = feature === 'diary'
    ? process.env.DEEPSEEK_PRO_MODEL?.trim() || 'deepseek-v4-pro'
    : process.env.DEEPSEEK_FLASH_MODEL?.trim() || 'deepseek-flash';
  return { provider: 'deepseek', model };
}

export function resolveAiChatRuntime(feature: AiFeature, lang = 'zh'): AiChatRuntime {
  const route = resolveAiRoute(feature, lang);
  if (route.provider === 'gemini') throw new Error('Gemini requires the native generateContent adapter');
  if (route.provider === 'deepseek') {
    return resolveDeepSeekRuntime({ model: route.model });
  }
  return { ...route, apiKey: process.env.OPENAI_API_KEY?.trim() || '',
    baseURL: (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '') };
}

export function createAiChatClient(runtime: AiChatRuntime): OpenAI {
  return new OpenAI({ apiKey: runtime.apiKey, baseURL: runtime.baseURL });
}

export function aiChatRequestOptions(provider: AiProvider) {
  return provider === 'deepseek'
    ? { thinking: { type: 'disabled' as const } }
    : { store: false as const };
}
