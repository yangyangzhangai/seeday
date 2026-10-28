// DOC-DEPS: LLM.md -> docs/AI_USAGE_INVENTORY.md -> api/README.md
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decomposeTodoWithAIDiagnostics } from './todo-decompose-service';

const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalDeepSeekBase = process.env.DEEPSEEK_BASE_URL;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalGeminiBase = process.env.GEMINI_BASE_URL;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe('todo-decompose-service provider routing', () => {
  beforeEach(() => {
    vi.stubEnv('AI_PROVIDER_MODE', 'deepseek');
    vi.stubEnv('DEEPSEEK_FLASH_MODEL', '');
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
    process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1/';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/';
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes('api.deepseek.com')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"steps":[{"title":"打开简报","durationMinutes":10}]}' } }],
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: '{"steps":[{"title":"Open the brief","durationMinutes":10}]}' }] },
          }],
        }),
      } as Response;
    }));
  });

  afterEach(() => {
    restoreEnv('DEEPSEEK_API_KEY', originalDeepSeekKey);
    restoreEnv('DEEPSEEK_BASE_URL', originalDeepSeekBase);
    restoreEnv('GEMINI_API_KEY', originalGeminiKey);
    restoreEnv('GEMINI_BASE_URL', originalGeminiBase);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each(['zh', 'en', 'it'] as const)('uses non-thinking DeepSeek Flash for %s', async (lang) => {
    const result = await decomposeTodoWithAIDiagnostics({ title: '准备项目简报', lang });
    expect(result).toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-flash',
      steps: [{ title: '打开简报', durationMinutes: 10 }],
    });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://api.deepseek.com/v1/chat/completions');
    const payload = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(payload).toMatchObject({ thinking: { type: 'disabled' }, max_tokens: 768, temperature: 0.5 });
  });

  it.each(['en', 'it'] as const)('keeps Gemini for %s', async (lang) => {
    vi.stubEnv('AI_PROVIDER_MODE', 'legacy');
    const result = await decomposeTodoWithAIDiagnostics({
      title: 'Prepare the project brief',
      lang,
    });
    expect(result).toMatchObject({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      steps: [{ title: 'Open the brief', durationMinutes: 10 }],
    });
    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain('/models/gemini-2.5-flash:generateContent');
    expect(url).toContain('key=test-gemini-key');
  });
});
