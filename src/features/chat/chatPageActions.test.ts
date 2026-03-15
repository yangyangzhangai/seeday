import { describe, expect, it, vi } from 'vitest';
import {
  handleMagicPenModeSend,
  handleLatestMessageReclassify,
} from './chatPageActions';

function makeMagicSendParams(overrides: Partial<Parameters<typeof handleMagicPenModeSend>[0]> = {}) {
  return {
    input: '吃饭好开心',
    lang: 'zh',
    isMagicPenSending: false,
    messages: [],
    activeTodoId: null,
    todos: [],
    sendAutoRecognizedInput: vi.fn(async () => ({
      classification: {
        kind: 'activity' as const,
        internalKind: 'new_activity' as const,
        confidence: 'high' as const,
        scores: { activity: 3, mood: 0 },
        reasons: ['matched_ongoing_signal'],
      },
      messageId: 'msg-auto-1',
    })),
    completeActiveTodo: vi.fn(async () => undefined),
    updateMessageDuration: vi.fn(async () => undefined),
    parseMagicPenInput: vi.fn(async () => ({ drafts: [], unparsedSegments: [], autoWriteItems: [] })),
    setIsMagicPenSending: vi.fn(),
    setMagicPenSeedDrafts: vi.fn(),
    setMagicPenSeedUnparsed: vi.fn(),
    setMagicPenSeedAutoWritten: vi.fn(),
    setIsMagicPenOpen: vi.fn(),
    setInput: vi.fn(),
    ...overrides,
  };
}

describe('handleLatestMessageReclassify', () => {
  it('forwards message id and kind to store reclassify action', async () => {
    const reclassifyRecentInput = vi.fn(async () => undefined);
    const setExpandedActionsId = vi.fn();

    await handleLatestMessageReclassify('msg-1', 'mood', reclassifyRecentInput, setExpandedActionsId);

    expect(reclassifyRecentInput).toHaveBeenCalledWith('msg-1', 'mood');
    expect(setExpandedActionsId).toHaveBeenCalledWith(null);
  });

  it('collapses row actions only after reclassify resolves', async () => {
    let resolveReclassify: (() => void) | undefined;
    const reclassifyRecentInput = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveReclassify = resolve;
        }),
    );
    const setExpandedActionsId = vi.fn();

    const promise = handleLatestMessageReclassify(
      'msg-2',
      'activity',
      reclassifyRecentInput,
      setExpandedActionsId,
    );

    expect(setExpandedActionsId).not.toHaveBeenCalled();
    resolveReclassify?.();
    await promise;

    expect(setExpandedActionsId).toHaveBeenCalledTimes(1);
    expect(setExpandedActionsId).toHaveBeenCalledWith(null);
  });

  it('keeps actions expanded when reclassify throws', async () => {
    const reclassifyRecentInput = vi.fn(async () => {
      throw new Error('failed');
    });
    const setExpandedActionsId = vi.fn();

    await expect(
      handleLatestMessageReclassify('msg-3', 'mood', reclassifyRecentInput, setExpandedActionsId),
    ).rejects.toThrow('failed');
    expect(setExpandedActionsId).not.toHaveBeenCalled();
  });
});

