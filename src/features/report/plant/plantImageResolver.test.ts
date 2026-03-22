// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import { describe, expect, it } from 'vitest';
import { buildPlantAssetCandidates, resolvePlantFallbackLevelFromCandidateIndex } from './plantImageResolver';

describe('buildPlantAssetCandidates', () => {
  it('builds four-level fallback ids in order', () => {
    const candidates = buildPlantAssetCandidates('fib_late_003', 'fib', 'late');
    expect(candidates[0]).toBe('/assets/plants/fib_late_003.webp');
    expect(candidates[6]).toBe('/assets/plants/fib_late_001.webp');
    expect(candidates[12]).toBe('/assets/plants/fib_mid_001.webp');
    expect(candidates[18]).toBe('/assets/plants/sha_mid_001.webp');
  });

  it('deduplicates repeated fallback ids', () => {
    const candidates = buildPlantAssetCandidates('sha_mid_001', 'sha', 'mid');
    expect(candidates).toHaveLength(6);
    expect(candidates[0]).toBe('/assets/plants/sha_mid_001.webp');
  });

  it('maps candidate index to fallback level', () => {
    expect(resolvePlantFallbackLevelFromCandidateIndex(0)).toBe(1);
    expect(resolvePlantFallbackLevelFromCandidateIndex(6)).toBe(2);
    expect(resolvePlantFallbackLevelFromCandidateIndex(12)).toBe(3);
    expect(resolvePlantFallbackLevelFromCandidateIndex(18)).toBe(4);
  });
});
