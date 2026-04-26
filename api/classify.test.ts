import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireSupabaseRequestAuthMock, decomposeTodoWithAIDiagnosticsMock } = vi.hoisted(() => ({
  requireSupabaseRequestAuthMock: vi.fn(),
  decomposeTodoWithAIDiagnosticsMock: vi.fn(),
}));

vi.mock('../src/server/supabase-request-auth.js', () => ({
  requireSupabaseRequestAuth: requireSupabaseRequestAuthMock,
}));

vi.mock('../src/server/todo-decompose-service.js', () => ({
  decomposeTodoWithAIDiagnostics: decomposeTodoWithAIDiagnosticsMock,
}));

import classifyHandler from './classify';

function createMockResponse() {
  const headers: Record<string, string> = {};
  const response = {
    statusCode: 200,
    payload: undefined as unknown,
    ended: false,
    setHeader: (key: string, value: string) => {
      headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.payload = body;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
  return { response, headers };
}

describe('api/classify membership guard', () => {
  beforeEach(() => {
    requireSupabaseRequestAuthMock.mockReset();
    decomposeTodoWithAIDiagnosticsMock.mockReset();
  });

  it('returns 403 membership_required for non-plus user', async () => {
    requireSupabaseRequestAuthMock.mockResolvedValue({
      user: {
        user_metadata: { membership_plan: 'free' },
        app_metadata: { membership_plan: 'free' },
      },
    });

    const req = {
      method: 'POST',
      body: {
        rawInput: '去散步',
        lang: 'zh',
      },
    };
    const { response } = createMockResponse();

    await classifyHandler(req as any, response as any);

    expect(response.statusCode).toBe(403);
    expect(response.payload).toEqual({ error: 'membership_required' });
  });

  it('allows plus user request to continue', async () => {
    requireSupabaseRequestAuthMock.mockResolvedValue({
      user: {
        user_metadata: { membership_plan: 'plus' },
        app_metadata: { membership_plan: 'plus' },
      },
    });
    decomposeTodoWithAIDiagnosticsMock.mockResolvedValue({
      steps: ['拆分步骤1'],
      parseStatus: 'ok',
      model: 'test-model',
      provider: 'test-provider',
    });

    const req = {
      method: 'POST',
      body: {
        module: 'todo_decompose',
        title: '写周报',
        lang: 'zh',
      },
    };
    const { response } = createMockResponse();

    await classifyHandler(req as any, response as any);

    expect(response.statusCode).toBe(200);
    expect(response.payload).toMatchObject({ success: true });
  });
});
