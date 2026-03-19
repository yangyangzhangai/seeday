import { describe, expect, it } from 'vitest';
import {
  computeRootMetrics,
  isAirPlantDay,
  isEntertainmentDominantDay,
  matchRootType,
  resolveSupportVariant,
} from './plantCalculator';

describe('plantCalculator', () => {
  it('computes metrics with weighted denominator rules', () => {
    const metrics = computeRootMetrics([
      { id: 'a1', categoryKey: 'work_study', minutes: 300, focus: 'high' },
      { id: 'a2', categoryKey: 'exercise', minutes: 120, focus: 'medium' },
      { id: 'a3', categoryKey: 'life', minutes: 180, focus: 'medium' },
      { id: 'a4', categoryKey: 'social', minutes: 80, focus: 'medium' },
    ]);

    expect(metrics.totalMinutes).toBe(680);
    expect(metrics.activeTargetDirections).toBe(3);
    expect(metrics.dominantRatio).toBeCloseTo(300 / 554, 5);
    expect(metrics.top2Gap).toBeCloseTo((300 - 120) / 554, 5);
    expect(metrics.evenness).toBeGreaterThan(0);
    expect(metrics.branchiness).toBeGreaterThan(0);
  });

  it('matches normal day root type through score competition', () => {
    const metrics = computeRootMetrics([
      { id: 'n1', categoryKey: 'work_study', minutes: 240, focus: 'high' },
      { id: 'n2', categoryKey: 'work_study', minutes: 120, focus: 'high' },
      { id: 'n3', categoryKey: 'social', minutes: 35, focus: 'medium' },
      { id: 'n4', categoryKey: 'life', minutes: 70, focus: 'medium' },
    ]);

    expect(matchRootType(metrics)).toBe('tap');
  });

  it('detects air-plant day with AND condition', () => {
    const sparse = [
      { id: 's1', categoryKey: 'life' as const, minutes: 12, focus: 'medium' as const },
      { id: 's2', categoryKey: 'social' as const, minutes: 15, focus: 'medium' as const },
    ];
    const notSparse = [
      { id: 's3', categoryKey: 'life' as const, minutes: 25, focus: 'medium' as const },
      { id: 's4', categoryKey: 'social' as const, minutes: 10, focus: 'medium' as const },
    ];

    expect(isAirPlantDay(sparse)).toBe(true);
    expect(isAirPlantDay(notSparse)).toBe(false);
  });

  it('detects entertainment dominant day by real total ratio', () => {
    const metrics = computeRootMetrics([
      { id: 'f1', categoryKey: 'entertainment', minutes: 240, focus: 'medium' },
      { id: 'f2', categoryKey: 'life', minutes: 70, focus: 'medium' },
      { id: 'f3', categoryKey: 'work_study', minutes: 50, focus: 'medium' },
    ]);

    expect(isEntertainmentDominantDay(metrics)).toBe(true);
  });

  it('resolves support variant with support ratio + depth + dominant thresholds', () => {
    const metrics = computeRootMetrics([
      { id: 'u1', categoryKey: 'exercise', minutes: 160, focus: 'high' },
      { id: 'u2', categoryKey: 'life', minutes: 120, focus: 'medium' },
      { id: 'u3', categoryKey: 'work_study', minutes: 180, focus: 'high' },
      { id: 'u4', categoryKey: 'social', minutes: 90, focus: 'medium' },
    ]);

    expect(resolveSupportVariant(metrics)).toBe(true);
  });
});
