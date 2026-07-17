import { describe, expect, it } from 'vitest';
import type { Message } from './useChatStore.types';
import {
  finalizeCrossDayOngoingMessages,
  reconcileConcurrentOngoingMessages,
  resolveAutoActivityDurationMinutes,
} from './chatDayBoundary';

describe('chatDayBoundary', () => {
  it('uses real elapsed minutes when activity stays within the same day', () => {
    const start = new Date(2026, 3, 3, 21, 10, 0, 0).getTime();
    const now = new Date(2026, 3, 3, 21, 55, 0, 0).getTime();
    expect(resolveAutoActivityDurationMinutes(start, now)).toBe(45);
  });

  it('caps ongoing activity at local midnight after day rollover', () => {
    const start = new Date(2026, 3, 2, 23, 50, 0, 0).getTime();
    const now = new Date(2026, 3, 3, 0, 10, 0, 0).getTime();
    expect(resolveAutoActivityDurationMinutes(start, now)).toBe(10);
  });

  it('finalizes only cross-day ongoing event messages', () => {
    const now = new Date(2026, 3, 3, 8, 30, 0, 0).getTime();
    const yesterdayStart = new Date(2026, 3, 2, 23, 40, 0, 0).getTime();
    const todayStart = new Date(2026, 3, 3, 8, 0, 0, 0).getTime();

    const messages: Message[] = [
      {
        id: 'event-yesterday-ongoing',
        content: '昨晚还在做',
        timestamp: yesterdayStart,
        type: 'text',
        mode: 'record',
        isMood: false,
        isActive: true,
      },
      {
        id: 'event-today-ongoing',
        content: '今天进行中',
        timestamp: todayStart,
        type: 'text',
        mode: 'record',
        isMood: false,
        isActive: true,
      },
      {
        id: 'event-yesterday-ended',
        content: '昨天已结束',
        timestamp: yesterdayStart,
        type: 'text',
        mode: 'record',
        isMood: false,
        duration: 5,
      },
    ];

    const result = finalizeCrossDayOngoingMessages(messages, now);
    expect(result.finalized).toEqual([{ id: 'event-yesterday-ongoing', duration: 20 }]);
    expect(result.messages.find((m) => m.id === 'event-yesterday-ongoing')?.duration).toBe(20);
    expect(result.messages.find((m) => m.id === 'event-yesterday-ongoing')?.isActive).toBe(false);
    expect(result.messages.find((m) => m.id === 'event-today-ongoing')?.duration).toBeUndefined();
    expect(result.messages.find((m) => m.id === 'event-yesterday-ended')?.duration).toBe(5);
  });

  it('keeps only the newest card active after duplicated reminder callbacks', () => {
    const base = new Date(2026, 3, 3, 8, 0, 0, 0).getTime();
    const messages: Message[] = [0, 2, 4].map((offsetMinutes, index) => ({
      id: `active-${index + 1}`,
      content: `Activity ${index + 1}`,
      timestamp: base + offsetMinutes * 60_000,
      type: 'text',
      mode: 'record',
      isMood: false,
      isActive: true,
    }));

    const result = reconcileConcurrentOngoingMessages(messages);

    expect(result.finalized).toEqual([
      { id: 'active-1', duration: 4 },
      { id: 'active-2', duration: 2 },
    ]);
    const activeMessages = result.messages.filter((message) => message.isActive);
    expect(activeMessages).toHaveLength(1);
    expect(activeMessages[0].id).toBe('active-3');
    expect(activeMessages[0].duration).toBeUndefined();
  });
});
