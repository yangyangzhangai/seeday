import { describe, expect, it } from 'vitest';
import { mergeCloudMessagesWithLocal } from './chatSyncHelpers';
import type { Message } from './useChatStore.types';

function buildMessage(partial: Partial<Message> & Pick<Message, 'id' | 'content' | 'timestamp' | 'type'>): Message {
  return {
    mode: 'record',
    activityType: 'life',
    ...partial,
  };
}

describe('chatSyncHelpers', () => {
  it('keeps local pending messages that are still absent from cloud', () => {
    const local = [buildMessage({ id: 'm1', content: '离线消息', timestamp: 1, type: 'text', syncState: 'pending' })];

    const result = mergeCloudMessagesWithLocal([], local);

    expect(result.mergedMessages).toEqual(local);
    expect(result.changed).toBe(false);
  });

  it('drops local synced-only rows but keeps failed rows when cloud no longer has them', () => {
    const local = [
      buildMessage({ id: 'synced', content: '已删除云端', timestamp: 1, type: 'text', syncState: 'synced' }),
      buildMessage({ id: 'failed', content: '待重试', timestamp: 2, type: 'text', syncState: 'failed', syncError: 'offline' }),
    ];

    const result = mergeCloudMessagesWithLocal([], local);

    expect(result.mergedMessages.map((message) => message.id)).toEqual(['failed']);
    expect(result.changed).toBe(true);
  });
});
