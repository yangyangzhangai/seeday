import { describe, expect, it } from 'vitest';
import {
  applyMoodRowToMaps,
  buildMoodRecordMapsFromRows,
  removeMoodRecordFromMaps,
} from './useMoodStore';

describe('useMoodStore cloud row helpers', () => {
  it('rebuilds a cloud snapshot without keeping cleared local fields', () => {
    const maps = buildMoodRecordMapsFromRows([
      {
        message_id: 'activity-1',
        mood_label: 'happy',
        custom_label: 'Proud',
        is_custom: true,
        note: 'Nice progress',
        source: 'manual',
      },
    ]);

    const cleared = applyMoodRowToMaps(maps, {
      message_id: 'activity-1',
      mood_label: null,
      custom_label: null,
      is_custom: null,
      note: null,
      source: 'auto',
    });

    expect(cleared.activityMood['activity-1']).toBeUndefined();
    expect(cleared.customMoodLabel['activity-1']).toBeUndefined();
    expect(cleared.customMoodApplied['activity-1']).toBeUndefined();
    expect(cleared.moodNote['activity-1']).toBeUndefined();
    expect(cleared.moodNoteMeta['activity-1']).toBeUndefined();
  });

  it('removes all mood-related maps for deleted rows', () => {
    const maps = buildMoodRecordMapsFromRows([
      {
        message_id: 'activity-1',
        mood_label: 'down',
        note: 'Tired',
        source: 'auto',
      },
      {
        message_id: 'activity-2',
        mood_label: 'happy',
        source: 'manual',
      },
    ]);

    const next = removeMoodRecordFromMaps(maps, 'activity-1');

    expect(next.activityMood['activity-1']).toBeUndefined();
    expect(next.moodNote['activity-1']).toBeUndefined();
    expect(next.activityMood['activity-2']).toBe('happy');
  });
});
