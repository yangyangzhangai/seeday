import { describe, expect, it } from 'vitest';
import { buildPlantRootSnapshot, parsePlantRootSnapshot } from './plantRootSnapshot';

describe('plantRootSnapshot', () => {
  it('builds deterministic segments with the saved direction order', () => {
    const snapshot = buildPlantRootSnapshot('2026-07-23', [
      'work_study', 'exercise', 'life', 'social', 'entertainment',
    ], [{
      id: 'activity-1',
      content: 'Write tests',
      activityType: 'work',
      timestamp: 1_721_730_000_000,
      categoryKey: 'work_study',
      minutes: 90,
      focus: 'high',
    }]);

    expect(snapshot.segments).toHaveLength(1);
    expect(snapshot.segments[0]).toMatchObject({
      activityId: 'activity-1',
      direction: 0,
      minutes: 90,
    });
  });

  it('rejects malformed persisted snapshots', () => {
    expect(parsePlantRootSnapshot({ directionOrder: [], segments: [{}], activities: [] })).toBeUndefined();
  });
});
