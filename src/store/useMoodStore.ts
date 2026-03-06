// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type MoodKey, normalizeMoodKey } from '../lib/moodOptions';

const MAX_MOOD_ENTRIES = 500;

export type MoodOption =
  | MoodKey;

interface MoodState {
  activityMood: Record<string, MoodOption | undefined>;
  customMoodLabel: Record<string, string | undefined>;
  customMoodApplied: Record<string, boolean | undefined>;
  customMoodOptions: string[];
  moodNote: Record<string, string | undefined>;
  setMood: (activityId: string, mood: MoodOption) => void;
  setCustomMoodLabel: (activityId: string, label: string | undefined) => void;
  setCustomMoodApplied: (activityId: string, applied: boolean) => void;
  addCustomMoodOption: (label: string) => void;
  setMoodNote: (activityId: string, note: string) => void;
  getMood: (activityId: string) => MoodOption | undefined;
  clear: () => void;
}

type MoodRecordMaps = {
  activityMood: Record<string, MoodOption | undefined>;
  customMoodLabel: Record<string, string | undefined>;
  customMoodApplied: Record<string, boolean | undefined>;
  moodNote: Record<string, string | undefined>;
};

function pruneMoodRecordMaps(maps: MoodRecordMaps): MoodRecordMaps {
  const orderedIds = Array.from(
    new Set([
      ...Object.keys(maps.activityMood),
      ...Object.keys(maps.customMoodLabel),
      ...Object.keys(maps.customMoodApplied),
      ...Object.keys(maps.moodNote),
    ])
  );

  const overflowCount = orderedIds.length - MAX_MOOD_ENTRIES;
  if (overflowCount <= 0) {
    return maps;
  }

  const idsToRemove = new Set(orderedIds.slice(0, overflowCount));

  const trim = <T>(record: Record<string, T | undefined>): Record<string, T | undefined> => {
    const next: Record<string, T | undefined> = {};
    for (const [key, value] of Object.entries(record)) {
      if (!idsToRemove.has(key)) {
        next[key] = value;
      }
    }
    return next;
  };

  return {
    activityMood: trim(maps.activityMood),
    customMoodLabel: trim(maps.customMoodLabel),
    customMoodApplied: trim(maps.customMoodApplied),
    moodNote: trim(maps.moodNote),
  };
}

export const useMoodStore = create<MoodState>()(
  persist(
    (set, get) => ({
      activityMood: {},
      customMoodLabel: {},
      customMoodApplied: {},
      customMoodOptions: [],
      moodNote: {},
      setMood: (activityId, mood) =>
        set(state =>
          pruneMoodRecordMaps({
            activityMood: { ...state.activityMood, [activityId]: normalizeMoodKey(mood) },
            customMoodLabel: state.customMoodLabel,
            customMoodApplied: state.customMoodApplied,
            moodNote: state.moodNote,
          })
        ),
      setCustomMoodLabel: (activityId, label) =>
        set(state =>
          pruneMoodRecordMaps({
            activityMood: state.activityMood,
            customMoodLabel: { ...state.customMoodLabel, [activityId]: label },
            customMoodApplied: state.customMoodApplied,
            moodNote: state.moodNote,
          })
        ),
      setCustomMoodApplied: (activityId, applied) =>
        set(state =>
          pruneMoodRecordMaps({
            activityMood: state.activityMood,
            customMoodLabel: state.customMoodLabel,
            customMoodApplied: { ...state.customMoodApplied, [activityId]: applied },
            moodNote: state.moodNote,
          })
        ),
      addCustomMoodOption: (label) =>
        set(state => {
          const value = label.trim();
          if (!value) return state;
          return {
            customMoodOptions: [value],
          };
        }),
      setMoodNote: (activityId, note) =>
        set(state =>
          pruneMoodRecordMaps({
            activityMood: state.activityMood,
            customMoodLabel: state.customMoodLabel,
            customMoodApplied: state.customMoodApplied,
            moodNote: { ...state.moodNote, [activityId]: note },
          })
        ),
      getMood: (activityId) => get().activityMood[activityId],
      clear: () => set({ activityMood: {}, customMoodLabel: {}, customMoodApplied: {}, moodNote: {} }),
    }),
    {
      name: 'activity-mood-storage',
      partialize: (state) => ({
        activityMood: state.activityMood,
        customMoodLabel: state.customMoodLabel,
        customMoodApplied: state.customMoodApplied,
        customMoodOptions: state.customMoodOptions,
        moodNote: state.moodNote,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<MoodState>) || {};
        const current = currentState as MoodState;
        const persistedActivityMood = persisted.activityMood || {};
        const migratedActivityMood = Object.fromEntries(
          Object.entries(persistedActivityMood).map(([id, mood]) => [id, normalizeMoodKey(mood as string)])
        ) as Record<string, MoodOption | undefined>;

        return {
          ...current,
          ...persisted,
          activityMood: migratedActivityMood,
        };
      },
    }
  )
);
