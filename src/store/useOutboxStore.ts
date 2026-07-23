// DOC-DEPS: LLM.md -> docs/DATA_STORAGE_AUDIT_REPORT.md -> src/store/README.md
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import { toDbAnnotation, toDbReport } from '../lib/dbMappers';
import { PERSIST_KEYS } from './persistKeys';
import type { AIAnnotation } from '../types/annotation';
import type { PlantCategoryKey } from '../types/plant';
import type { Message } from './useChatStore.types';
import type { Report } from './useReportStore';
import type { ReminderResponseDraft } from '../services/reminder/reminderResponse';
import { upsertReminderResponse } from '../api/reminderResponses';
import { createScopedJSONStorage } from './scopedPersistStorage';
import { isMultiAccountIsolationV2Enabled, readActiveStorageScope } from './storageScope';
import { formatUserFacingDiagnostic, logDiagnostic } from '../lib/diagnostics';
import { resolveChatImageStoragePath } from '../lib/chatImageStorage';
import {
  collectUniqueMessages,
  fetchExistingCloudMessageIds,
  partitionMoodParentIds,
} from './moodRelationshipHelpers';

const MAX_CONSECUTIVE_FAILURES = 3;
const OUTBOX_COOLDOWN_MS = 60 * 60 * 1000;
const MAX_OUTBOX_ATTEMPTS = 15;

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
  consecutiveFailures: number;
  status: 'pending' | 'cooldown' | 'failed';
  nextRetryAt?: number;
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
  consecutiveFailures: number;
  status: 'pending' | 'cooldown' | 'failed';
  nextRetryAt?: number;
  lastError?: string;
};

type ReportOutboxEntry = {
  id: string;
  kind: 'report.upsert';
  payload: { report: Report };
  attempts: number;
  consecutiveFailures: number;
  status: 'pending' | 'cooldown' | 'failed';
  nextRetryAt?: number;
  lastError?: string;
};

type AnnotationOutboxEntry = {
  id: string;
  kind: 'annotation.insert';
  payload: { annotation: AIAnnotation };
  attempts: number;
  consecutiveFailures: number;
  status: 'pending' | 'cooldown' | 'failed';
  nextRetryAt?: number;
  lastError?: string;
};

type AnnotationOutcomeOutboxEntry = {
  id: string;
  kind: 'annotation.outcome';
  payload: { annotationId: string; accepted: boolean };
  attempts: number;
  consecutiveFailures: number;
  status: 'pending' | 'cooldown' | 'failed';
  nextRetryAt?: number;
  lastError?: string;
};

type ChatOutboxEntry = {
  id: string;
  kind: 'chat.upsert';
  payload: { message: Message };
  attempts: number;
  consecutiveFailures: number;
  status: 'pending' | 'cooldown' | 'failed';
  nextRetryAt?: number;
  lastError?: string;
};

type TodoDeleteOutboxEntry = {
  id: string;
  kind: 'todo.delete';
  payload: { todoId: string };
  attempts: number;
  consecutiveFailures: number;
  status: 'pending' | 'cooldown' | 'failed';
  nextRetryAt?: number;
  lastError?: string;
};

type PlantDirectionOutboxEntry = {
  id: string;
  kind: 'plant.directionOrder';
  payload: { order: PlantCategoryKey[] };
  attempts: number;
  consecutiveFailures: number;
  status: 'pending' | 'cooldown' | 'failed';
  nextRetryAt?: number;
  lastError?: string;
};

type ImageReuploadOutboxEntry = {
  id: string;
  kind: 'image.reupload';
  payload: { messageId: string; slot: 'imageUrl' | 'imageUrl2' };
  attempts: number;
  consecutiveFailures: number;
  status: 'pending' | 'cooldown' | 'failed';
  nextRetryAt?: number;
  lastError?: string;
};

