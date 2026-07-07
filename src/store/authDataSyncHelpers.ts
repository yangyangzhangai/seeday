import { supabase } from '../api/supabase';
import { toDbMessage, toDbReport, toDbTodo } from '../lib/dbMappers';
import { isLegacyChatActivityType } from '../lib/activityType';
import { useChatStore } from './useChatStore';
import { useTodoStore } from './useTodoStore';
import { useReportStore } from './useReportStore';
import { useMoodStore } from './useMoodStore';
import { useGrowthStore } from './useGrowthStore';
import { useFocusStore } from './useFocusStore';
import { patchUserMetadata } from './authMetadataQueue';
import { formatUserFacingDiagnostic, logDiagnostic } from '../lib/diagnostics';

type AuthUserLike = { user_metadata?: Record<string, any> } | null | undefined;

async function syncLocalStep(
  params: {
    userId: string;
    table: string;
    operation: string;
    rowCount: number;
    run: () => Promise<unknown>;
  },
): Promise<string | null> {
  const { userId, table, operation, rowCount, run } = params;
  if (rowCount <= 0) {
    logDiagnostic('debug', 'auth.local_to_cloud.skipped_empty', {
      userId,
      table,
      operation,
      rowCount,
    });
    return null;
  }

  const startedAt = Date.now();
  logDiagnostic('info', 'auth.local_to_cloud.step.start', {
    userId,
    table,
    operation,
    rowCount,
  });

  try {
    await run();
    logDiagnostic('info', 'auth.local_to_cloud.step.success', {
      userId,
      table,
      operation,
      rowCount,
      elapsedMs: Date.now() - startedAt,
    });
    return null;
  } catch (error) {
    const userFacing = formatUserFacingDiagnostic(`本地数据上云 ${table}`, error, {
      path: `${table}.${operation}`,
      elapsedMs: Date.now() - startedAt,
    });
    logDiagnostic('error', 'auth.local_to_cloud.step.failed', {
      userId,
      table,
      operation,
      rowCount,
      elapsedMs: Date.now() - startedAt,
      error,
      userFacing,
    });
    return `${table}:${operation}`;
  }
}

