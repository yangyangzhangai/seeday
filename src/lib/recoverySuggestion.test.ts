import { describe, expect, it } from 'vitest';
import { detectRecoveryNudge } from './recoverySuggestion';

const DAY_MS = 24 * 60 * 60 * 1000;

function atLocalDay(dayOffset: number, hour = 9): Date {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return new Date(base.getTime() + dayOffset * DAY_MS + hour * 60 * 60 * 1000);
}

describe('detectRecoveryNudge', () => {
  it('returns bottle recovery nudge after 3 missed days', () => {
    const now = atLocalDay(0, 10);
    const bottle = { id: 'bottle-1', name: 'Run', status: 'active' as const, createdAt: atLocalDay(-10).getTime() };
    const todos = [
      { id: 'todo-1', title: 'Run 20min', completed: false, createdAt: atLocalDay(0).getTime(), bottleId: 'bottle-1', isTemplate: false },
    ];

    const result = detectRecoveryNudge({ now, todos, bottles: [bottle] });
    expect(result?.reason).toBe('bottle_missed_3_days');
    expect(result?.todoId).toBe('todo-1');
    expect(result?.rewardStars).toBe(2);
  });

  it('does not return nudge for recurring-only todos without bottle link', () => {
    const now = atLocalDay(0, 10);
    const templateId = 'tpl-1';
    const todos = [
      {
        id: templateId,
        title: 'Drink water',
        completed: false,
        createdAt: atLocalDay(-7).getTime(),
        isTemplate: true,
        recurrence: 'daily' as const,
      },
      {
        id: 'todo-today',
        title: 'Drink water',
        completed: false,
        createdAt: atLocalDay(0).getTime(),
        isTemplate: false,
        templateId,
      },
    ];

    const result = detectRecoveryNudge({ now, todos, bottles: [] });
    expect(result).toBeNull();
  });

  it('skips nudge when reminders already reached daily max', () => {
    const now = atLocalDay(0, 10);
    const bottle = { id: 'bottle-1', name: 'Run', status: 'active' as const, createdAt: atLocalDay(-10).getTime() };
    const todos = [
      { id: 'todo-1', title: 'Run 20min', completed: false, createdAt: atLocalDay(0).getTime(), bottleId: 'bottle-1', isTemplate: false },
    ];

    const result = detectRecoveryNudge({
      now,
      todos,
      bottles: [bottle],
      attemptsToday: [
        { key: 'bottle:bottle-1:miss3d', timestamp: now.getTime() - 6 * 60 * 60 * 1000 },
        { key: 'bottle:bottle-1:miss3d', timestamp: now.getTime() - 5 * 60 * 60 * 1000 },
      ],
    });

    expect(result).toBeNull();
  });
});
