// DOC-DEPS: LLM.md -> docs/DATA_STORAGE_AUDIT_REPORT.md -> src/store/README.md
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import { toDbAnnotation, toDbReport } from '../lib/dbMappers';
import { PERSIST_KEYS } from './persistKeys';
import type { AIAnnotation } from '../types/annotation';
import type { Report } from './useReportStore';

const MAX_OUTBOX_ATTEMPTS = 5;

type MoodPatch = {
  mood_label?: string | null;
  custom_label?: string | null;
  is_custom?: boolean;
  note?: string | null;
  source?: string;
};

type MoodOutboxEntry = {
  id: string;
  kind: 'mood.upsert';
  payload: { messageId: string; patch: MoodPatch };
  attempts: number;
  status: 'pending' | 'failed';
  lastError?: string;
};

type FocusOutboxEntry = {
  id: string;
  kind: 'focus.insert';
  payload: {
    id: string;
    todoId: string;
    startedAt: number;
    endedAt: number;
    setDuration: number;
    actualDuration?: number;
  };
  attempts: number;
  status: 'pending' | 'failed';
  lastError?: string;
};

type ReportOutboxEntry = {
  id: string;
  kind: 'report.upsert';
  payload: { report: Report };
  attempts: number;
  status: 'pending' | 'failed';
  lastError?: string;
};

type AnnotationOutboxEntry = {
  id: string;
  kind: 'annotation.insert';
  payload: { annotation: AIAnnotation };
  attempts: number;
  status: 'pending' | 'failed';
  lastError?: string;
};

export type OutboxEntry = MoodOutboxEntry | FocusOutboxEntry | ReportOutboxEntry | AnnotationOutboxEntry;
export type OutboxEntryInput = Omit<OutboxEntry, 'id' | 'attempts' | 'status' | 'lastError'>;

type OutboxExecutor = (entry: OutboxEntry, userId: string) => Promise<void>;

async function executeMoodEntry(entry: MoodOutboxEntry, userId: string): Promise<void> {
  const { error } = await supabase.from('moods').upsert(
    { user_id: userId, message_id: entry.payload.messageId, ...entry.payload.patch },
    { onConflict: 'user_id,message_id' },
  );
  if (error) throw new Error(error.message);
}

async function executeFocusEntry(entry: FocusOutboxEntry, userId: string): Promise<void> {
  const { error } = await supabase.from('focus_sessions').insert([{
    id: entry.payload.id,
    user_id: userId,
    todo_id: entry.payload.todoId || null,
    started_at: new Date(entry.payload.startedAt).toISOString(),
    ended_at: new Date(entry.payload.endedAt).toISOString(),
    set_duration: entry.payload.setDuration,
    actual_duration: entry.payload.actualDuration,
  }]);
  if (error) throw new Error(error.message);
}

async function executeReportEntry(entry: ReportOutboxEntry, userId: string): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .upsert([toDbReport(entry.payload.report, userId)], { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

async function executeAnnotationEntry(entry: AnnotationOutboxEntry, userId: string): Promise<void> {
  const { error } = await supabase
    .from('annotations')
    .insert([toDbAnnotation(entry.payload.annotation, userId)]);
  if (error) throw new Error(error.message);
}

const outboxExecutors: Record<OutboxEntry['kind'], OutboxExecutor> = {
  'mood.upsert': (entry, userId) => executeMoodEntry(entry as MoodOutboxEntry, userId),
  'focus.insert': (entry, userId) => executeFocusEntry(entry as FocusOutboxEntry, userId),
  'report.upsert': (entry, userId) => executeReportEntry(entry as ReportOutboxEntry, userId),
  'annotation.insert': (entry, userId) => executeAnnotationEntry(entry as AnnotationOutboxEntry, userId),
};

function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'outbox_flush_failed');
}

interface OutboxState {
  entries: OutboxEntry[];
  enqueue: (entry: OutboxEntryInput) => string;
  flush: (userId?: string) => Promise<void>;
  markFailed: (id: string, error: string, attempts?: number) => void;
  clearSucceeded: () => void;
}

export const useOutboxStore = create<OutboxState>()(
  persist(
    (set, get) => ({
      entries: [],
      enqueue: (entry) => {
        const id = uuidv4();
        set((state) => ({
          entries: [...state.entries, { ...entry, id, attempts: 0, status: 'pending' } as OutboxEntry],
        }));
        return id;
      },
      markFailed: (id, error, attempts) => {
        set((state) => ({
          entries: state.entries.map((entry) => {
            if (entry.id !== id) return entry;
            const nextAttempts = attempts ?? entry.attempts;
            return {
              ...entry,
              attempts: nextAttempts,
              status: nextAttempts >= MAX_OUTBOX_ATTEMPTS ? 'failed' : 'pending',
              lastError: error,
            };
          }),
        }));
      },
      clearSucceeded: () => {
        set((state) => ({ entries: state.entries.filter((entry) => entry.status !== 'failed' && entry.attempts > 0) }));
      },
      flush: async (userId) => {
        const resolvedUserId = userId || (await getSupabaseSession())?.user?.id;
        if (!resolvedUserId) return;

        const snapshot = get().entries.filter((entry) => entry.status === 'pending');
        if (snapshot.length === 0) return;

        for (const entry of snapshot) {
          const executor = outboxExecutors[entry.kind];
          if (!executor) {
            get().markFailed(entry.id, `Unsupported outbox kind: ${entry.kind}`, MAX_OUTBOX_ATTEMPTS);
            continue;
          }

          try {
            await executor(entry, resolvedUserId);
            set((state) => ({ entries: state.entries.filter((item) => item.id !== entry.id) }));
          } catch (error) {
            get().markFailed(entry.id, normalizeErrorMessage(error), entry.attempts + 1);
          }
        }
      },
    }),
    {
      name: PERSIST_KEYS.outbox,
      partialize: (state) => ({ entries: state.entries }),
    },
  ),
);

export function setOutboxExecutorForTests(kind: OutboxEntry['kind'], executor: OutboxExecutor): void {
  outboxExecutors[kind] = executor;
}

export function resetOutboxExecutorsForTests(): void {
  outboxExecutors['mood.upsert'] = (entry, userId) => executeMoodEntry(entry as MoodOutboxEntry, userId);
  outboxExecutors['focus.insert'] = (entry, userId) => executeFocusEntry(entry as FocusOutboxEntry, userId);
  outboxExecutors['report.upsert'] = (entry, userId) => executeReportEntry(entry as ReportOutboxEntry, userId);
  outboxExecutors['annotation.insert'] = (entry, userId) => executeAnnotationEntry(entry as AnnotationOutboxEntry, userId);
}
