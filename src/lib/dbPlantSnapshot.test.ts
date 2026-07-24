import { describe, expect, it } from 'vitest';
import { fromDbPlantRecord, toDbPlantRecord } from './dbMappers';
import type { DailyPlantRecord } from '../types/plant';

const snapshot = {
  directionOrder: ['work_study', 'exercise', 'life', 'social', 'entertainment'] as const,
  segments: [{
    id: 'root-1',
    direction: 0 as const,
    activityId: 'activity-1',
    minutes: 90,
    focus: 'high' as const,
    isMainRoot: true,
    branchOrder: 1,
    growthMode: 'origin' as const,
  }],
  activities: [{
    id: 'activity-1',
    content: 'Write tests',
    activityType: 'work',
    timestamp: 1_721_730_000_000,
    categoryKey: 'work_study' as const,
    minutes: 90,
    focus: 'high' as const,
  }],
};

describe('plant root snapshot db mapping', () => {
  it('hydrates a persisted root snapshot', () => {
    const record = fromDbPlantRecord({
      id: 'plant-1',
      user_id: 'user-1',
      date: '2026-07-23',
      timezone: 'Europe/Paris',
      root_metrics: { root_snapshot: snapshot },
      root_type: 'tap',
      plant_id: 'tap_early_0001',
      plant_stage: 'early',
      generated_at: '2026-07-23T20:00:00.000Z',
    });
    expect(record.rootSnapshot).toEqual(snapshot);
  });

  it('persists a root snapshot inside root_metrics', () => {
    const record: DailyPlantRecord = {
      id: 'plant-1',
      userId: 'user-1',
      date: '2026-07-23',
      timezone: 'Europe/Paris',
      rootMetrics: {
        dominantRatio: 1,
        top2Gap: 1,
        depthScore: 0.5,
        evenness: 0,
        branchiness: 0,
        totalMinutes: 90,
        activeTargetDirections: 1,
        directionBreakdown: {},
      },
      rootType: 'tap',
      plantId: 'tap_early_0001',
      plantStage: 'early',
      isSpecial: false,
      isSupportVariant: false,
      rootSnapshot: {
        directionOrder: [...snapshot.directionOrder],
        segments: snapshot.segments,
        activities: snapshot.activities,
      },
      generatedAt: 1_721_730_000_000,
    };
    expect(toDbPlantRecord(record, 'user-1')).toMatchObject({
      root_metrics: { root_snapshot: record.rootSnapshot },
    });
  });
});
