import { describe, expect, it } from 'vitest';
import { resolveChatImageStoragePath } from './chatImageStorage';

describe('resolveChatImageStoragePath', () => {
  it('uses different storage objects for the first and second card images', () => {
    expect(resolveChatImageStoragePath('message-1', 'imageUrl')).toBe('message-1.jpg');
    expect(resolveChatImageStoragePath('message-1', 'imageUrl2')).toBe('message-1-2.jpg');
  });
});
