import { describe, expect, it, vi } from 'vitest';
import type { AnnotationSuggestion } from '../../types/annotation';
import { runSuggestionAcceptFlow } from './AIAnnotationBubble';

function createBaseParams(suggestion: AnnotationSuggestion) {
  return {
    annotationId: 'anno-1',
    suggestion,
    isSuggestionAccepted: false,
    navigate: vi.fn(),
    setPendingSuggestionIntent: vi.fn(),
    recordSuggestionOutcome: vi.fn().mockResolvedValue(undefined),
    handleCondense: vi.fn().mockResolvedValue(undefined),
    markSuggestionAccepted: vi.fn(),
    emitEvent: vi.fn().mockReturnValue(true),
  };
}

describe('runSuggestionAcceptFlow', () => {
  it('accepts activity suggestion and triggers auto-condense', async () => {
    const params = createBaseParams({
      type: 'activity',
      actionLabel: 'Go walk',
      activityName: 'walk',
    });

    const accepted = await runSuggestionAcceptFlow(params);

    expect(accepted).toBe(true);
    expect(params.markSuggestionAccepted).toHaveBeenCalledTimes(1);
    expect(params.setPendingSuggestionIntent).not.toHaveBeenCalled();
    expect(params.emitEvent).toHaveBeenCalledTimes(1);
    expect(params.navigate).not.toHaveBeenCalled();
    expect(params.recordSuggestionOutcome).toHaveBeenCalledWith('anno-1', true);
    expect(params.handleCondense).toHaveBeenCalledTimes(1);
  });

  it('accepts todo suggestion, navigates, and triggers auto-condense', async () => {
    const params = createBaseParams({
      type: 'todo',
      actionLabel: 'Go do',
      todoId: 'todo-1',
      todoTitle: 'Run 20 minutes',
    });

    const accepted = await runSuggestionAcceptFlow(params);

    expect(accepted).toBe(true);
    expect(params.navigate).toHaveBeenCalledWith('/growth');
    expect(params.setPendingSuggestionIntent).toHaveBeenCalledTimes(1);
    expect(params.emitEvent).toHaveBeenCalledTimes(1);
    expect(params.recordSuggestionOutcome).toHaveBeenCalledWith('anno-1', true);
    expect(params.handleCondense).toHaveBeenCalledTimes(1);
  });

  it('ignores malformed suggestion and skips condense', async () => {
    const params = createBaseParams({
      type: 'activity',
      actionLabel: 'Go do',
    });

    const accepted = await runSuggestionAcceptFlow(params);

    expect(accepted).toBe(false);
    expect(params.markSuggestionAccepted).not.toHaveBeenCalled();
    expect(params.recordSuggestionOutcome).not.toHaveBeenCalled();
    expect(params.handleCondense).not.toHaveBeenCalled();
  });
});
