// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/README.md
import { describe, expect, it } from 'vitest';
import { mapSourcesToPlantActivities } from '../lib/plantActivityMapper';
import { buildRootSegments } from '../lib/rootRenderer';
import { resolvePlantDurationForMessage } from './usePlantStore';

function segmentCountFromSources(sources: Array<{ id: string; duration?: number; timestamp: number }>): number {
  const nowMs = 1_800_000;
  const mapped = mapSourcesToPlantActivities(
    sources.map(source => ({
      id: source.id,
      content: '学习',
      activityType: 'work',
      duration: resolvePlantDurationForMessage(source.duration, source.timestamp, nowMs),
    })),
  );
  return buildRootSegments(
    mapped.map(activity => ({
      activityId: activity.id,
      direction: 2,
      minutes: activity.minutes,
      focus: activity.focus,
    })),
    '2026-03-18',
  ).length;
}

describe('usePlantStore timing rules', () => {
  it('does not render roots for completed activities under 5 minutes', () => {
    const count = segmentCountFromSources([{ id: 'm1', duration: 4, timestamp: 1_760_000 }]);
    expect(count).toBe(0);
  });

  it('renders roots after completion for activities between 5 and 15 minutes', () => {
    const count = segmentCountFromSources([{ id: 'm2', duration: 10, timestamp: 1_200_000 }]);
    expect(count).toBe(1);
  });

  it('does not render ongoing activity before 15 minutes, but starts rendering after 15 minutes', () => {
    const before15Count = segmentCountFromSources([{ id: 'm3', timestamp: 1_260_000 }]);
    const after15Count = segmentCountFromSources([{ id: 'm4', timestamp: 720_000 }]);

    expect(before15Count).toBe(0);
    expect(after15Count).toBe(1);
  });
});
