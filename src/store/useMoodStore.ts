// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type MoodKey, normalizeMoodKey } from '../lib/moodOptions';

const MAX_MOOD_ENTRIES = 500;

export type MoodOption =
  | MoodKey;

export type MoodSource = 'auto' | 'manual';

export interface MoodAttachmentMeta {
  source: MoodSource;
  linkedMoodMessageId?: string;
}

type MoodAttachmentInput = MoodSource | MoodAttachmentMeta;

function normalizeMoodAttachmentMeta(input?: MoodAttachmentInput): MoodAttachmentMeta {
  if (!input) {
    return { source: 'auto' };
  }

  if (typeof input === 'string') {
    return { source: input };
  }

  return {
    source: input.source,
    linkedMoodMessageId: input.linkedMoodMessageId,
  };
}

interface MoodState {
  activityMood: Record<string, MoodOption | undefined>;
  activityMoodMeta: Record<string, MoodAttachmentMeta | undefined>;
  customMoodLabel: Record<string, string | undefined>;
  customMoodApplied: Record<string, boolean | undefined>;
  customMoodOptions: string[];
  moodNote: Record<string, string | undefined>;
  moodNoteMeta: Record<string, MoodAttachmentMeta | undefined>;
  setMood: (activityId: string, mood: MoodOption, source?: MoodAttachmentInput) => void;
  setCustomMoodLabel: (activityId: string, label: string | undefined) => void;
  setCustomMoodApplied: (activityId: string, applied: boolean) => void;
  addCustomMoodOption: (label: string) => void;
  setMoodNote: (activityId: string, note: string, source?: MoodAttachmentInput) => void;
  clearAutoMoodAttachmentsByMessage: (activityId: string, moodMessageId: string) => void;
  getMood: (activityId: string) => MoodOption | undefined;
  clear: () => void;
}

type MoodRecordMaps = {
  activityMood: Record<string, MoodOption | undefined>;
  activityMoodMeta: Record<string, MoodAttachmentMeta | undefined>;
  customMoodLabel: Record<string, string | undefined>;
  customMoodApplied: Record<string, boolean | undefined>;
  moodNote: Record<string, string | undefined>;
  moodNoteMeta: Record<string, MoodAttachmentMeta | undefined>;
};

function pruneMoodRecordMaps(maps: MoodRecordMaps): MoodRecordMaps {
  const orderedIds = Array.from(
    new Set([
      ...Object.keys(maps.activityMood),
      ...Object.keys(maps.activityMoodMeta),
      ...Object.keys(maps.customMoodLabel),
      ...Object.keys(maps.customMoodApplied),
      ...Object.keys(maps.moodNote),
      ...Object.keys(maps.moodNoteMeta),
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
    activityMoodMeta: trim(maps.activityMoodMeta),
    customMoodLabel: trim(maps.customMoodLabel),
    customMoodApplied: trim(maps.customMoodApplied),
    moodNote: trim(maps.moodNote),
    moodNoteMeta: trim(maps.moodNoteMeta),
  };
}

export const useMoodStore = create<MoodState>()(
  persist(
    (set, get) => ({
      activityMood: {},
      activityMoodMeta: {},
      customMoodLabel: {},
      customMoodApplied: {},
      customMoodOptions: [],
      moodNote: {},
      moodNoteMeta: {},
      setMood: (activityId, mood, source) =>
        set(state =>
          pruneMoodRecordMaps({
            activityMood: { ...state.activityMood, [activityId]: normalizeMoodKey(mood) },
            activityMoodMeta: { ...state.activityMoodMeta, [activityId]: normalizeMoodAttachmentMeta(source) },
            customMoodLabel: state.customMoodLabel,
            customMoodApplied: state.customMoodApplied,
            moodNote: state.moodNote,
            moodNoteMeta: state.moodNoteMeta,
          })
        ),
      setCustomMoodLabel: (activityId, label) =>
        set(state =>
          pruneMoodRecordMaps({
            activityMood: state.activityMood,
            activityMoodMeta: state.activityMoodMeta,
            customMoodLabel: { ...state.customMoodLabel, [activityId]: label },
            customMoodApplied: state.customMoodApplied,
            moodNote: state.moodNote,
            moodNoteMeta: state.moodNoteMeta,
          })
        ),
      setCustomMoodApplied: (activityId, applied) =>
        set(state =>
          pruneMoodRecordMaps({
            activityMood: state.activityMood,
            activityMoodMeta: state.activityMoodMeta,
            customMoodLabel: state.customMoodLabel,
            customMoodApplied: { ...state.customMoodApplied, [activityId]: applied },
            moodNote: state.moodNote,
            moodNoteMeta: state.moodNoteMeta,
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
      setMoodNote: (activityId, note, source) =>
        set(state =>
          pruneMoodRecordMaps({
            activityMood: state.activityMood,
            activityMoodMeta: state.activityMoodMeta,
            customMoodLabel: state.customMoodLabel,
            customMoodApplied: state.customMoodApplied,
            moodNote: { ...state.moodNote, [activityId]: note },
            moodNoteMeta: { ...state.moodNoteMeta, [activityId]: normalizeMoodAttachmentMeta(source) },
          })
        ),
      clearAutoMoodAttachmentsByMessage: (activityId, moodMessageId) =>
        set((state) => {
          const moodMeta = state.activityMoodMeta[activityId];
          const noteMeta = state.moodNoteMeta[activityId];
          const shouldClearMood =
            moodMeta?.source === 'auto' && moodMeta.linkedMoodMessageId === moodMessageId;
          const shouldClearNote =
            noteMeta?.source === 'auto' && noteMeta.linkedMoodMessageId === moodMessageId;

          if (!shouldClearMood && !shouldClearNote) {
            return state;
          }

          return pruneMoodRecordMaps({
            activityMood: shouldClearMood
              ? { ...state.activityMood, [activityId]: undefined }
              : state.activityMood,
            activityMoodMeta: shouldClearMood
              ? { ...state.activityMoodMeta, [activityId]: undefined }
              : state.activityMoodMeta,
            customMoodLabel: state.customMoodLabel,
            customMoodApplied: state.customMoodApplied,
            moodNote: shouldClearNote
              ? { ...state.moodNote, [activityId]: undefined }
              : state.moodNote,
            moodNoteMeta: shouldClearNote
              ? { ...state.moodNoteMeta, [activityId]: undefined }
              : state.moodNoteMeta,
          });
        }),
      getMood: (activityId) => get().activityMood[activityId],
      clear: () => set({
        activityMood: {},
        activityMoodMeta: {},
        customMoodLabel: {},
        customMoodApplied: {},
        moodNote: {},
        moodNoteMeta: {},
      }),
    }),
    {
      name: 'activity-mood-storage',
      partialize: (state) => ({
        activityMood: state.activityMood,
        activityMoodMeta: state.activityMoodMeta,
        customMoodLabel: state.customMoodLabel,
        customMoodApplied: state.customMoodApplied,
        customMoodOptions: state.customMoodOptions,
        moodNote: state.moodNote,
        moodNoteMeta: state.moodNoteMeta,
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
          activityMoodMeta: persisted.activityMoodMeta || {},
          moodNoteMeta: persisted.moodNoteMeta || {},
        };
      },
    }
  )
);
