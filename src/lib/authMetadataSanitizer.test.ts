import { describe, expect, it } from 'vitest';
import { sanitizeAuthMetadataForJwt } from './authMetadataSanitizer';

describe('sanitizeAuthMetadataForJwt', () => {
  it('keeps a normal avatar url in auth metadata', () => {
    const result = sanitizeAuthMetadataForJwt({
      avatar_url: 'https://cdn.example.com/avatar.jpg?v=123',
      display_name: 'Seeday',
    });

    expect(result.metadata.avatar_url).toBe('https://cdn.example.com/avatar.jpg?v=123');
    expect(result.removedKeys).not.toContain('avatar_url');
  });

  it('still strips data-url avatar payloads from auth metadata', () => {
    const result = sanitizeAuthMetadataForJwt({
      avatar_url: 'data:image/png;base64,AAAA',
    });

    expect(result.metadata.avatar_url).toBeUndefined();
    expect(result.removedKeys).toContain('avatar_url');
  });
});