describe('handleMagicPenModeSend', () => {
  it('mode-on local fast path: writes simple realtime input without parser', async () => {
    const params = makeMagicSendParams();

    await handleMagicPenModeSend(params);

    expect(params.sendAutoRecognizedInput).toHaveBeenCalledWith('吃饭好开心');
    expect(params.parseMagicPenInput).not.toHaveBeenCalled();
    expect(params.setIsMagicPenOpen).not.toHaveBeenCalled();
    expect(params.setInput).toHaveBeenCalledWith('');
  });

  it('mode-on parse with drafts: opens sheet', async () => {
    const params = makeMagicSendParams({
      input: '明天记得开会',
      parseMagicPenInput: vi.fn(async () => ({
        drafts: [
          {
            id: 'draft-1',
            kind: 'todo_add' as const,
            content: '开会',
            sourceText: '明天记得开会',
            confidence: 'high' as const,
            needsUserConfirmation: false,
            errors: [],
            todo: { priority: 'important-not-urgent' as const, category: 'life', scope: 'daily' as const },
          },
        ],
        unparsedSegments: [],
        autoWriteItems: [],
      })),
    });

    await handleMagicPenModeSend(params);

    expect(params.sendAutoRecognizedInput).not.toHaveBeenCalled();
    expect(params.parseMagicPenInput).toHaveBeenCalledWith('明天记得开会', { lang: 'zh' });
    expect(params.setIsMagicPenOpen).toHaveBeenCalledWith(true);
  });

  it('mode-on with period/time phrase: bypasses local fast path and uses parser', async () => {
    const params = makeMagicSendParams({
      input: '上午开会',
      parseMagicPenInput: vi.fn(async () => ({
        drafts: [
          {
            id: 'backfill-1',
            kind: 'activity_backfill' as const,
            content: '开会',
            sourceText: '上午开会',
            confidence: 'high' as const,
            needsUserConfirmation: true,
            errors: [],
            activity: {
              startAt: new Date(2026, 2, 11, 9, 0, 0, 0).getTime(),
              endAt: new Date(2026, 2, 11, 10, 30, 0, 0).getTime(),
              timeResolution: 'period' as const,
              suggestedTimeLabel: '上午',
            },
          },
        ],
        unparsedSegments: [],
        autoWriteItems: [],
      })),
    });

    await handleMagicPenModeSend(params);

    expect(params.sendAutoRecognizedInput).not.toHaveBeenCalled();
    expect(params.parseMagicPenInput).toHaveBeenCalledWith('上午开会', { lang: 'zh' });
    expect(params.setIsMagicPenOpen).toHaveBeenCalledWith(true);
  });

  it('mode-on short text under 6 chars: prefers local fast path', async () => {
    const params = makeMagicSendParams({
      input: '要开会了',
      parseMagicPenInput: vi.fn(async () => ({
        drafts: [
          {
            id: 'todo-1',
            kind: 'todo_add' as const,
            content: '开会',
            sourceText: '要开会了',
            confidence: 'medium' as const,
            needsUserConfirmation: false,
            errors: [],
            todo: { priority: 'important-not-urgent' as const, category: 'life', scope: 'daily' as const },
          },
        ],
        unparsedSegments: [],
        autoWriteItems: [],
      })),
    });

    await handleMagicPenModeSend(params);

    expect(params.sendAutoRecognizedInput).toHaveBeenCalledWith('要开会了');
    expect(params.parseMagicPenInput).not.toHaveBeenCalled();
    expect(params.setIsMagicPenOpen).not.toHaveBeenCalled();
  });

  it('mode-on explicit day signal: still uses parser even when short', async () => {
    const params = makeMagicSendParams({
      input: '今天难过了',
      parseMagicPenInput: vi.fn(async () => ({
        drafts: [],
        unparsedSegments: ['今天难过了'],
        autoWriteItems: [],
      })),
    });

    await handleMagicPenModeSend(params);

    expect(params.sendAutoRecognizedInput).not.toHaveBeenCalled();
    expect(params.parseMagicPenInput).toHaveBeenCalledWith('今天难过了', { lang: 'zh' });
  });

  it('mode-on explicit clock range: still uses parser', async () => {
    const params = makeMagicSendParams({
      input: '9-10点看书',
      parseMagicPenInput: vi.fn(async () => ({
        drafts: [],
        unparsedSegments: ['9-10点看书'],
        autoWriteItems: [],
      })),
    });

    await handleMagicPenModeSend(params);

    expect(params.sendAutoRecognizedInput).not.toHaveBeenCalled();
    expect(params.parseMagicPenInput).toHaveBeenCalledWith('9-10点看书', { lang: 'zh' });
  });

  it('mode-on mixed parse: auto-writes realtime item and opens sheet for review', async () => {
    const events: string[] = [];
    const params = makeMagicSendParams({
      input: '我好累，明天开会',
      sendAutoRecognizedInput: vi.fn(async () => {
        events.push('auto-write');
        return {
          classification: {
            kind: 'mood' as const,
            internalKind: 'standalone_mood' as const,
            confidence: 'high' as const,
            scores: { activity: 0, mood: 3 },
            reasons: ['matched_mood_signal'],
          },
          messageId: 'mood-1',
        };
      }),
      parseMagicPenInput: vi.fn(async () => {
        events.push('parse');
        return {
          drafts: [
            {
              id: 'draft-1',
              kind: 'todo_add' as const,
              content: '开会',
              sourceText: '明天开会',
              confidence: 'high' as const,
              needsUserConfirmation: false,
              errors: [],
              todo: { priority: 'important-not-urgent' as const, category: 'life', scope: 'daily' as const },
            },
          ],
          unparsedSegments: [],
          autoWriteItems: [
            {
              id: 'auto-1',
              kind: 'mood' as const,
              content: '我好累',
              sourceText: '我好累',
              confidence: 'high' as const,
            },
          ],
        };
      }),
    });

    await handleMagicPenModeSend(params);

    expect(events).toEqual(['parse', 'auto-write']);
    expect(params.sendAutoRecognizedInput).toHaveBeenCalledWith('我好累');
    expect(params.setIsMagicPenOpen).toHaveBeenCalledWith(true);
    expect(params.setMagicPenSeedAutoWritten).toHaveBeenCalledWith([
      {
        id: 'auto-1',
        kind: 'mood',
        content: '我好累',
        sourceText: '我好累',
        messageId: 'mood-1',
        linkedMoodContent: undefined,
      },
    ]);
  });

  it('mode-on four-kind parse: auto-writes activity+mood and keeps todo+backfill in sheet', async () => {
    const sendAutoRecognizedInput = vi
      .fn()
      .mockResolvedValueOnce({
        classification: {
          kind: 'activity' as const,
          internalKind: 'new_activity' as const,
          confidence: 'high' as const,
          scores: { activity: 4, mood: 0 },
          reasons: ['matched_ongoing_signal'],
        },
        messageId: 'activity-1',
      })
      .mockResolvedValueOnce({
        classification: {
          kind: 'mood' as const,
          internalKind: 'standalone_mood' as const,
          confidence: 'high' as const,
          scores: { activity: 0, mood: 4 },
          reasons: ['matched_mood_signal'],
        },
        messageId: 'mood-1',
      });

    const params = makeMagicSendParams({
      input: '我在吃饭，感觉很开心，明天要开会，我上午学习了',
      sendAutoRecognizedInput,
      parseMagicPenInput: vi.fn(async () => ({
        drafts: [
          {
            id: 'todo-1',
            kind: 'todo_add' as const,
            content: '开会',
            sourceText: '明天要开会',
            confidence: 'high' as const,
            needsUserConfirmation: false,
            errors: [],
            todo: { priority: 'important-not-urgent' as const, category: 'life', scope: 'daily' as const },
          },
          {
            id: 'backfill-1',
            kind: 'activity_backfill' as const,
            content: '学习',
            sourceText: '我上午学习了',
            confidence: 'high' as const,
            needsUserConfirmation: true,
            errors: [],
            activity: {
              startAt: new Date(2026, 2, 11, 9, 0, 0, 0).getTime(),
              endAt: new Date(2026, 2, 11, 11, 0, 0, 0).getTime(),
              timeResolution: 'period' as const,
              suggestedTimeLabel: '上午',
            },
          },
        ],
        unparsedSegments: [],
        autoWriteItems: [
          {
            id: 'auto-activity',
            kind: 'activity' as const,
            content: '我在吃饭',
            sourceText: '我在吃饭',
            confidence: 'high' as const,
          },
          {
            id: 'auto-mood',
            kind: 'mood' as const,
            content: '感觉很开心',
            sourceText: '感觉很开心',
            confidence: 'high' as const,
          },
        ],
      })),
    });

    await handleMagicPenModeSend(params);

    expect(sendAutoRecognizedInput).toHaveBeenNthCalledWith(1, '我在吃饭');
    expect(sendAutoRecognizedInput).toHaveBeenNthCalledWith(2, '感觉很开心');
    expect(params.setMagicPenSeedDrafts).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'todo-1', kind: 'todo_add' }),
      expect.objectContaining({ id: 'backfill-1', kind: 'activity_backfill' }),
    ]));
    expect(params.setMagicPenSeedAutoWritten).toHaveBeenCalledWith([
      {
        id: 'auto-activity',
        kind: 'activity',
        content: '我在吃饭',
        sourceText: '我在吃饭',
        messageId: 'activity-1',
        linkedMoodContent: undefined,
      },
      {
        id: 'auto-mood',
        kind: 'mood',
        content: '感觉很开心',
        sourceText: '感觉很开心',
        messageId: 'mood-1',
        linkedMoodContent: undefined,
      },
    ]);
    expect(params.setIsMagicPenOpen).toHaveBeenCalledWith(true);
  });

  it('mode-on parser auto-write only: writes item and keeps sheet closed', async () => {
    const params = makeMagicSendParams({
      input: '刚刚整理桌面。',
      parseMagicPenInput: vi.fn(async () => ({
        drafts: [],
        unparsedSegments: [],
        autoWriteItems: [
          {
            id: 'auto-1',
            kind: 'mood' as const,
            content: '我好累',
            sourceText: '我好累',
            confidence: 'high' as const,
          },
        ],
      })),
    });

    await handleMagicPenModeSend(params);

    expect(params.sendAutoRecognizedInput).toHaveBeenCalledWith('我好累');
    expect(params.setIsMagicPenOpen).not.toHaveBeenCalled();
  });

  it('mode-on low-confidence activity/mood: does not direct-write', async () => {
    const params = makeMagicSendParams({
      input: '明天我有点烦但也不知道怎么说',
      parseMagicPenInput: vi.fn(async () => ({
        drafts: [],
        unparsedSegments: ['我有点烦但也不知道怎么说'],
        autoWriteItems: [],
      })),
    });

    await handleMagicPenModeSend(params);

    expect(params.sendAutoRecognizedInput).not.toHaveBeenCalled();
    expect(params.parseMagicPenInput).toHaveBeenCalledWith('明天我有点烦但也不知道怎么说', { lang: 'zh' });
    expect(params.setIsMagicPenOpen).toHaveBeenCalledWith(true);
  });

  it('mode-on promotes unparsed realtime activity+mood into local auto-write', async () => {
    const sendAutoRecognizedInput = vi
      .fn()
      .mockResolvedValueOnce({
        classification: {
          kind: 'activity' as const,
          internalKind: 'new_activity' as const,
          confidence: 'high' as const,
          scores: { activity: 4, mood: 0 },
          reasons: ['matched_ongoing_signal'],
        },
        messageId: 'activity-1',
      })
      .mockResolvedValueOnce({
        classification: {
          kind: 'mood' as const,
          internalKind: 'standalone_mood' as const,
          confidence: 'high' as const,
          scores: { activity: 0, mood: 4 },
          reasons: ['matched_mood_signal'],
        },
        messageId: 'mood-1',
      });

    const params = makeMagicSendParams({
      input: '我现在在吃饭，有点想哭，明天要考试了，晚上还要开会',
      sendAutoRecognizedInput,
      parseMagicPenInput: vi.fn(async () => ({
        drafts: [
          {
            id: 'todo-1',
            kind: 'todo_add' as const,
            content: '考试了',
            sourceText: '明天要考试了',
            confidence: 'high' as const,
            needsUserConfirmation: false,
            errors: [],
            todo: { priority: 'important-not-urgent' as const, category: 'life', scope: 'daily' as const },
          },
          {
            id: 'todo-2',
            kind: 'todo_add' as const,
            content: '开会',
            sourceText: '晚上还要开会',
            confidence: 'medium' as const,
            needsUserConfirmation: false,
            errors: [],
            todo: { priority: 'important-not-urgent' as const, category: 'life', scope: 'daily' as const },
          },
        ],
        unparsedSegments: ['我现在在吃饭', '有点想哭', '晚上'],
        autoWriteItems: [],
      })),
    });

    await handleMagicPenModeSend(params);

    expect(sendAutoRecognizedInput).toHaveBeenNthCalledWith(1, '我现在在吃饭');
    expect(sendAutoRecognizedInput).toHaveBeenNthCalledWith(2, '有点想哭');
    expect(params.setMagicPenSeedUnparsed).toHaveBeenCalledWith(['晚上']);
    expect(params.setMagicPenSeedAutoWritten).toHaveBeenCalledWith([
      {
        id: 'local-unparsed-0',
        kind: 'activity',
        content: '我现在在吃饭',
        sourceText: '我现在在吃饭',
        messageId: 'activity-1',
        linkedMoodContent: undefined,
      },
      {
        id: 'local-unparsed-1',
        kind: 'mood',
        content: '有点想哭',
        sourceText: '有点想哭',
        messageId: 'mood-1',
        linkedMoodContent: undefined,
      },
    ]);
    expect(params.setIsMagicPenOpen).toHaveBeenCalledWith(true);
  });

  it('mode-on parser fail: keeps realtime commit and closes pending guard', async () => {
    const params = makeMagicSendParams({
      input: '明天记得开会',
      parseMagicPenInput: vi.fn(async () => {
        throw new Error('parse failed');
      }),
    });

    await expect(handleMagicPenModeSend(params)).rejects.toThrow('parse failed');
    expect(params.sendAutoRecognizedInput).not.toHaveBeenCalled();
    expect(params.setIsMagicPenSending).toHaveBeenLastCalledWith(false);
  });

  it('mode-on duplicate send while pending: skips all side effects', async () => {
    const params = makeMagicSendParams({ isMagicPenSending: true });

    await handleMagicPenModeSend(params);

    expect(params.sendAutoRecognizedInput).not.toHaveBeenCalled();
    expect(params.parseMagicPenInput).not.toHaveBeenCalled();
  });

  it('normalizes unsupported lang to zh when calling parse API', async () => {
    const params = makeMagicSendParams({
      input: '明天记得开会',
      lang: 'fr',
    });

    await handleMagicPenModeSend(params);

    expect(params.parseMagicPenInput).toHaveBeenCalledWith('明天记得开会', { lang: 'zh' });
  });

  it('completes active todo when parser returns one direct-write activity', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_800_000);
    const params = makeMagicSendParams({
      input: '我现在在下棋',
      activeTodoId: 'todo-1',
      todos: [{ id: 'todo-1', content: '复盘', startedAt: 600_000 }],
      parseMagicPenInput: vi.fn(async () => ({
        drafts: [],
        unparsedSegments: [],
        autoWriteItems: [
          {
            id: 'activity-auto',
            kind: 'activity' as const,
            content: '我现在在下棋',
            sourceText: '我现在在下棋',
            confidence: 'high' as const,
          },
        ],
      })),
      sendAutoRecognizedInput: vi.fn(async () => ({
        classification: {
          kind: 'activity' as const,
          internalKind: 'new_activity' as const,
          confidence: 'high' as const,
          scores: { activity: 4, mood: 0 },
          reasons: ['matched_ongoing_signal'],
        },
        messageId: 'activity-1',
      })),
    });

    await handleMagicPenModeSend(params);

    expect(params.completeActiveTodo).toHaveBeenCalledTimes(1);
    expect(params.updateMessageDuration).toHaveBeenCalledWith('复盘', 600000, 20);
    nowSpy.mockRestore();
  });

  it('completes active todo when parse result is mixed but includes auto-write activity', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_800_000);
    const params = makeMagicSendParams({
      input: '明天记得开会，我现在在下棋',
      activeTodoId: 'todo-1',
      todos: [{ id: 'todo-1', content: '复盘', startedAt: 600_000 }],
      parseMagicPenInput: vi.fn(async () => ({
        drafts: [
          {
            id: 'todo-draft',
            kind: 'todo_add' as const,
            content: '开会',
            sourceText: '明天记得开会',
            confidence: 'high' as const,
            needsUserConfirmation: false,
            errors: [],
            todo: { priority: 'important-not-urgent' as const, category: 'life', scope: 'daily' as const },
          },
        ],
        unparsedSegments: [],
        autoWriteItems: [
          {
            id: 'activity-auto',
            kind: 'activity' as const,
            content: '我现在在下棋',
            sourceText: '我现在在下棋',
            confidence: 'high' as const,
          },
        ],
      })),
      sendAutoRecognizedInput: vi.fn(async () => ({
        classification: {
          kind: 'activity' as const,
          internalKind: 'new_activity' as const,
          confidence: 'high' as const,
          scores: { activity: 4, mood: 0 },
          reasons: ['matched_ongoing_signal'],
        },
        messageId: 'activity-2',
      })),
    });

    await handleMagicPenModeSend(params);

    expect(params.sendAutoRecognizedInput).toHaveBeenCalledWith('我现在在下棋');
    expect(params.completeActiveTodo).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });
});
