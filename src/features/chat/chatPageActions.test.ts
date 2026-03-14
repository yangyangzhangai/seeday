import { describe, expect, it, vi } from 'vitest';
import {
  handleMagicPenModeSend,
  handleLatestMessageReclassify,
} from './chatPageActions';

function makeMagicSendParams(overrides: Partial<Parameters<typeof handleMagicPenModeSend>[0]> = {}) {
  return {
    input: '我现在在下棋',
    lang: 'zh',
    isMagicPenSending: false,
    activeTodoId: null,
    todos: [],
    recentActivity: undefined,
    sendAutoRecognizedInput: vi.fn(async () => ({
      kind: 'activity' as const,
      internalKind: 'new_activity' as const,
      confidence: 'high' as const,
      scores: { activity: 3, mood: 0 },
      reasons: ['matched_ongoing_signal'],
    })),
    completeActiveTodo: vi.fn(async () => undefined),
    updateMessageDuration: vi.fn(async () => undefined),
    parseMagicPenInput: vi.fn(async () => ({ drafts: [], unparsedSegments: [], autoWriteItems: [] })),
    setIsMagicPenSending: vi.fn(),
    setMagicPenSeedDrafts: vi.fn(),
    setMagicPenSeedUnparsed: vi.fn(),
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
  it('mode-on no todo signal: keeps local activity/mood flow', async () => {
    const params = makeMagicSendParams();

    await handleMagicPenModeSend(params);

    expect(params.sendAutoRecognizedInput).toHaveBeenCalledWith('我现在在下棋');
    expect(params.parseMagicPenInput).not.toHaveBeenCalled();
    expect(params.setIsMagicPenOpen).not.toHaveBeenCalled();
    expect(params.setInput).toHaveBeenCalledWith('');
  });

  it('mode-on todo signal: parses whole sentence and opens sheet', async () => {
    const params = makeMagicSendParams({
      input: '明天记得开会',
      parseMagicPenInput: vi.fn(async () => ({
        drafts: [
          {
            id: 'draft-1',
            kind: 'todo_add',
            content: '开会',
            sourceText: '明天记得开会',
            confidence: 'high',
            needsUserConfirmation: false,
            errors: [],
            todo: { priority: 'important-not-urgent', category: 'life', scope: 'daily' },
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

  it('mode-on todo signal mixed parse: auto-writes first then opens sheet', async () => {
    const events: string[] = [];
    const params = makeMagicSendParams({
      input: '我好累，明天开会',
      sendAutoRecognizedInput: vi.fn(async () => {
        events.push('auto-write');
        return {
          kind: 'mood' as const,
          internalKind: 'standalone_mood' as const,
          confidence: 'high' as const,
          scores: { activity: 0, mood: 3 },
          reasons: ['matched_mood_signal'],
        };
      }),
      parseMagicPenInput: vi.fn(async () => {
        events.push('parse');
        return {
          drafts: [
            {
              id: 'draft-1',
              kind: 'todo_add',
              content: '开会',
              sourceText: '明天开会',
              confidence: 'high',
              needsUserConfirmation: false,
              errors: [],
              todo: { priority: 'important-not-urgent', category: 'life', scope: 'daily' },
            },
          ],
          unparsedSegments: [],
          autoWriteItems: [
            {
              id: 'auto-1',
              kind: 'mood',
              content: '我好累',
              sourceText: '我好累',
              confidence: 'high',
            },
          ],
        };
      }),
    });

    await handleMagicPenModeSend(params);

    expect(events).toEqual(['parse', 'auto-write']);
    expect(params.sendAutoRecognizedInput).toHaveBeenCalledWith('我好累');
    expect(params.setIsMagicPenOpen).toHaveBeenCalledWith(true);
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

  it('completes active todo when realtime clause records activity', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_800_000);
    const params = makeMagicSendParams({
      activeTodoId: 'todo-1',
      todos: [{ id: 'todo-1', content: '复盘', startedAt: 600_000 }],
      sendAutoRecognizedInput: vi.fn(async () => ({
        kind: 'activity' as const,
        internalKind: 'new_activity' as const,
        confidence: 'high' as const,
        scores: { activity: 4, mood: 0 },
        reasons: ['matched_ongoing_signal'],
      })),
    });

    await handleMagicPenModeSend(params);

    expect(params.completeActiveTodo).toHaveBeenCalledTimes(1);
    expect(params.updateMessageDuration).toHaveBeenCalledWith('复盘', 600000, 20);
    nowSpy.mockRestore();
  });

  it('completes active todo when magic auto-write includes high confidence activity', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_800_000);
    const params = makeMagicSendParams({
      input: '明天记得开会，我现在在下棋',
      activeTodoId: 'todo-1',
      todos: [{ id: 'todo-1', content: '复盘', startedAt: 600_000 }],
      parseMagicPenInput: vi.fn(async () => ({
        drafts: [
          {
            id: 'todo-draft',
            kind: 'todo_add',
            content: '开会',
            sourceText: '明天记得开会',
            confidence: 'high',
            needsUserConfirmation: false,
            errors: [],
            todo: { priority: 'important-not-urgent', category: 'life', scope: 'daily' },
          },
        ],
        unparsedSegments: [],
        autoWriteItems: [
          {
            id: 'activity-auto',
            kind: 'activity',
            content: '我现在在下棋',
            sourceText: '我现在在下棋',
            confidence: 'high',
          },
        ],
      })),
      sendAutoRecognizedInput: vi.fn(async () => ({
        kind: 'activity' as const,
        internalKind: 'new_activity' as const,
        confidence: 'high' as const,
        scores: { activity: 4, mood: 0 },
        reasons: ['matched_ongoing_signal'],
      })),
    });

    await handleMagicPenModeSend(params);

    expect(params.completeActiveTodo).toHaveBeenCalledTimes(1);
    expect(params.updateMessageDuration).toHaveBeenCalledWith('复盘', 600000, 20);
    nowSpy.mockRestore();
  });
});
