import { beforeEach, describe, expect, it, vi } from 'vitest';

const responsesCreateMock = vi.fn();

vi.mock('openai', () => ({
  default: class OpenAI {
    apiKey?: string;

    responses = {
      create: responsesCreateMock,
    };
  },
}));

function createResponseMock() {
  return {
    headers: {} as Record<string, string>,
    statusCode: 200,
    payload: undefined as unknown,
    setHeader: vi.fn(function setHeader(this: any, key: string, value: string) {
      this.headers[key] = value;
    }),
    status: vi.fn(function status(this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function json(this: any, payload: unknown) {
      this.payload = payload;
      return this;
    }),
    end: vi.fn(),
  };
}

describe('annotation-handler', () => {
  beforeEach(() => {
    vi.resetModules();
    responsesCreateMock.mockReset();
    responsesCreateMock.mockResolvedValue({
      id: 'resp_test',
      output_text: 'You actually did the thing today, and it counts',
      usage: {
        prompt_cache_hits: 0,
        prompt_cache_misses: 1,
      },
    });
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('passes the selected ai mode without reusing a previous response id', async () => {
    const { default: handler } = await import('./annotation-handler');
    const res = createResponseMock();

    await handler({
      method: 'POST',
      body: {
        eventType: 'activity_recorded',
        eventData: { content: 'Wrapped up the design review' },
        userContext: {
          todayActivities: 1,
          todayDuration: 45,
          currentHour: 10,
          recentAnnotations: [],
          recentMoodMessages: [],
          todayActivitiesList: [],
        },
        lang: 'en',
        aiMode: 'zep',
      },
    } as any, res as any);

    expect(responsesCreateMock).toHaveBeenCalledTimes(1);

    const request = responsesCreateMock.mock.calls[0][0];
    expect(request.instructions).toContain('Zep - Real-Life Candor');
    expect(request).not.toHaveProperty('previous_response_id');
    expect(res.statusCode).toBe(200);
    expect((res.payload as { debugAiMode?: string }).debugAiMode).toBe('zep');
    expect((res.payload as { source?: string }).source).toBe('ai');
  });
});
