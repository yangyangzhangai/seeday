import { describe, expect, it, vi } from 'vitest';
import {
  handleLatestMessageReclassify,
} from './chatPageActions';

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
