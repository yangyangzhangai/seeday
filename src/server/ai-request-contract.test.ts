// DOC-DEPS: LLM.md -> docs/AI_USAGE_INVENTORY.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import diaryHandler from '../../api/diary';
import profileHandler from '../../api/extract-profile';
import classifyHandler from '../../api/classify';
import { generatePlantDiaryWithFallback } from './plant-diary-service';

vi.mock('./ai-consent.js', () => ({
  requireSupabaseAiConsent: vi.fn().mockResolvedValue({ user: { id: 'test-user' } }),
  requireAiConsentForAuth: vi.fn().mockResolvedValue(true),
}));
vi.mock('./supabase-request-auth.js', () => ({
  requireSupabaseRequestAuth: vi.fn().mockResolvedValue({
    user: { id: 'test-user', app_metadata: { membership_plan: 'plus' } },
  }),
}));

const fetchMock = vi.fn();
function providerReply(content: string, finishReason = 'stop') {
  return new Response(JSON.stringify({
    choices: [{ message: { content }, finish_reason: finishReason }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
function responseMock() {
  return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(), end: vi.fn() };
}
async function invoke(handler: typeof diaryHandler, body: Record<string, unknown>) {
  const res = responseMock();
  await handler({ method: 'POST', body } as VercelRequest, res as unknown as VercelResponse);
  return res;
}
function requestBody(index = 0) {
  return JSON.parse(String(fetchMock.mock.calls[index][1]?.body));
}
function expectDeepSeek(model: string, maxTokens: number, temperature: number) {
  expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.deepseek.com/v1/chat/completions');
  expect(requestBody()).toMatchObject({ model, max_tokens: maxTokens, temperature,
    thinking: { type: 'disabled' } });
  expect(requestBody()).not.toHaveProperty('store');
  const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
  expect(headers.get('authorization')).toBe('Bearer test-deepseek-key');
}

beforeEach(() => {
  vi.stubEnv('AI_PROVIDER_MODE', 'deepseek');
  vi.stubEnv('DEEPSEEK_API_KEY', 'test-deepseek-key');
  vi.stubEnv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1');
  vi.stubEnv('DEEPSEEK_PRO_MODEL', '');
  vi.stubEnv('DEEPSEEK_FLASH_MODEL', '');
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubEnv('PROFILE_EXTRACT_MODEL', '');
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('AI wire requests using the real SDK and mocked transport', () => {
  it.each(['zh', 'en', 'it'])('sends full %s diaries to Pro without an OpenAI key', async (lang) => {
    fetchMock.mockResolvedValueOnce(providerReply(lang === 'zh'
      ? '今天认真读了书，也给自己留下了休息的时间。' : 'A complete day, with room for rest.'));
    const res = await invoke(diaryHandler, { structuredData: 'Reading: 30 minutes', lang });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expectDeepSeek('deepseek-v4-pro', 1600, 1.0);
  });

  it('keeps diary completeness retries on non-thinking Pro', async () => {
    fetchMock.mockResolvedValueOnce(providerReply('Incomplete', 'length'))
      .mockResolvedValueOnce(providerReply('You gave yourself room to breathe.'));
    await invoke(diaryHandler, { structuredData: 'Reading', lang: 'en' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBody(1)).toMatchObject({ model: 'deepseek-v4-pro', thinking: { type: 'disabled' },
      temperature: 1.0, max_tokens: 1600 });
  });

  it('sends short insights to Flash', async () => {
    fetchMock.mockResolvedValueOnce(providerReply('Steady progress today.'));
    const res = await invoke(diaryHandler, { action: 'insight', kind: 'activity', summary: 'Reading', lang: 'en' });
    expect(res.json).toHaveBeenCalledWith({ insight: 'Steady progress today.' });
    expectDeepSeek('deepseek-flash', 128, 0.6);
  });

  it('sends structured profile extraction to Flash', async () => {
    fetchMock.mockResolvedValueOnce(providerReply('{}'));
    const res = await invoke(profileHandler, { recentMessages: [{ content: 'Read for thirty minutes' }], lang: 'en' });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expectDeepSeek('deepseek-flash', 4096, 0.2);
    expect(requestBody().response_format).toEqual({ type: 'json_object' });
  });

  it('sends membership classification to Flash', async () => {
    fetchMock.mockResolvedValueOnce(providerReply('{"kind":"activity","activity_type":"study","mood_type":null,"confidence":0.9}'));
    const res = await invoke(classifyHandler, { rawInput: 'Read for thirty minutes', lang: 'en' });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expectDeepSeek('deepseek-flash', 384, 0.2);
  });

  it('sends the short plant observation to Flash', async () => {
    fetchMock.mockResolvedValueOnce(providerReply('{"plantId":"tap_early_0001","text":"Your poppy opens soft petals as you make room for a quiet moment today."}'));
    const result = await generatePlantDiaryWithFallback({ date: '2026-10-21', activities: [],
      totalDuration: 30, rootType: 'tap', plantStage: 'early', isSpecial: false, lang: 'en',
      availablePlants: [{ id: 'tap_early_0001', nameCN: '虞美人', nameEN: 'Corn Poppy', nameIT: 'Papavero', stage: 'early' }] });
    expect(result.diaryStatus).toBe('ready');
    expectDeepSeek('deepseek-flash', 256, 1.0);
  });

  it('restores legacy OpenAI requests with store:false and no DeepSeek parameter', async () => {
    vi.stubEnv('AI_PROVIDER_MODE', 'legacy');
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    vi.stubEnv('OPENAI_BASE_URL', 'https://api.openai.com/v1');
    fetchMock.mockResolvedValueOnce(providerReply('You found a moment of calm.'));
    await invoke(diaryHandler, { structuredData: 'Reading', lang: 'en' });
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.openai.com/v1/chat/completions');
    expect(requestBody()).toMatchObject({ model: 'gpt-4o', store: false, max_tokens: 900 });
    expect(requestBody()).not.toHaveProperty('thinking');
  });

  it('does not send diary teaser data to any provider', async () => {
    await invoke(diaryHandler, { mode: 'teaser', structuredData: 'Reading', lang: 'en' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
