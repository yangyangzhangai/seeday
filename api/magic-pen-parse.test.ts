import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './magic-pen-parse';

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
  const originalApiKey = process.env.ZHIPU_API_KEY;

  beforeEach(() => {
    process.env.ZHIPU_API_KEY = 'test-key';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.ZHIPU_API_KEY = originalApiKey;
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
                '```json\n{"segments":[{"text":"写作业","sourceText":"下午写作业","kind":"activity_backfill","confidence":"high","startTime":"15:00","endTime":"17:00","timeSource":"exact"}],"unparsed":["??"]}\n```',
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
            startTime: '15:00',
            endTime: '17:00',
            timeSource: 'exact',
          },
        ],
        unparsed: ['??'],
      },
    });
  });

  it('falls back to safe empty result when model output is invalid', async () => {
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
        unparsed: ['（AI 解析失败，请手动录入）'],
      },
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
    expect(payload.messages[0].content).toContain('You are a text parser for a time-tracking assistant.');
  });
});
