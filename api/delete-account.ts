// DOC-DEPS: LLM.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import { requireSupabaseRequestAuth } from '../src/server/supabase-request-auth.js';

const USER_TABLES = [
  'messages',
  'moods',
  'todos',
  'bottles',
  'focus_sessions',
  'reports',
  'annotations',
  'stardust_memories',
  'daily_plant_records',
  'plant_direction_config',
  'user_stats',
  'live_input_events',
  'plant_asset_events',
] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);
  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const auth = await requireSupabaseRequestAuth(req, res);
  if (!auth) return;

  const { user, userClient, adminClient } = auth;

  if (!adminClient) {
    return jsonError(res, 503, 'Service unavailable');
  }

  // Delete all user data from every table
  for (const table of USER_TABLES) {
    const { error } = await userClient.from(table).delete().eq('user_id', user.id);
    if (error) {
      // non-fatal: continue deleting other tables
    }
  }

  // Delete the auth user (requires service role)
  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (authDeleteError) {
    return jsonError(res, 500, 'Failed to delete auth user');
  }

  res.status(200).json({ ok: true });
}
