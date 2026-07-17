import { describe, expect, it, vi } from 'vitest';

const { fromMock, updateMock, updateInMock, rows } = vi.hoisted(() => {
  const sessionRows = [
    {
      id: 'session-1',
      user_id: 'user-1',
      type: 'work',
      started_at: '2026-07-17T08:00:00.000Z',
      ended_at: null,
      source: 'reminder_confirm',
      date: '2026-07-17',
    },
    {
      id: 'session-2',
      user_id: 'user-1',
      type: 'work',
      started_at: '2026-07-17T08:01:00.000Z',
      ended_at: null,
      source: 'reminder_confirm',
      date: '2026-07-17',
    },
  ];
  return {
    rows: sessionRows,
    fromMock: vi.fn(),
    updateMock: vi.fn(),
    updateInMock: vi.fn(),
  };
});

vi.mock('../../api/supabase', () => ({
  supabase: {
    from: fromMock.mockImplementation(() => ({
      select: () => ({
        eq: vi.fn().mockReturnThis(),
        order: vi.fn(async () => ({ data: rows, error: null })),
      }),
      update: updateMock.mockImplementation(() => ({
        eq: vi.fn().mockReturnThis(),
        in: updateInMock.mockReturnValue({
          is: vi.fn(async () => ({ error: null })),
        }),
      })),
    })),
  },
}));

import { fetchReconciledTodaySessions } from './timingSessionService';

describe('fetchReconciledTodaySessions', () => {
  it('closes stale active sessions and keeps the newest one active', async () => {
    const result = await fetchReconciledTodaySessions('user-1');

    expect(result.active?.id).toBe('session-2');
    expect(result.sessions[0].endedAt).toBe(result.sessions[1].startedAt);
    expect(result.sessions[1].endedAt).toBeUndefined();
    expect(updateMock).toHaveBeenCalledWith({
      ended_at: '2026-07-17T08:01:00.000Z',
    });
    expect(updateInMock).toHaveBeenCalledWith('id', ['session-1']);
  });
});
