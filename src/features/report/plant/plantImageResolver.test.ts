// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import { describe, expect, it } from 'vitest';
import { buildPlantAssetCandidates, resolvePlantFallbackLevelFromCandidateIndex } from './plantImageResolver';

describe('buildPlantAssetCandidates', () => {
  it('builds three-level fallback ids in order', () => {
    const candidates = buildPlantAssetCandidates('fib_late_0003', 'fib', 'late');
    expect(candidates[0]).toBe('/assets/plants/fib_late_0003.webp');   // Level 1: 精确匹配
    expect(candidates[6]).toBe('/assets/plants/fib_late_0001.webp');   // Level 2: 同类同阶 _0001
    expect(candidates[12]).toBe('/assets/plants/sha_early_0001.webp'); // Level 3: 全局兜底
  });

  it('deduplicates repeated fallback ids', () => {
    const candidates = buildPlantAssetCandidates('sha_early_0001', 'sha', 'early');
    expect(candidates).toHaveLength(6);
    expect(candidates[0]).toBe('/assets/plants/sha_early_0001.webp');
  });

  it('maps candidate index to fallback level', () => {
    expect(resolvePlantFallbackLevelFromCandidateIndex(0)).toBe(1);
    expect(resolvePlantFallbackLevelFromCandidateIndex(6)).toBe(2);
    expect(resolvePlantFallbackLevelFromCandidateIndex(12)).toBe(3);
    expect(resolvePlantFallbackLevelFromCandidateIndex(18)).toBe(4); // 超出链，完全缺失
  });
});
