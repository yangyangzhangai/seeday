import { describe, expect, it } from 'vitest';
import { getLiveInputContext } from './liveInputContext';
import type { LiveInputContextMessage } from './types';

const NOW = 1_000_000;

function recordMessage(partial: Partial<LiveInputContextMessage>): LiveInputContextMessage {
  return {
    id: partial.id ?? 'm1',
    content: partial.content ?? '开会',
    timestamp: partial.timestamp ?? NOW,
    mode: partial.mode ?? 'record',
    isMood: partial.isMood ?? false,
    duration: partial.duration,
  };
}

describe('getLiveInputContext', () => {
  it('returns latest ongoing record activity as context', () => {
    const messages: LiveInputContextMessage[] = [
      recordMessage({ id: 'old', content: '吃饭', timestamp: NOW - 60 * 60 * 1000, duration: 10 }),
      recordMessage({ id: 'ongoing', content: '写周报', timestamp: NOW - 2 * 60 * 60 * 1000, duration: undefined }),
    ];

    const context = getLiveInputContext(messages, NOW);

    expect(context.recentActivity?.id).toBe('ongoing');
    expect(context.recentActivity?.isOngoing).toBe(true);
  });

  it('returns latest ended activity within 30 minutes', () => {
    const messages: LiveInputContextMessage[] = [
      recordMessage({ id: 'a1', content: '写方案', timestamp: NOW - 20 * 60 * 1000, duration: 15 }),
    ];

    const context = getLiveInputContext(messages, NOW);

    expect(context.recentActivity?.id).toBe('a1');
    expect(context.recentActivity?.isOngoing).toBe(false);
  });

  it('skips ended activity outside 30-minute window', () => {
    const messages: LiveInputContextMessage[] = [
      recordMessage({ id: 'a1', content: '写方案', timestamp: NOW - 31 * 60 * 1000, duration: 20 }),
    ];

    const context = getLiveInputContext(messages, NOW);

    expect(context.recentActivity).toBeUndefined();
  });

  it('ignores chat and mood messages when finding context', () => {
    const messages: LiveInputContextMessage[] = [
      recordMessage({ id: 'chat', mode: 'chat', content: '你好' }),
      recordMessage({ id: 'mood', content: '好累', isMood: true }),
      recordMessage({ id: 'activity', content: '开会', timestamp: NOW - 5 * 60 * 1000, duration: 3 }),
    ];

    const context = getLiveInputContext(messages, NOW);

    expect(context.recentActivity?.id).toBe('activity');
  });
});