function normalizeDailyGoalDate(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const value = raw.trim();
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const slash = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slash) {
    const [, y, m, d] = slash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

export async function syncLocalDataToSupabase(
  userId: string,
  options: {
    currentUser?: AuthUserLike;
    onUserUpdated?: (user: any) => void;
  } = {},
): Promise<void> {
  const startedAt = Date.now();
  const failures: string[] = [];
  const messages = useChatStore.getState().messages
    .filter((message) => !isLegacyChatActivityType(message.activityType));
  const moodState = useMoodStore.getState();
  const bottles = useGrowthStore.getState().bottles;
  const todos = useTodoStore.getState().todos;
  const focusSessions = useFocusStore.getState().sessions;
  const growthState = useGrowthStore.getState();

  logDiagnostic('info', 'auth.local_to_cloud.start', {
    userId,
    messages: messages.length,
    bottles: bottles.length,
    todos: todos.length,
    focusSessions: focusSessions.length,
  });

  const messageFailure = await syncLocalStep({
    userId,
    table: 'messages',
    operation: 'upsert',
    rowCount: messages.length,
    run: async () => {
      const messagesToUpload = messages.map((m) => toDbMessage(m, userId));
      const { error } = await supabase.from('messages').upsert(messagesToUpload, { onConflict: 'id' });
      if (error) throw error;
    },
  });
  if (messageFailure) failures.push(messageFailure);

  const moodIds = Array.from(
    new Set([
      ...Object.keys(moodState.activityMood),
      ...Object.keys(moodState.customMoodLabel),
      ...Object.keys(moodState.customMoodApplied),
      ...Object.keys(moodState.moodNote),
    ]),
  );

  const moodsToUpload = moodIds
    .map((messageId) => ({
      user_id: userId,
      message_id: messageId,
      mood_label: moodState.activityMood[messageId] ?? null,
      custom_label: moodState.customMoodLabel[messageId] ?? null,
      is_custom: moodState.customMoodApplied[messageId] ?? null,
      note: moodState.moodNote[messageId] ?? null,
      source: moodState.moodNoteMeta[messageId]?.source ?? moodState.activityMoodMeta[messageId]?.source ?? 'auto',
    }))
    .filter((row) =>
      row.mood_label != null
      || row.custom_label != null
      || row.is_custom != null
      || row.note != null,
    );

  const moodFailure = await syncLocalStep({
    userId,
    table: 'moods',
    operation: 'upsert',
    rowCount: moodsToUpload.length,
    run: async () => {
      const { error } = await supabase
        .from('moods')
        .upsert(moodsToUpload, { onConflict: 'user_id,message_id' });
      if (error) throw error;
    },
  });
  if (moodFailure) failures.push(moodFailure);

  const bottleFailure = await syncLocalStep({
    userId,
    table: 'bottles',
    operation: 'upsert',
    rowCount: bottles.length,
    run: async () => {
      const bottlesToUpload = bottles.map((bottle) => ({
      id: bottle.id,
      user_id: userId,
      name: bottle.name,
      type: bottle.type,
      stars: bottle.stars,
      round: bottle.round,
      status: bottle.status,
      created_at: new Date(bottle.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('bottles').upsert(bottlesToUpload, { onConflict: 'id' });
      if (error) throw error;
    },
  });
  if (bottleFailure) failures.push(bottleFailure);

  const todoFailure = await syncLocalStep({
    userId,
    table: 'todos',
    operation: 'upsert',
    rowCount: todos.length,
    run: async () => {
      const todosToUpload = todos.map((t) => toDbTodo(t, userId));
      const { error } = await supabase.from('todos').upsert(todosToUpload, { onConflict: 'id' });
      if (error) throw error;
    },
  });
  if (todoFailure) failures.push(todoFailure);

  const focusFailure = await syncLocalStep({
    userId,
    table: 'focus_sessions',
    operation: 'upsert',
    rowCount: focusSessions.length,
    run: async () => {
      const sessionsToUpload = focusSessions.map((session) => ({
      id: session.id,
      user_id: userId,
      todo_id: session.todoId || null,
      started_at: new Date(session.startedAt).toISOString(),
      ended_at: session.endedAt ? new Date(session.endedAt).toISOString() : null,
      set_duration: session.setDuration,
      actual_duration: session.actualDuration ?? null,
      }));
      const { error } = await supabase.from('focus_sessions').upsert(sessionsToUpload, { onConflict: 'id' });
      if (error) throw error;
    },
  });
  if (focusFailure) failures.push(focusFailure);

  const reports = useReportStore.getState().reports;
  const reportFailure = await syncLocalStep({
    userId,
    table: 'reports',
    operation: 'upsert',
    rowCount: reports.length,
    run: async () => {
      const reportsToUpload = reports.map((r) => toDbReport(r, userId));
      const { error } = await supabase.from('reports').upsert(reportsToUpload, { onConflict: 'id' });
      if (error) throw error;
    },
  });
  if (reportFailure) failures.push(reportFailure);

  if (growthState.dailyGoal && growthState.goalDate) {
    const currentUser = options.currentUser;
    const remoteGoalDate = normalizeDailyGoalDate(currentUser?.user_metadata?.daily_goal_date);
    const shouldSyncDailyGoal = !remoteGoalDate || growthState.goalDate >= remoteGoalDate;

    if (shouldSyncDailyGoal) {
      const dailyGoalFailure = await syncLocalStep({
        userId,
        table: 'auth_metadata.daily_goal',
        operation: 'updateUser',
        rowCount: 1,
        run: async () => {
          const { user, error } = await patchUserMetadata({
            daily_goal: growthState.dailyGoal,
            daily_goal_date: growthState.goalDate,
          });
          if (error) throw error;
          if (user) {
            options.onUserUpdated?.(user);
          }
        },
      });
      if (dailyGoalFailure) failures.push(dailyGoalFailure);
    }
  }

  logDiagnostic(failures.length > 0 ? 'warn' : 'info', 'auth.local_to_cloud.done', {
    userId,
    elapsedMs: Date.now() - startedAt,
    failures,
  });

  if (failures.length > 0) {
    throw new Error(`syncLocalDataToSupabase partial failure: ${failures.join(', ')}`);
  }
}
