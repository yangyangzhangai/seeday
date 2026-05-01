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

type AuthUserLike = { user_metadata?: Record<string, any> } | null | undefined;

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
  const messages = useChatStore.getState().messages
    .filter((message) => !isLegacyChatActivityType(message.activityType));
  const moodState = useMoodStore.getState();
  const bottles = useGrowthStore.getState().bottles;
  const todos = useTodoStore.getState().todos;
  const focusSessions = useFocusStore.getState().sessions;
  const growthState = useGrowthStore.getState();

  if (messages.length > 0) {
    const messagesToUpload = messages.map((m) => toDbMessage(m, userId));
    const { error } = await supabase.from('messages').upsert(messagesToUpload, { onConflict: 'id' });
    if (error) {
      if (import.meta.env.DEV) {
        console.error('Error syncing messages:', error);
      }
    }
  }

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

  if (moodsToUpload.length > 0) {
    const { error } = await supabase
      .from('moods')
      .upsert(moodsToUpload, { onConflict: 'user_id,message_id' });

    if (error) {
      if (import.meta.env.DEV) {
        console.error('Error syncing moods:', error);
      }
    }
  }

  if (bottles.length > 0) {
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
    if (error) {
      if (import.meta.env.DEV) {
        console.error('Error syncing bottles:', error);
      }
    }
  }

  if (todos.length > 0) {
    const todosToUpload = todos.map((t) => toDbTodo(t, userId));

    const { error } = await supabase.from('todos').upsert(todosToUpload, { onConflict: 'id' });
    if (error) {
      if (import.meta.env.DEV) {
        console.error('Error syncing todos:', error);
      }
    }
  }

  if (focusSessions.length > 0) {
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
    if (error) {
      if (import.meta.env.DEV) {
        console.error('Error syncing focus sessions:', error);
      }
    }
  }

  const reports = useReportStore.getState().reports;
  if (reports.length > 0) {
    const reportsToUpload = reports.map((r) => toDbReport(r, userId));

    const { error } = await supabase.from('reports').upsert(reportsToUpload, { onConflict: 'id' });
    if (error) {
      if (import.meta.env.DEV) {
        console.error('Error syncing reports:', error);
      }
    }
  }

  if (growthState.dailyGoal && growthState.goalDate) {
    const currentUser = options.currentUser;
    const remoteGoalDate = normalizeDailyGoalDate(currentUser?.user_metadata?.daily_goal_date);
    const shouldSyncDailyGoal = !remoteGoalDate || growthState.goalDate >= remoteGoalDate;

    if (shouldSyncDailyGoal) {
      const { user, error } = await patchUserMetadata({
        daily_goal: growthState.dailyGoal,
        daily_goal_date: growthState.goalDate,
      });

      if (error) {
        if (import.meta.env.DEV) {
          console.error('Error syncing daily goal metadata:', error);
        }
      } else if (user) {
        options.onUserUpdated?.(user);
      }
    }
  }
}
