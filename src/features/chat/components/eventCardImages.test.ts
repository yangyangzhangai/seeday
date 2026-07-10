import { describe, expect, it } from 'vitest';
import { getVisibleEventCardImageSlots } from './eventCardImages';

describe('getVisibleEventCardImageSlots', () => {
  it('keeps the second image visible when the first image is removed', () => {
    expect(getVisibleEventCardImageSlots({
      imageUrl: null,
      imageUrl2: 'https://example.com/second.jpg',
    })).toEqual(['imageUrl2']);
  });

  it('returns both image slots when both images exist', () => {
    expect(getVisibleEventCardImageSlots({
      imageUrl: 'https://example.com/first.jpg',
      imageUrl2: 'https://example.com/second.jpg',
    })).toEqual(['imageUrl', 'imageUrl2']);
  });
});