type PreferenceUpsertOutboxEntry = {
  id: string;
  kind: 'preference.upsert';
  payload: {
    ai_mode: string;
    ai_mode_enabled: boolean;
    daily_goal_enabled: boolean;
    annotation_drop_rate: string;
  };
  attempts: number;
  consecutiveFailures: number;
  status: 'pending' | 'cooldown' | 'failed';
  nextRetryAt?: number;
  lastError?: string;
};

type ReminderResponseOutboxEntry = {
  id: string;
  kind: 'reminder.response';
  payload: { response: ReminderResponseDraft };
  attempts: number;
  consecutiveFailures: number;
  status: 'pending' | 'cooldown' | 'failed';
  nextRetryAt?: number;
  lastError?: string;
};

export type OutboxEntry = MoodOutboxEntry | FocusOutboxEntry | ReportOutboxEntry | AnnotationOutboxEntry | AnnotationOutcomeOutboxEntry | ChatOutboxEntry | TodoDeleteOutboxEntry | PlantDirectionOutboxEntry | ImageReuploadOutboxEntry | PreferenceUpsertOutboxEntry | ReminderResponseOutboxEntry;
export type OutboxEntryInput = Omit<OutboxEntry, 'id' | 'attempts' | 'status' | 'lastError'>;

type OutboxExecutor = (entry: OutboxEntry, userId: string) => Promise<void>;

async function executeMoodEntry(entry: MoodOutboxEntry, userId: string): Promise<void> {
  const { error } = await supabase.from('moods').upsert(
    { user_id: userId, message_id: entry.payload.messageId, ...entry.payload.patch },
    { onConflict: 'user_id,message_id' },
  );
  if (error) throw error;
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
  if (error) throw error;
}

async function executeReportEntry(entry: ReportOutboxEntry, userId: string): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .upsert([toDbReport(entry.payload.report, userId)], { onConflict: 'id' });
  if (error) throw error;
}

async function executeAnnotationEntry(entry: AnnotationOutboxEntry, userId: string): Promise<void> {
  const { error } = await supabase
    .from('annotations')
    .upsert([toDbAnnotation(entry.payload.annotation, userId)], { onConflict: 'id' });
  if (error) throw error;
}

async function executeAnnotationOutcomeEntry(entry: AnnotationOutcomeOutboxEntry, userId: string): Promise<void> {
  const { error } = await supabase
    .from('annotations')
    .update({ suggestion_accepted: entry.payload.accepted })
    .eq('id', entry.payload.annotationId)
    .eq('user_id', userId);
  if (error) throw error;
}

async function executeChatEntry(entry: ChatOutboxEntry, userId: string): Promise<void> {
  const { toDbMessage } = await import('../lib/dbMappers');
  const { error } = await supabase
    .from('messages')
    .upsert([toDbMessage(entry.payload.message, userId)], { onConflict: 'id' });
  if (error) throw error;
}

