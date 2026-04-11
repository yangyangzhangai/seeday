import { beforeEach, describe, expect, it, vi } from 'vitest';

const responsesCreateMock = vi.fn();
const chatCompletionsCreateMock = vi.fn();

vi.mock('openai', () => ({
  default: class OpenAI {
    apiKey?: string;

    responses = {
      create: responsesCreateMock,
    };

    chat = {
      completions: {
        create: chatCompletionsCreateMock,
      },
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
    chatCompletionsCreateMock.mockReset();
    responsesCreateMock.mockResolvedValue({
      id: 'resp_test',
      output_text: 'You actually did the thing today, and it counts',
      usage: {
        prompt_cache_hits: 0,
        prompt_cache_misses: 1,
      },
    });
    chatCompletionsCreateMock.mockResolvedValue({
      choices: [{ message: { content: '{"steps":[]}' } }],
    });
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.QWEN_API_KEY = 'test-qwen-key';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.ANNOTATION_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
    process.env.ANNOTATION_CHARACTER_STATE_ENABLED = 'true';
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
    expect(request.instructions).toContain('You are Zep, a pelican living in the Plantime time greenhouse.');
    expect(request.input).not.toContain('Current holiday:');
    expect(request.input).toContain('Season: unknown');
    expect(request.input).toContain('Weather: unknown, unknown');
    expect(request.input).toContain('Character current state:');
    expect(request).not.toHaveProperty('previous_response_id');
    expect(res.statusCode).toBe(200);
    expect((res.payload as { debugAiMode?: string }).debugAiMode).toBe('zep');
    expect((res.payload as { source?: string }).source).toBe('ai');
  });

  it('rewrites when generated annotation is too similar to recent ones', async () => {
    responsesCreateMock
      .mockResolvedValueOnce({
        id: 'resp_initial',
        output_text: 'You actually did the thing today, and it counts ✨',
        usage: {
          prompt_cache_hits: 0,
          prompt_cache_misses: 1,
        },
      })
      .mockResolvedValueOnce({
        id: 'resp_rewrite',
        output_text: 'You turned this page into a tiny trip, and your mind got fresh air 🌊',
        usage: {
          prompt_cache_hits: 0,
          prompt_cache_misses: 1,
        },
      });

    const { default: handler } = await import('./annotation-handler');
    const res = createResponseMock();

    await handler({
      method: 'POST',
      body: {
        eventType: 'activity_recorded',
        eventData: { content: 'Read a novel for a while' },
        userContext: {
          todayActivities: 2,
          todayDuration: 80,
          currentHour: 20,
          recentAnnotations: ['You actually did the thing today, and it counts ✨'],
          recentMoodMessages: [],
          todayActivitiesList: [{ content: 'Read a novel', completed: false }],
        },
        lang: 'en',
        aiMode: 'zep',
      },
    } as any, res as any);

    expect(responsesCreateMock).toHaveBeenCalledTimes(2);

    const rewriteRequest = responsesCreateMock.mock.calls[1][0];
    expect(rewriteRequest.input).toContain('Draft to avoid:');
    expect(rewriteRequest.input).toContain('Recent annotations:');

    expect(res.statusCode).toBe(200);
    expect((res.payload as { content?: string }).content).toContain('tiny trip');
    expect((res.payload as { source?: string }).source).toBe('ai');
  });

  it('parses v2 suggestion JSON when allowSuggestion is true', async () => {
    responsesCreateMock.mockResolvedValueOnce({
      id: 'resp_suggestion_v2',
      output_text: '{"mode":"suggestion","content":"Take a short walk to reset your focus 🌿","suggestion":{"type":"activity","actionLabel":"Go walk","activityName":"walk"}}',
      usage: {
        prompt_cache_hits: 0,
        prompt_cache_misses: 1,
      },
    });

    const { default: handler } = await import('./annotation-handler');
    const res = createResponseMock();

    await handler({
      method: 'POST',
      body: {
        eventType: 'idle_detected',
        eventData: { content: 'No activity for 2 hours' },
        userContext: {
          todayActivitiesList: [],
          pendingTodos: [],
          recentMoodMessages: [],
          allowSuggestion: true,
        },
        lang: 'en',
        aiMode: 'zep',
      },
    } as any, res as any);

    expect(res.statusCode).toBe(200);
    expect((res.payload as { suggestion?: { type: string } }).suggestion?.type).toBe('activity');
    expect((res.payload as { displayDuration?: number }).displayDuration).toBe(15000);
  });

  it('parses legacy suggestion JSON message format', async () => {
    responsesCreateMock.mockResolvedValueOnce({
      id: 'resp_suggestion_legacy',
      output_text: '{"message":"This todo is almost due, do it now ✅","type":"todo","todoId":"todo-123","todoTitle":"run 20 minutes","actionLabel":"Go run"}',
      usage: {
        prompt_cache_hits: 0,
        prompt_cache_misses: 1,
      },
    });

    const { default: handler } = await import('./annotation-handler');
    const res = createResponseMock();

    await handler({
      method: 'POST',
      body: {
        eventType: 'activity_recorded',
        eventData: { content: 'scrolling social media' },
        userContext: {
          todayActivitiesList: [],
          pendingTodos: [{ id: 'todo-123', title: 'run 20 minutes' }],
          recentMoodMessages: [],
          allowSuggestion: true,
        },
        lang: 'en',
        aiMode: 'zep',
      },
    } as any, res as any);

    expect(res.statusCode).toBe(200);
    expect((res.payload as { suggestion?: { type: string; todoId?: string } }).suggestion?.type).toBe('todo');
    expect((res.payload as { suggestion?: { todoId?: string } }).suggestion?.todoId).toBe('todo-123');
  });

  it('forces suggestion output when forceSuggestion is true', async () => {
    responsesCreateMock.mockResolvedValueOnce({
      id: 'resp_suggestion_forced',
      output_text: 'Take a tiny break and restart 🌿',
      usage: {
        prompt_cache_hits: 0,
        prompt_cache_misses: 1,
      },
    });

    const { default: handler } = await import('./annotation-handler');
    const res = createResponseMock();

    await handler({
      method: 'POST',
      body: {
        eventType: 'activity_recorded',
        eventData: { content: 'working nonstop' },
        userContext: {
          todayActivitiesList: [],
          pendingTodos: [{ id: 'todo-xyz', title: 'drink water' }],
          allowSuggestion: false,
          forceSuggestion: true,
        },
        lang: 'en',
        aiMode: 'van',
      },
    } as any, res as any);

    expect(res.statusCode).toBe(200);
    expect((res.payload as { suggestion?: { type?: string } }).suggestion?.type).toBeTruthy();
    expect((res.payload as { displayDuration?: number }).displayDuration).toBe(15000);
  });

  it('pre-decomposes stale todo before returning suggestion', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('generativelanguage.googleapis.com')) {
        return {
          ok: true,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{ text: '{"steps":[{"title":"Collect requirements","durationMinutes":20},{"title":"Draft outline","durationMinutes":30},{"title":"Review and finalize","durationMinutes":25}]}' }],
              },
            }],
          }),
        } as Response;
      }
      return {
        ok: false,
        status: 503,
        text: async () => 'mocked non-gemini fetch',
      } as Response;
    });
    responsesCreateMock.mockResolvedValueOnce({
      id: 'resp_suggestion_stale',
      output_text: '{"mode":"suggestion","content":"Try this todo now 🌿","suggestion":{"type":"todo","actionLabel":"Go now","todoId":"todo-stale","todoTitle":"Prepare project brief"}}',
      usage: {
        prompt_cache_hits: 0,
        prompt_cache_misses: 1,
      },
    });
    chatCompletionsCreateMock.mockResolvedValueOnce({
      choices: [{ message: { content: '{"steps":[{"title":"Collect requirements","durationMinutes":20},{"title":"Draft outline","durationMinutes":30},{"title":"Review and finalize","durationMinutes":25}]}' } }],
    });

    const { default: handler } = await import('./annotation-handler');
    const res = createResponseMock();

    await handler({
      method: 'POST',
      body: {
        eventType: 'activity_recorded',
        eventData: { content: 'still procrastinating' },
        userContext: {
          todayActivitiesList: [],
          pendingTodos: [{
            id: 'todo-stale',
            title: 'Prepare project brief',
            ageDays: 5,
          }],
          recentMoodMessages: [],
          allowSuggestion: true,
        },
        lang: 'en',
      },
    } as any, res as any);

    const suggestion = (res.payload as { suggestion?: Record<string, unknown> }).suggestion;
    expect(fetchSpy).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(suggestion?.decomposeReady).toBe(true);
    expect(suggestion?.decomposeSourceTodoId).toBe('todo-stale');
    expect((suggestion?.decomposeSteps as Array<{ title: string }>)[0]?.title).toBe('Collect requirements');
    expect((suggestion?.actionLabel as string)).toBe('Start step 1');
    fetchSpy.mockRestore();
  });

  it('pre-decomposes stale todo when ageDays is missing but createdAt is old string', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('generativelanguage.googleapis.com')) {
        return {
          ok: true,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{ text: '{"steps":[{"title":"Collect requirements","durationMinutes":20},{"title":"Draft outline","durationMinutes":30},{"title":"Review and finalize","durationMinutes":25}]}' }],
              },
            }],
          }),
        } as Response;
      }
      return {
        ok: false,
        status: 503,
        text: async () => 'mocked non-gemini fetch',
      } as Response;
    });
    responsesCreateMock.mockResolvedValueOnce({
      id: 'resp_suggestion_stale_created_at',
      output_text: '{"mode":"suggestion","content":"Try this todo now 🌿","suggestion":{"type":"todo","actionLabel":"Go now","todoId":"todo-old-string","todoTitle":"Prepare project brief"}}',
      usage: {
        prompt_cache_hits: 0,
        prompt_cache_misses: 1,
      },
    });
    chatCompletionsCreateMock.mockResolvedValueOnce({
      choices: [{ message: { content: '{"steps":[{"title":"Collect requirements","durationMinutes":20},{"title":"Draft outline","durationMinutes":30},{"title":"Review and finalize","durationMinutes":25}]}' } }],
    });

    const { default: handler } = await import('./annotation-handler');
    const res = createResponseMock();
    const oldCreatedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    await handler({
      method: 'POST',
      body: {
        eventType: 'activity_recorded',
        eventData: { content: 'still procrastinating' },
        userContext: {
          todayActivitiesList: [],
          pendingTodos: [{
            id: 'todo-old-string',
            title: 'Prepare project brief',
            createdAt: oldCreatedAt,
          }],
          recentMoodMessages: [],
          allowSuggestion: true,
        },
        lang: 'en',
      },
    } as any, res as any);

    const suggestion = (res.payload as { suggestion?: Record<string, unknown> }).suggestion;
    expect(fetchSpy).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(suggestion?.decomposeReady).toBe(true);
    expect(suggestion?.decomposeSourceTodoId).toBe('todo-old-string');
    fetchSpy.mockRestore();
  });

  it('injects two-star reward fields for recovery nudge suggestions', async () => {
    responsesCreateMock.mockResolvedValueOnce({
      id: 'resp_recovery',
      output_text: '{"mode":"suggestion","content":"Let\'s restart gently today ⭐","suggestion":{"type":"todo","actionLabel":"Start now","todoId":"todo-1","todoTitle":"Run 20 minutes"}}',
      usage: {
        prompt_cache_hits: 0,
        prompt_cache_misses: 1,
      },
    });

    const { default: handler } = await import('./annotation-handler');
    const res = createResponseMock();

    await handler({
      method: 'POST',
      body: {
        eventType: 'activity_recorded',
        eventData: { content: 'opened app again' },
        userContext: {
          todayActivitiesList: [],
          pendingTodos: [{ id: 'todo-1', title: 'Run 20 minutes' }],
          allowSuggestion: true,
          forceSuggestion: true,
          recoveryNudge: {
            key: 'recurring:tpl-1:miss1d',
            reason: 'bottle_missed_3_days',
            rewardStars: 2,
            todoId: 'todo-1',
            todoTitle: 'Run 20 minutes',
            bottleId: 'bottle-1',
          },
        },
        lang: 'en',
        aiMode: 'van',
      },
    } as any, res as any);

    const suggestion = (res.payload as { suggestion?: Record<string, unknown> }).suggestion;
    expect(res.statusCode).toBe(200);
    expect(suggestion?.rewardStars).toBe(2);
    expect(suggestion?.rewardBottleId).toBe('bottle-1');
    expect(suggestion?.recoveryKey).toBe('recurring:tpl-1:miss1d');
  });

  it('disables character state injection when server switch is off', async () => {
    process.env.ANNOTATION_CHARACTER_STATE_ENABLED = 'false';
    responsesCreateMock.mockResolvedValueOnce({
      id: 'resp_switch_off',
      output_text: 'Short note 🌿',
      usage: { prompt_cache_hits: 0, prompt_cache_misses: 1 },
    });

    const { default: handler } = await import('./annotation-handler');
    const res = createResponseMock();

    await handler({
      method: 'POST',
      body: {
        eventType: 'activity_recorded',
        eventData: { content: 'test event' },
        userContext: {
          todayActivitiesList: [],
          recentMoodMessages: [],
          characterStateText: 'THIS_SHOULD_NOT_APPEAR',
        },
        lang: 'en',
      },
    } as any, res as any);

    const request = responsesCreateMock.mock.calls[0][0];
    expect(request.input).toContain('Character current state:\nnone');
    expect(request.input).not.toContain('THIS_SHOULD_NOT_APPEAR');
    expect(res.statusCode).toBe(200);
  });
});
