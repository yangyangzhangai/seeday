// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type MoodKey, normalizeMoodKey } from '../lib/moodOptions';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';

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
  /** Fetch all mood rows from Supabase and hydrate local state */
  fetchMoods: () => Promise<void>;
}

type MoodRecordMaps = {
  activityMood: Record<string, MoodOption | undefined>;
  activityMoodMeta: Record<string, MoodAttachmentMeta | undefined>;
  customMoodLabel: Record<string, string | undefined>;
  customMoodApplied: Record<string, boolean | undefined>;
  moodNote: Record<string, string | undefined>;
  moodNoteMeta: Record<string, MoodAttachmentMeta | undefined>;
};

export interface MoodRowData {
  message_id: string;
  mood_label?: string | null;
  custom_label?: string | null;
  is_custom?: boolean | null;
  note?: string | null;
  source?: string | null;
}

function normalizePersistedMoodSource(raw?: string | null): MoodSource {
  return raw === 'manual' ? 'manual' : 'auto';
}

export function pruneMoodRecordMaps(maps: MoodRecordMaps): MoodRecordMaps {
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

export function removeMoodRecordFromMaps(maps: MoodRecordMaps, activityId: string): MoodRecordMaps {
  const activityMood = { ...maps.activityMood };
  const activityMoodMeta = { ...maps.activityMoodMeta };
  const customMoodLabel = { ...maps.customMoodLabel };
  const customMoodApplied = { ...maps.customMoodApplied };
  const moodNote = { ...maps.moodNote };
  const moodNoteMeta = { ...maps.moodNoteMeta };

  delete activityMood[activityId];
  delete activityMoodMeta[activityId];
  delete customMoodLabel[activityId];
  delete customMoodApplied[activityId];
  delete moodNote[activityId];
  delete moodNoteMeta[activityId];

  return {
    activityMood,
    activityMoodMeta,
    customMoodLabel,
    customMoodApplied,
    moodNote,
    moodNoteMeta,
  };
}

export function applyMoodRowToMaps(maps: MoodRecordMaps, row: MoodRowData): MoodRecordMaps {
  const next = removeMoodRecordFromMaps(maps, row.message_id);
  const source = normalizePersistedMoodSource(row.source);

  if (row.mood_label) {
    next.activityMood[row.message_id] = normalizeMoodKey(row.mood_label) ?? undefined;
    next.activityMoodMeta[row.message_id] = { source };
  }

  if (row.custom_label != null) {
    next.customMoodLabel[row.message_id] = row.custom_label;
  }

  if (row.is_custom != null) {
    next.customMoodApplied[row.message_id] = row.is_custom;
  }

  if (row.note != null) {
    next.moodNote[row.message_id] = row.note;
    next.moodNoteMeta[row.message_id] = { source };
  }

  return next;
}

export function buildMoodRecordMapsFromRows(rows: MoodRowData[]): MoodRecordMaps {
  return rows.reduce<MoodRecordMaps>(
    (maps, row) => applyMoodRowToMaps(maps, row),
    {
      activityMood: {},
      activityMoodMeta: {},
      customMoodLabel: {},
      customMoodApplied: {},
      moodNote: {},
      moodNoteMeta: {},
    },
  );
}

/** Upsert a single mood row to Supabase. Fires-and-forgets alongside local state update. */
async function persistMoodRow(
  messageId: string,
  patch: {
    mood_label?: string | null;
    custom_label?: string | null;
    is_custom?: boolean;
    note?: string | null;
    source?: string;
  }
): Promise<void> {
  try {
    const session = await getSupabaseSession();
    if (!session) return;
    await supabase.from('moods').upsert(
      { user_id: session.user.id, message_id: messageId, ...patch },
      { onConflict: 'user_id,message_id' }
    );
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[MoodStore] Supabase upsert failed', err);
  }
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

      setMood: (activityId, mood, source) => {
        const normalized = normalizeMoodKey(mood);
        const meta = normalizeMoodAttachmentMeta(source);
        set(state =>
          pruneMoodRecordMaps({
            activityMood: { ...state.activityMood, [activityId]: normalized },
            activityMoodMeta: { ...state.activityMoodMeta, [activityId]: meta },
            customMoodLabel: state.customMoodLabel,
            customMoodApplied: state.customMoodApplied,
            moodNote: state.moodNote,
            moodNoteMeta: state.moodNoteMeta,
          })
        );
        void persistMoodRow(activityId, { mood_label: normalized ?? null, source: meta.source });
      },

      setCustomMoodLabel: (activityId, label) => {
        set(state =>
          pruneMoodRecordMaps({
            activityMood: state.activityMood,
            activityMoodMeta: state.activityMoodMeta,
            customMoodLabel: { ...state.customMoodLabel, [activityId]: label },
            customMoodApplied: state.customMoodApplied,
            moodNote: state.moodNote,
            moodNoteMeta: state.moodNoteMeta,
          })
        );
        void persistMoodRow(activityId, { custom_label: label ?? null });
      },

      setCustomMoodApplied: (activityId, applied) => {
        set(state =>
          pruneMoodRecordMaps({
            activityMood: state.activityMood,
            activityMoodMeta: state.activityMoodMeta,
            customMoodLabel: state.customMoodLabel,
            customMoodApplied: { ...state.customMoodApplied, [activityId]: applied },
            moodNote: state.moodNote,
            moodNoteMeta: state.moodNoteMeta,
          })
        );
        void persistMoodRow(activityId, { is_custom: applied });
      },

      addCustomMoodOption: (label) =>
        set(state => {
          const value = label.trim();
          if (!value) return state;
          return { customMoodOptions: [value] };
        }),

      setMoodNote: (activityId, note, source) => {
        const meta = normalizeMoodAttachmentMeta(source);
        set(state =>
          pruneMoodRecordMaps({
            activityMood: state.activityMood,
            activityMoodMeta: state.activityMoodMeta,
            customMoodLabel: state.customMoodLabel,
            customMoodApplied: state.customMoodApplied,
            moodNote: { ...state.moodNote, [activityId]: note },
            moodNoteMeta: { ...state.moodNoteMeta, [activityId]: meta },
          })
        );
        void persistMoodRow(activityId, { note, source: meta.source });
      },

      clearAutoMoodAttachmentsByMessage: (activityId, moodMessageId) =>
        set((state) => {
          const moodMeta = state.activityMoodMeta[activityId];
          const noteMeta = state.moodNoteMeta[activityId];
          const shouldClearMood =
            moodMeta?.source === 'auto' && moodMeta.linkedMoodMessageId === moodMessageId;
          const shouldClearNote =
            noteMeta?.source === 'auto' && noteMeta.linkedMoodMessageId === moodMessageId;

          if (!shouldClearMood && !shouldClearNote) return state;

          if (shouldClearMood) void persistMoodRow(activityId, { mood_label: null });
          if (shouldClearNote)  void persistMoodRow(activityId, { note: null });

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

      fetchMoods: async () => {
        try {
          const session = await getSupabaseSession();
          if (!session) return;
          const { data, error } = await supabase
            .from('moods')
            .select('message_id, mood_label, custom_label, is_custom, note, source')
            .eq('user_id', session.user.id);
          if (error || !data) return;

          const cloudMaps = pruneMoodRecordMaps(buildMoodRecordMapsFromRows(data as MoodRowData[]));

          set(() => ({
            activityMood: cloudMaps.activityMood,
            activityMoodMeta: cloudMaps.activityMoodMeta,
            customMoodLabel: cloudMaps.customMoodLabel,
            customMoodApplied: cloudMaps.customMoodApplied,
            moodNote: cloudMaps.moodNote,
            moodNoteMeta: cloudMaps.moodNoteMeta,
          }));
        } catch (err) {
          if (import.meta.env.DEV) console.warn('[MoodStore] fetchMoods failed', err);
        }
      },
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