async function executeTodoDeleteEntry(entry: TodoDeleteOutboxEntry, userId: string): Promise<void> {
  const deletedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('todos')
    .update({ deleted_at: deletedAt, updated_at: deletedAt })
    .eq('id', entry.payload.todoId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) {
    throw new Error(`Todo delete matched 0 rows: ${entry.payload.todoId}`);
  }

  const { useTodoStore } = await import('./useTodoStore');
  useTodoStore.setState((state) => {
    if (!(entry.payload.todoId in state.pendingDeletedTodoIds)) return state;
    const nextPending = { ...state.pendingDeletedTodoIds };
    delete nextPending[entry.payload.todoId];
    return { pendingDeletedTodoIds: nextPending };
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function executeImageReuploadEntry(entry: ImageReuploadOutboxEntry, userId: string): Promise<void> {
  const { useChatStore } = await import('./useChatStore');
  const message = useChatStore.getState().messages.find(m => m.id === entry.payload.messageId);
  const dataUrl = entry.payload.slot === 'imageUrl' ? message?.imageUrl : message?.imageUrl2;
  if (!dataUrl?.startsWith('data:')) return; // already uploaded or evicted
  const blob = dataUrlToBlob(dataUrl);
  const path = `${userId}/${resolveChatImageStoragePath(entry.payload.messageId, entry.payload.slot)}`;
  const { error } = await supabase.storage
    .from('seeday-images')
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;
  const { data } = supabase.storage.from('seeday-images').getPublicUrl(path);
  if (!data.publicUrl) throw new Error('no public URL');
  await useChatStore.getState().updateMessageImage(entry.payload.messageId, entry.payload.slot, data.publicUrl);
}

async function executePreferenceUpsertEntry(entry: PreferenceUpsertOutboxEntry, _userId: string): Promise<void> {
  const { patchUserMetadata } = await import('./authMetadataQueue');
  const { error } = await patchUserMetadata(entry.payload);
  if (error) throw error;
}

async function executePlantDirectionEntry(entry: PlantDirectionOutboxEntry, userId: string): Promise<void> {
  const { error: deleteError } = await supabase
    .from('plant_direction_config')
    .delete()
    .eq('user_id', userId);
  if (deleteError) throw deleteError;

  const payload = entry.payload.order.map((categoryKey, index) => ({
    user_id: userId,
    direction_index: index,
    category_key: categoryKey,
  }));

  const { error: insertError } = await supabase
    .from('plant_direction_config')
    .insert(payload);
  if (insertError) throw insertError;
}

async function executeReminderResponseEntry(
  entry: ReminderResponseOutboxEntry,
  userId: string,
): Promise<void> {
  await upsertReminderResponse(userId, entry.payload.response);
}

async function updateChatMessageSyncStatus(entry: ChatOutboxEntry, status: 'pending' | 'failed' | 'synced', error?: string): Promise<void> {
  const [{ useChatStore }, { applyChatMessageSyncState }] = await Promise.all([
    import('./useChatStore'),
    import('./chatSyncHelpers'),
  ]);
  useChatStore.setState((state) => applyChatMessageSyncState(
    state as import('./useChatStore.types').ChatState,
    entry.payload.message.id,
    status,
    error ?? null,
  ));
}

const outboxExecutors: Record<OutboxEntry['kind'], OutboxExecutor> = {
  'mood.upsert': (entry, userId) => executeMoodEntry(entry as MoodOutboxEntry, userId),
  'focus.insert': (entry, userId) => executeFocusEntry(entry as FocusOutboxEntry, userId),
  'report.upsert': (entry, userId) => executeReportEntry(entry as ReportOutboxEntry, userId),
  'annotation.insert': (entry, userId) => executeAnnotationEntry(entry as AnnotationOutboxEntry, userId),
  'annotation.outcome': (entry, userId) => executeAnnotationOutcomeEntry(entry as AnnotationOutcomeOutboxEntry, userId),
  'chat.upsert': (entry, userId) => executeChatEntry(entry as ChatOutboxEntry, userId),
  'todo.delete': (entry, userId) => executeTodoDeleteEntry(entry as TodoDeleteOutboxEntry, userId),
  'plant.directionOrder': (entry, userId) => executePlantDirectionEntry(entry as PlantDirectionOutboxEntry, userId),
  'image.reupload': (entry, userId) => executeImageReuploadEntry(entry as ImageReuploadOutboxEntry, userId),
  'preference.upsert': (entry, userId) => executePreferenceUpsertEntry(entry as PreferenceUpsertOutboxEntry, userId),
  'reminder.response': (entry, userId) => executeReminderResponseEntry(entry as ReminderResponseOutboxEntry, userId),
};

function normalizeErrorMessage(error: unknown): string {
  return formatUserFacingDiagnostic('云端同步队列', error, {
    path: 'outbox.flush',
  });
}

function describeOutboxEntry(entry: OutboxEntry): Record<string, unknown> {
  const base = {
    entryId: entry.id,
    kind: entry.kind,
    attempts: entry.attempts,
    consecutiveFailures: entry.consecutiveFailures,
    status: entry.status,
    nextRetryAt: entry.nextRetryAt ? new Date(entry.nextRetryAt).toISOString() : null,
    lastError: entry.lastError ?? null,
  };
  if (entry.kind === 'chat.upsert') {
    return { ...base, table: 'messages', operation: 'upsert', messageId: entry.payload.message.id };
  }
  if (entry.kind === 'mood.upsert') {
    return { ...base, table: 'moods', operation: 'upsert', messageId: entry.payload.messageId };
  }
  if (entry.kind === 'focus.insert') {
    return { ...base, table: 'focus_sessions', operation: 'insert', focusSessionId: entry.payload.id };
  }
  if (entry.kind === 'report.upsert') {
    return { ...base, table: 'reports', operation: 'upsert', reportId: entry.payload.report.id };
  }
  if (entry.kind === 'annotation.insert' || entry.kind === 'annotation.outcome') {
    return { ...base, table: 'annotations', operation: entry.kind === 'annotation.insert' ? 'upsert' : 'update' };
  }
  if (entry.kind === 'todo.delete') {
    return { ...base, table: 'todos', operation: 'soft_delete', todoId: entry.payload.todoId };
  }
  if (entry.kind === 'plant.directionOrder') {
    return { ...base, table: 'plant_direction_config', operation: 'replace' };
  }
  if (entry.kind === 'image.reupload') {
    return { ...base, bucket: 'seeday-images', operation: 'upload', messageId: entry.payload.messageId, slot: entry.payload.slot };
  }
  if (entry.kind === 'reminder.response') {
    return {
      ...base,
      table: 'reminder_responses',
      operation: 'upsert',
      occurrenceKey: entry.payload.response.occurrenceKey,
    };
  }
  return { ...base, operation: 'metadata.update' };
}

interface OutboxState {
  entries: OutboxEntry[];
  enqueue: (entry: OutboxEntryInput) => string;
  discardMoodEntries: (messageIds: string[]) => void;
  flush: (userId?: string) => Promise<void>;
  retryNow: (userId?: string) => Promise<void>;
  markFailed: (id: string, error: string, attempts?: number) => void;
  clearSucceeded: () => void;
}

async function discardVerifiedOrphanMoodEntries(userId: string): Promise<void> {
  const entries = useOutboxStore.getState().entries;
  const moodIds = entries
    .filter((entry): entry is MoodOutboxEntry => entry.kind === 'mood.upsert')
    .map((entry) => entry.payload.messageId);
  if (moodIds.length === 0) return;

  const { useChatStore } = await import('./useChatStore');
  const chatState = useChatStore.getState();
  const localIds = new Set(collectUniqueMessages(chatState.messages, chatState.dateCache).map((message) => message.id));
  entries
    .filter((entry): entry is ChatOutboxEntry => entry.kind === 'chat.upsert')
    .forEach((entry) => localIds.add(entry.payload.message.id));

  const cloudResult = await fetchExistingCloudMessageIds(userId, moodIds);
  const { orphanIds } = partitionMoodParentIds(moodIds, localIds, cloudResult);
  if (orphanIds.size === 0) return;

  const orphanMessageIds = Array.from(orphanIds);
  const { useMoodStore } = await import('./useMoodStore');
  useMoodStore.getState().removeMoodRecords(orphanMessageIds);
  useOutboxStore.getState().discardMoodEntries(orphanMessageIds);
  logDiagnostic('warn', 'outbox.mood_orphans.discarded', { userId, messageIds: orphanMessageIds });
}

export const useOutboxStore = create<OutboxState>()(
  persist(
    (set, get) => ({
      entries: [],
      enqueue: (entry) => {
        const id = uuidv4();
        set((state) => ({
          entries: [
            ...(
              entry.kind === 'preference.upsert'
                ? state.entries.filter((item) => item.kind !== 'preference.upsert')
                : entry.kind === 'reminder.response'
                  ? state.entries.filter((item) => (
                    item.kind !== 'reminder.response'
                    || item.payload.response.occurrenceKey !== entry.payload.response.occurrenceKey
                  ))
                : state.entries
            ),
            {
              ...entry,
              id,
              attempts: 0,
              consecutiveFailures: 0,
              status: 'pending',
              nextRetryAt: undefined,
            } as OutboxEntry,
          ],
        }));
        logDiagnostic('warn', 'outbox.enqueue', {
          entry: describeOutboxEntry({
            ...entry,
            id,
            attempts: 0,
            consecutiveFailures: entry.consecutiveFailures ?? 0,
            status: 'pending',
          } as OutboxEntry),
        });
        return id;
      },
      discardMoodEntries: (messageIds) => {
        const ids = new Set(messageIds);
        set((state) => ({
          entries: state.entries.filter((entry) => (
            entry.kind !== 'mood.upsert' || !ids.has(entry.payload.messageId)
          )),
        }));
      },
      markFailed: (id, error, attempts) => {
        set((state) => ({
          entries: state.entries.map((entry) => {
            if (entry.id !== id) return entry;
            const nextAttempts = attempts ?? entry.attempts;
            const nextConsecutiveFailures = (entry.consecutiveFailures ?? 0) + 1;
            const isHardFailed = nextAttempts >= MAX_OUTBOX_ATTEMPTS;
            const isCoolingDown = !isHardFailed && nextConsecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
            return {
              ...entry,
              attempts: nextAttempts,
              consecutiveFailures: isCoolingDown ? 0 : nextConsecutiveFailures,
              status: isHardFailed ? 'failed' : (isCoolingDown ? 'cooldown' : 'pending'),
              nextRetryAt: isCoolingDown ? Date.now() + OUTBOX_COOLDOWN_MS : undefined,
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
        if (isMultiAccountIsolationV2Enabled()) {
          const activeScope = readActiveStorageScope();
          if (activeScope.type !== 'user' || activeScope.userId !== resolvedUserId) {
            logDiagnostic('warn', 'outbox.flush.skipped_scope_mismatch', {
              requestedUserId: resolvedUserId,
              activeScope,
            });
            return;
          }
        }

        await discardVerifiedOrphanMoodEntries(resolvedUserId);
        const now = Date.now();
        const snapshot = get().entries.filter((entry) => (
          entry.status === 'pending'
          || (entry.status === 'cooldown' && (entry.nextRetryAt ?? 0) <= now)
        ));
        if (snapshot.length === 0) return;

        const flushStartedAt = Date.now();
        logDiagnostic('info', 'outbox.flush.start', {
          userId: resolvedUserId,
          entryCount: snapshot.length,
          entries: snapshot.map(describeOutboxEntry),
        });

        for (const entry of snapshot) {
          const executor = outboxExecutors[entry.kind];
            if (!executor) {
              get().markFailed(entry.id, `Unsupported outbox kind: ${entry.kind}`, MAX_OUTBOX_ATTEMPTS);
              logDiagnostic('error', 'outbox.entry.unsupported', {
                entry: describeOutboxEntry(entry),
              });
              continue;
            }

            try {
            const entryStartedAt = Date.now();
            if (entry.status === 'cooldown') {
              set((state) => ({
                entries: state.entries.map((item) => (
                  item.id === entry.id
                    ? { ...item, status: 'pending', nextRetryAt: undefined }
                    : item
                )),
              }));
            }
            await executor(entry, resolvedUserId);
            logDiagnostic('info', 'outbox.entry.success', {
              elapsedMs: Date.now() - entryStartedAt,
              entry: describeOutboxEntry(entry),
            });
            if (entry.kind === 'chat.upsert') {
              await updateChatMessageSyncStatus(entry as ChatOutboxEntry, 'synced');
            }
            set((state) => ({ entries: state.entries.filter((item) => item.id !== entry.id) }));
          } catch (error) {
            const nextAttempts = entry.attempts + 1;
            const nextError = normalizeErrorMessage(error);
            get().markFailed(entry.id, nextError, nextAttempts);
            logDiagnostic('error', 'outbox.entry.failed', {
              nextAttempts,
              userId: resolvedUserId,
              entry: describeOutboxEntry(entry),
              error,
              userFacing: nextError,
            });
            if (entry.kind === 'chat.upsert') {
              await updateChatMessageSyncStatus(
                entry as ChatOutboxEntry,
                nextAttempts >= MAX_OUTBOX_ATTEMPTS ? 'failed' : 'pending',
                nextError,
              );
            }
          }
        }
        logDiagnostic('info', 'outbox.flush.done', {
          elapsedMs: Date.now() - flushStartedAt,
          userId: resolvedUserId,
          entryCount: snapshot.length,
        });
      },
      retryNow: async (userId) => {
        logDiagnostic('info', 'outbox.retry_now.clicked', {
          userId: userId ?? null,
          entries: get().entries.map(describeOutboxEntry),
        });
        set((state) => ({
          entries: state.entries.map((entry) => (
            entry.status === 'failed' || entry.status === 'cooldown'
              ? {
                  ...entry,
                  status: 'pending',
                  consecutiveFailures: 0,
                  nextRetryAt: undefined,
                }
              : entry
          )),
        }));
        await get().flush(userId);
      },
    }),
    {
      name: PERSIST_KEYS.outbox,
      storage: createScopedJSONStorage<Pick<OutboxState, 'entries'>>('outbox'),
      skipHydration: true,
      partialize: (state) => ({ entries: state.entries }),
    },
  ),
);

export function getOutboxRetryableCount(entries: OutboxEntry[]): number {
  return entries.filter((entry) => entry.status === 'failed' || entry.status === 'cooldown').length;
}

export function getOutboxRetrySummary(entries: OutboxEntry[]): {
  count: number;
  title: string;
  latest: OutboxEntry | null;
} {
  const retryable = entries.filter((entry) => entry.status === 'failed' || entry.status === 'cooldown');
  const latest = retryable[retryable.length - 1] ?? null;
  if (!latest) {
    return { count: 0, title: '', latest: null };
  }
  const nextRetry = latest.nextRetryAt ? new Date(latest.nextRetryAt).toLocaleString() : 'manual';
  return {
    count: retryable.length,
    latest,
    title: [
      `云端同步失败：${latest.kind}`,
      `状态：${latest.status}`,
      `尝试次数：${latest.attempts}`,
      `下次重试：${nextRetry}`,
      latest.lastError ? `最后错误：${latest.lastError}` : null,
    ].filter(Boolean).join('\n'),
  };
}

export function setOutboxExecutorForTests(kind: OutboxEntry['kind'], executor: OutboxExecutor): void {
  outboxExecutors[kind] = executor;
}

export function resetOutboxExecutorsForTests(): void {
  outboxExecutors['mood.upsert'] = (entry, userId) => executeMoodEntry(entry as MoodOutboxEntry, userId);
  outboxExecutors['focus.insert'] = (entry, userId) => executeFocusEntry(entry as FocusOutboxEntry, userId);
  outboxExecutors['report.upsert'] = (entry, userId) => executeReportEntry(entry as ReportOutboxEntry, userId);
  outboxExecutors['annotation.insert'] = (entry, userId) => executeAnnotationEntry(entry as AnnotationOutboxEntry, userId);
  outboxExecutors['annotation.outcome'] = (entry, userId) => executeAnnotationOutcomeEntry(entry as AnnotationOutcomeOutboxEntry, userId);
  outboxExecutors['chat.upsert'] = (entry, userId) => executeChatEntry(entry as ChatOutboxEntry, userId);
  outboxExecutors['todo.delete'] = (entry, userId) => executeTodoDeleteEntry(entry as TodoDeleteOutboxEntry, userId);
  outboxExecutors['plant.directionOrder'] = (entry, userId) => executePlantDirectionEntry(entry as PlantDirectionOutboxEntry, userId);
  outboxExecutors['image.reupload'] = (entry, userId) => executeImageReuploadEntry(entry as ImageReuploadOutboxEntry, userId);
  outboxExecutors['preference.upsert'] = (entry, userId) => executePreferenceUpsertEntry(entry as PreferenceUpsertOutboxEntry, userId);
  outboxExecutors['reminder.response'] = (entry, userId) => executeReminderResponseEntry(entry as ReminderResponseOutboxEntry, userId);
}
