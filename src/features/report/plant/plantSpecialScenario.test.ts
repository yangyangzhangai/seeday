// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import { describe, expect, it } from 'vitest';
import type { DailyPlantRecord } from '../../../types/plant';
import { resolvePlantSpecialScenario } from './plantSpecialScenario';

function buildRecord(partial: Partial<DailyPlantRecord>): DailyPlantRecord {
  return {
    id: 'p1',
    userId: 'u1',
    date: '2026-03-22',
    timezone: 'Asia/Shanghai',
    rootMetrics: {
      dominantRatio: 0,
      top2Gap: 0,
      depthScore: 0,
      evenness: 0,
      branchiness: 0,
      totalMinutes: 0,
      activeTargetDirections: 0,
      directionBreakdown: {
        entertainment: { minutes: 0, weightedMinutes: 0, activities: 0, focus: 'medium' },
      },
    },
    rootType: 'tap',
    plantId: 'tap_early_001',
    plantStage: 'early',
    isSpecial: false,
    isSupportVariant: false,
    generatedAt: Date.now(),
    ...partial,
  };
}

describe('resolvePlantSpecialScenario', () => {
  it('detects air day with AND condition', () => {
    const record = buildRecord({
      rootType: 'sha',
      isSpecial: true,
      rootMetrics: {
        dominantRatio: 0,
        top2Gap: 0,
        depthScore: 0,
        evenness: 0,
        branchiness: 0,
        totalMinutes: 20,
        activeTargetDirections: 1,
        directionBreakdown: {
          life: { minutes: 20, weightedMinutes: 6, activities: 2, focus: 'medium' },
        },
      },
    });

    expect(resolvePlantSpecialScenario(record)).toBe('air');
  });

  it('detects entertainment-dominant special day', () => {
    const record = buildRecord({
      rootType: 'fib',
      isSpecial: true,
      rootMetrics: {
        dominantRatio: 0,
        top2Gap: 0,
        depthScore: 0,
        evenness: 0,
        branchiness: 0,
        totalMinutes: 100,
        activeTargetDirections: 2,
        directionBreakdown: {
          entertainment: { minutes: 65, weightedMinutes: 65, activities: 3, focus: 'medium' },
          social: { minutes: 35, weightedMinutes: 35, activities: 1, focus: 'medium' },
        },
      },
    });

    expect(resolvePlantSpecialScenario(record)).toBe('entertainment');
  });

  it('falls back to normal for non-special day', () => {
    const record = buildRecord({ isSpecial: false });
    expect(resolvePlantSpecialScenario(record)).toBe('normal');
  });
});
