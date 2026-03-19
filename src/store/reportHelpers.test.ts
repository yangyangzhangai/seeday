import { describe, expect, it } from 'vitest';
import { classifyActivities } from './reportHelpers';
import type { Message } from './useChatStore';
import { normalizeActivityType } from '../lib/activityType';

function buildMessage(input: (Omit<Partial<Message>, 'activityType'> & { activityType?: string })): Message {
  const { activityType, ...rest } = input;
  return {
    id: rest.id ?? 'm1',
    content: rest.content ?? '',
    timestamp: rest.timestamp ?? Date.now(),
    type: rest.type ?? 'text',
    mode: rest.mode ?? 'record',
    duration: rest.duration ?? 30,
    activityType: normalizeActivityType(activityType ?? 'life', rest.content ?? ''),
    ...rest,
  };
}

describe('reportHelpers classifyActivities', () => {
  it('prioritizes activityType over content keywords', () => {
    const stats = classifyActivities([
      buildMessage({ content: '刷短视频', duration: 60, activityType: 'study' }),
    ]);
    expect(stats).toEqual([{ category: 'study', minutes: 60, percent: 1 }]);
  });

  it('normalizes legacy activityType before aggregation', () => {
    const stats = classifyActivities([
      buildMessage({ content: '跑步', duration: 30, activityType: '待分类' }),
      buildMessage({ content: '复习英语', duration: 30, activityType: 'work_study' }),
    ]);
    expect(stats).toEqual([
      { category: 'study', minutes: 30, percent: 0.5 },
      { category: 'health', minutes: 30, percent: 0.5 },
    ]);
  });
});
