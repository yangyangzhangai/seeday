import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/magic-pen-parse.js';

vi.mock('../../src/server/ai-consent.js', () => ({
  requireSupabaseAiConsent: vi.fn().mockResolvedValue({ user: { id: 'test-user' } }),
}));

type MockResponse = {
  statusCode: number;
  headers: Record<string, string>;
  payload: unknown;
  ended: boolean;
  setHeader: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
};

function createMockResponse(): MockResponse {
  const response: MockResponse = {
    statusCode: 200,
    headers: {},
    payload: undefined,
    ended: false,
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
    end: vi.fn(),
  };

  response.setHeader.mockImplementation((key: string, value: string) => {
    response.headers[key] = value;
  });

  response.status.mockImplementation((code: number) => {
    response.statusCode = code;
    return response;
  });

  response.json.mockImplementation((payload: unknown) => {
    response.payload = payload;
    return response;
  });

  response.end.mockImplementation(() => {
    response.ended = true;
    return response;
  });

  return response;
}

describe('api/magic-pen-parse handler', () => {
  const originalApiKey = process.env.DEEPSEEK_API_KEY;
  const originalMagicPenApiKey = process.env.MAGIC_PEN_DEEPSEEK_API_KEY;
  const originalDeepSeekBaseUrl = process.env.DEEPSEEK_BASE_URL;
  const originalMagicPenBaseUrl = process.env.MAGIC_PEN_DEEPSEEK_BASE_URL;
  const originalMagicPenModel = process.env.MAGIC_PEN_MODEL;
  const originalTimeout = process.env.MAGIC_PEN_TIMEOUT_MS;

  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    delete process.env.MAGIC_PEN_DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.MAGIC_PEN_DEEPSEEK_BASE_URL;
    delete process.env.MAGIC_PEN_MODEL;
    delete process.env.MAGIC_PEN_TIMEOUT_MS;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.DEEPSEEK_API_KEY = originalApiKey;
    process.env.MAGIC_PEN_DEEPSEEK_API_KEY = originalMagicPenApiKey;
    process.env.DEEPSEEK_BASE_URL = originalDeepSeekBaseUrl;
    process.env.MAGIC_PEN_DEEPSEEK_BASE_URL = originalMagicPenBaseUrl;
    process.env.MAGIC_PEN_MODEL = originalMagicPenModel;
    process.env.MAGIC_PEN_TIMEOUT_MS = originalTimeout;
    vi.unstubAllGlobals();
  });

  it('returns 400 when rawText is missing', async () => {
    const req = {
      method: 'POST',
      body: { todayDateStr: '2026-03-12', currentHour: 15 },
    };
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({ error: 'Missing or invalid rawText' });
  });

  it('extracts json object from wrapped model output', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '```json\n{"segments":[{"text":"写作业","sourceText":"下午写作业","kind":"activity_backfill","confidence":"high","timeRelation":"past","startTime":"15:00","endTime":"17:00","timeSource":"exact"}],"unparsed":["??"]}\n```',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = {
      method: 'POST',
      body: { rawText: '下午写作业', todayDateStr: '2026-03-12', currentHour: 15 },
    };
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        segments: [
          {
            text: '写作业',
            sourceText: '下午写作业',
            kind: 'activity_backfill',
            confidence: 'high',
            timeRelation: 'past',
            startTime: '15:00',
            endTime: '17:00',
            timeSource: 'exact',
          },
        ],
        unparsed: ['??'],
      },
    });
  });

  it('filters invalid timeRelation value', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"segments":[{"text":"我很开心","sourceText":"我很开心","kind":"mood","confidence":"high","timeRelation":"later"}],"unparsed":[]}',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = {
      method: 'POST',
      body: { rawText: '我很开心', todayDateStr: '2026-03-12', currentHour: 15 },
    };
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        segments: [
          {
            text: '我很开心',
            sourceText: '我很开心',
            kind: 'mood',
            confidence: 'high',
          },
        ],
      },
    });
    const segment = (res.payload as any).data.segments[0];
    expect(segment.timeRelation).toBeUndefined();
  });

  it('keeps durationMinutes when model returns it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"segments":[{"text":"开会","sourceText":"上午开会半小时","kind":"activity_backfill","confidence":"high","timeRelation":"past","timeSource":"period","periodLabel":"上午","durationMinutes":30}],"unparsed":[]}',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = {
      method: 'POST',
      body: { rawText: '上午开会半小时', todayDateStr: '2026-03-12', currentHour: 10 },
    };
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    const segment = (res.payload as any).data.segments[0];
    expect(segment.durationMinutes).toBe(30);
  });

  it('keeps inferred timeSource when model returns it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"segments":[{"text":"开会","sourceText":"刚开完会","kind":"activity_backfill","confidence":"high","timeRelation":"past","timeSource":"inferred"}],"unparsed":[]}',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = {
      method: 'POST',
      body: { rawText: '刚开完会', todayDateStr: '2026-03-12', currentHour: 10 },
    };
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    const segment = (res.payload as any).data.segments[0];
    expect(segment.timeSource).toBe('inferred');
  });

  it('normalizes 1-digit hour clock returned by model', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"segments":[{"text":"吃早饭","sourceText":"8-9点吃早饭","kind":"activity_backfill","confidence":"high","timeRelation":"past","startTime":"8:00","endTime":"9:00","timeSource":"exact"}],"unparsed":[]}',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = {
      method: 'POST',
      body: { rawText: '8-9点吃早饭', todayDateStr: '2026-03-12', currentHour: 10 },
    };
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    const segment = (res.payload as any).data.segments[0];
    expect(segment.startTime).toBe('08:00');
    expect(segment.endTime).toBe('09:00');
  });

  it('preserves the original input when all model output is invalid', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'not-json-at-all' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = {
      method: 'POST',
      body: { rawText: '今天做了很多事', todayDateStr: '2026-03-12', currentHour: 18 },
    };
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        segments: [],
        unparsed: ['今天做了很多事'],
      },
      parseStrategy: 'fallback_failed',
      providerUsed: 'none',
    });
  });

  it('switches prompt language by lang field', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"segments":[],"unparsed":[]}' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = {
      method: 'POST',
      body: { rawText: 'run later', lang: 'en', todayDateStr: '2026-03-12', currentHour: 10 },
    };
    const res = createMockResponse();

    await handler(req as any, res as any);

    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const payload = JSON.parse(call[1].body as string);
    expect(payload.messages[0].content).toContain('You are Xiaoshi, a time-recording assistant');
  });

  it('injects local datetime context into prompt when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"segments":[],"unparsed":[]}' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = {
      method: 'POST',
      body: {
        rawText: '晚上要开会',
        lang: 'zh',
        todayDateStr: '2026-03-14',
        currentHour: 15,
        currentLocalDateTime: '2026-03-14 15:23',
        timezoneOffsetMinutes: 480,
      },
    };
    const res = createMockResponse();

    await handler(req as any, res as any);

    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const payload = JSON.parse(call[1].body as string);
    expect(payload.messages[0].content).toContain('2026-03-14 15:23');
    expect(payload.messages[0].content).toContain('480');
  });

  it('uses DeepSeek config and surfaces low-quality failure as provider exhaustion', async () => {
    process.env.MAGIC_PEN_DEEPSEEK_API_KEY = 'magic-pen-key';
    process.env.MAGIC_PEN_DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"segments":[],"unparsed":[]}' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = {
      method: 'POST',
      body: {
        rawText: '今晚跑步',
        todayDateStr: '2026-03-12',
        currentHour: 19,
      },
    };
    const res = createMockResponse();

    await handler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      providerUsed: 'none',
      parseStrategy: 'fallback_failed',
      failureCategory: 'model_output_invalid',
      data: { unparsed: ['今晚跑步'] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const deepSeekCall = fetchMock.mock.calls[0];
    expect(String(deepSeekCall[0])).toContain('https://api.deepseek.com/v1/chat/completions');
    const deepSeekPayload = JSON.parse(deepSeekCall[1].body as string);
    expect(deepSeekPayload.model).toBe('deepseek-flash');
    expect(deepSeekPayload.thinking).toEqual({ type: 'disabled' });
    expect(deepSeekPayload).toMatchObject({ temperature: 0.2, max_tokens: 4096 });
    expect(res.payload).toMatchObject({
      attempts: [{ provider: 'deepseek', reason: 'low_quality' }],
    });
  });
});
