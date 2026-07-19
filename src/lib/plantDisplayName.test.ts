// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import { describe, expect, it } from 'vitest';
import { getPlantDisplayName } from './plantDisplayName';

describe('getPlantDisplayName', () => {
  it('returns the registered plant name for each supported language', () => {
    expect(getPlantDisplayName('tap_early_0001', 'zh-CN')).toBe('虞美人');
    expect(getPlantDisplayName('tap_early_0001', 'en-US')).toBe('Corn Poppy');
    expect(getPlantDisplayName('tap_early_0001', 'it-IT')).toBe('Papavero');
  });

  it('falls back to English for unsupported languages', () => {
    expect(getPlantDisplayName('bul_early_0001', 'fr-FR')).toBe('Tulip');
  });

  it('returns an empty string for an unknown plant', () => {
    expect(getPlantDisplayName('unknown_plant', 'en')).toBe('');
  });
});
