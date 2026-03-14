import { describe, expect, it } from 'vitest';
import { autoDetectMood } from './mood';

describe('autoDetectMood', () => {
  it('prefers explicit mood words over activity words', () => {
    expect(autoDetectMood('上课好开心', 0)).toBe('happy');
  });

  it('keeps focused for pure activity content without explicit mood', () => {
    expect(autoDetectMood('上课', 0)).toBe('focused');
  });
});
