// DOC-DEPS: LLM.md -> docs/AI_USAGE_INVENTORY.md -> src/server/ai-routing.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAiRoute, resolveAiChatRuntime, type AiFeature } from './ai-routing';
import { resolveAnnotationRuntime } from './annotation-provider-runtime';

const features: AiFeature[] = ['annotation', 'classify', 'magic_pen', 'todo_decompose',
  'diary', 'insight', 'profile', 'plant'];

beforeEach(() => {
  vi.stubEnv('AI_PROVIDER_MODE', '');
  vi.stubEnv('DEEPSEEK_FLASH_MODEL', '');
  vi.stubEnv('DEEPSEEK_PRO_MODEL', '');
  vi.stubEnv('DEEPSEEK_API_KEY', 'test-deepseek-key');
  vi.stubEnv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1/');
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
  vi.stubEnv('OPENAI_BASE_URL', 'https://api.openai.com/v1/');
});
afterEach(() => vi.unstubAllEnvs());

describe('central AI configuration', () => {
  it.each(features)('defaults %s to DeepSeek in every language', (feature) => {
    for (const lang of ['zh', 'en', 'it']) {
      expect(resolveAiRoute(feature, lang)).toEqual({ provider: 'deepseek',
        model: feature === 'diary' ? 'deepseek-v4-pro' : 'deepseek-flash' });
    }
  });

  it('ignores old provider model variables until legacy is explicitly selected', () => {
    vi.stubEnv('PROFILE_EXTRACT_MODEL', 'gpt-4o-mini');
    vi.stubEnv('TODO_DECOMPOSE_MODEL', 'gemini-2.5-flash');
    vi.stubEnv('MAGIC_PEN_MODEL', 'deepseek-chat');
    vi.stubEnv('CLASSIFY_MODEL', 'deepseek-chat');
    vi.stubEnv('AI_PROVIDER_MODE', 'typo');
    for (const feature of ['profile', 'todo_decompose', 'magic_pen', 'classify'] as const) {
      expect(resolveAiRoute(feature, 'en').model).toBe('deepseek-flash');
    }
  });

  it('switches model aliases without accidentally switching provider', () => {
    vi.stubEnv('DEEPSEEK_FLASH_MODEL', 'custom-flash-alias');
    vi.stubEnv('DEEPSEEK_PRO_MODEL', 'custom-pro-alias');
    expect(resolveAiRoute('diary').model).toBe('custom-pro-alias');
    expect(resolveAnnotationRuntime(resolveAiRoute('annotation', 'en').model, 'en'))
      .toMatchObject({ provider: 'deepseek', apiKey: 'test-deepseek-key' });
  });

  it('does not require an OpenAI key in default mode', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(resolveAiChatRuntime('diary')).toMatchObject({ provider: 'deepseek',
      apiKey: 'test-deepseek-key', baseURL: 'https://api.deepseek.com/v1' });
  });

  it('restores OpenAI and Gemini through one environment variable', () => {
    vi.stubEnv('AI_PROVIDER_MODE', 'legacy');
    vi.stubEnv('TODO_DECOMPOSE_MODEL', '');
    vi.stubEnv('PROFILE_EXTRACT_MODEL', '');
    for (const lang of ['en', 'it']) {
      expect(resolveAiRoute('annotation', lang)).toEqual({ provider: 'openai', model: 'gpt-4.1-mini' });
      expect(resolveAiRoute('todo_decompose', lang)).toEqual({ provider: 'gemini', model: 'gemini-2.5-flash' });
    }
    expect(resolveAiRoute('annotation', 'zh').provider).toBe('deepseek');
    expect(resolveAiRoute('diary')).toEqual({ provider: 'openai', model: 'gpt-4o' });
    expect(resolveAiRoute('insight').model).toBe('gpt-4o-mini');
    expect(resolveAiRoute('profile').model).toBe('gpt-4o-mini');
    expect(resolveAiRoute('plant').model).toBe('gpt-4.1-mini');
    expect(resolveAiChatRuntime('diary')).toMatchObject({ apiKey: 'test-openai-key',
      baseURL: 'https://api.openai.com/v1' });
  });
});
