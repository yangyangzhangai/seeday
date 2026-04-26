import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callClassifierAPIMock } = vi.hoisted(() => ({
  callClassifierAPIMock: vi.fn(),
}));

vi.mock('../api/client', () => ({
  callClassifierAPI: callClassifierAPIMock,
  isMembershipRequiredError: (error: unknown) => error instanceof Error
    && error.message.trim().toLowerCase() === 'membership_required',
}));

import { clearMessageClassificationTasks, ensureMessageClassification } from './chatClassificationHelpers';

describe('chatClassificationHelpers.ensureMessageClassification', () => {
  beforeEach(() => {
    clearMessageClassificationTasks();
    callClassifierAPIMock.mockReset();
  });

  it('does not call classify API for free users', async () => {
    const result = await ensureMessageClassification({
      messageId: 'free-1',
      content: '去跑步',
      lang: 'zh',
      isPlus: false,
      habits: [],
      goals: [],
    });

    expect(callClassifierAPIMock).not.toHaveBeenCalled();
    expect(result.aiCalled).toBe(false);
    expect(result.classificationPath).toBe('local_rule');
    expect(result.kind).toBe('activity');
  });

  it('calls classify once per message id for plus users', async () => {
    callClassifierAPIMock.mockResolvedValue({
      success: true,
      data: {
        kind: 'mood',
        activity_type: 'life',
        mood_type: 'calm',
        matched_bottle: null,
        confidence: 0.92,
      },
    });

    const task1 = ensureMessageClassification({
      messageId: 'plus-1',
      content: '我现在很平静',
      lang: 'zh',
      isPlus: true,
      habits: [],
      goals: [],
    });
    const task2 = ensureMessageClassification({
      messageId: 'plus-1',
      content: '我现在很平静',
      lang: 'zh',
      isPlus: true,
      habits: [],
      goals: [],
    });

    expect(task1).toBe(task2);
    const result = await task1;
    expect(callClassifierAPIMock).toHaveBeenCalledTimes(1);
    expect(result.aiCalled).toBe(true);
    expect(result.classificationPath).toBe('ai');
    expect(result.kind).toBe('mood');
    expect(result.moodType).toBe('calm');
  });

  it('falls back to local path when classify returns membership_required', async () => {
    callClassifierAPIMock.mockRejectedValue(new Error('membership_required'));

    const result = await ensureMessageClassification({
      messageId: 'plus-403',
      content: '写周报',
      lang: 'zh',
      isPlus: true,
      habits: [],
      goals: [],
    });

    expect(result.aiCalled).toBe(false);
    expect(result.classificationPath).toBe('local_rule');
    expect(result.kind).toBe('activity');
  });

  it('falls back safely when classify request fails', async () => {
    callClassifierAPIMock.mockRejectedValue(new Error('upstream timeout'));

    const result = await ensureMessageClassification({
      messageId: 'plus-timeout',
      content: '写报告',
      lang: 'zh',
      isPlus: true,
      habits: [],
      goals: [],
    });

    expect(result.aiCalled).toBe(true);
    expect(result.classificationPath).toBe('ai_fallback_local');
    expect(result.kind).toBe('unknown');
  });
});
