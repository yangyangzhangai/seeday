// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> api/README.md

import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from './supabase-request-auth.js';

type NarrativeTelemetryEventName =
  | 'density_scored'
  | 'trigger_blocked'
  | 'event_triggered'
  | 'event_condensed';

export async function reportNarrativeTelemetry(params: {
  userId?: string;
  eventName: NarrativeTelemetryEventName;
  eventData: Record<string, unknown>;
}): Promise<void> {
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!serviceRoleKey || !params.userId || params.userId === '__anonymous__') return;

  try {
    const admin = createClient(getSupabaseUrl(), serviceRoleKey);
    await admin.from('telemetry_events').insert({
      user_id: params.userId,
      event_name: params.eventName,
      event_data: params.eventData,
    });
  } catch {
    return;
  }
}
