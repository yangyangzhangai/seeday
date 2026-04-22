// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import { supabase } from '../../api/supabase';

export type DiaryStickerTelemetryEventName =
  | 'diary_sticker_deleted'
  | 'diary_sticker_reordered'
  | 'diary_sticker_restored'
  | 'event_condensed'
  | 'root_direction_opened'
  | 'root_direction_changed'
  | 'root_direction_reset'
  | 'root_direction_saved'
  | 'root_direction_save_failed'
  | 'todo_decompose_requested'
  | 'todo_decompose_succeeded'
  | 'todo_decompose_empty'
  | 'todo_decompose_parse_failed'
  | 'todo_decompose_failed'
  | 'todo_decompose_regenerate_clicked';

type TelemetryEventPayload = Record<string, unknown>;

function shouldSkipTelemetryEvent(): boolean {
  return Boolean(import.meta.env.VITEST);
}

export async function reportTelemetryEvent(
  eventName: DiaryStickerTelemetryEventName,
  payload: TelemetryEventPayload,
): Promise<void> {
  if (shouldSkipTelemetryEvent()) {
    return;
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return;
    }

    const { error } = await supabase.from('telemetry_events').insert({
      user_id: session.user.id,
      event_name: eventName,
      event_data: payload,
    });

    if (error && import.meta.env.DEV) {
      console.warn('[report-telemetry] telemetry_events insert failed', error);
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[report-telemetry] emit failed', error);
    }
  }
}
