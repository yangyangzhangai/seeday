import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jsonError } from './http.js';
import { isLiveInputAdminUser, requireSupabaseRequestAuth } from './supabase-request-auth.js';
import type {
  ProfileSettingsTelemetryBreakdownItem,
  ProfileSettingsTelemetryDashboardResponse,
  ProfileSettingsTelemetryRecentEvent,
  ProfileSettingsTelemetrySeriesPoint,
} from '../types/profileSettingsTelemetry.js';

interface TelemetryEventRow {
  id?: unknown;
  created_at?: unknown;
  user_id?: unknown;
  event_name?: unknown;
  event_data?: unknown;
}

const ROOT_DIRECTION_EVENT_NAMES = new Set([
  'root_direction_opened',
  'root_direction_changed',
  'root_direction_reset',
  'root_direction_saved',
  'root_direction_save_failed',
]);

function parseDays(raw: unknown): number {
  const value = typeof raw === 'string' ? Number(raw) : Number(raw);
  if (!Number.isFinite(value)) return 14;
  return Math.min(Math.max(Math.round(value), 1), 90);
}

function parseOptionalString(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

function parseNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function parseEventData(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function toBreakdownItems(counts: Map<string, number>, total: number): ProfileSettingsTelemetryBreakdownItem[] {
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([key, count]) => ({
      key,
      count,
      percent: total > 0 ? count / total : 0,
    }));
}

function createSeries(days: number): ProfileSettingsTelemetrySeriesPoint[] {
  const points: ProfileSettingsTelemetrySeriesPoint[] = [];
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - offset);
    points.push({
      day: date.toISOString().slice(0, 10),
      openedCount: 0,
      changedCount: 0,
      resetCount: 0,
      savedCount: 0,
      saveFailedCount: 0,
      uniqueUsers: 0,
    });
  }

  return points;
}

export async function handleProfileSettingsTelemetryDashboard(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const auth = await requireSupabaseRequestAuth(req, res);
  if (!auth) return;

  if (!isLiveInputAdminUser(auth.user)) {
    jsonError(res, 403, 'Forbidden');
    return;
  }

  if (!auth.adminClient) {
    jsonError(res, 500, 'Missing SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const days = parseDays(req.query.days);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await auth.adminClient
    .from('telemetry_events')
    .select('id, created_at, user_id, event_name, event_data')
    .gte('created_at', since)
    .in('event_name', Array.from(ROOT_DIRECTION_EVENT_NAMES))
    .order('created_at', { ascending: false })
    .limit(10000);

  if (error) {
    jsonError(res, 500, 'Failed to load profile settings telemetry dashboard', error.message);
    return;
  }

  const series = createSeries(days);
  const seriesMap = new Map(series.map((point) => [point.day, { ...point, userIds: new Set<string>() }]));
  const uniqueUsers = new Set<string>();
  const usersWhoSaved = new Set<string>();
  const eventNames = new Map<string, number>();
  const changedSlots = new Map<string, number>();
  const savedOrders = new Map<string, number>();
  const recentEvents: ProfileSettingsTelemetryRecentEvent[] = [];

  let openedCount = 0;
  let changedCount = 0;
  let resetCount = 0;
  let savedCount = 0;
  let saveFailedCount = 0;

  for (const row of (data ?? []) as TelemetryEventRow[]) {
    const id = parseOptionalString(row.id);
    const createdAt = parseOptionalString(row.created_at);
    const userId = parseOptionalString(row.user_id);
    const eventName = parseOptionalString(row.event_name);
    if (!id || !createdAt || !userId || !eventName) continue;

    const eventData = parseEventData(row.event_data);
    const order = parseStringArray(eventData.order);
    const day = createdAt.slice(0, 10);
    const seriesEntry = seriesMap.get(day);
    if (seriesEntry) {
      seriesEntry.userIds.add(userId);
      if (eventName === 'root_direction_opened') seriesEntry.openedCount += 1;
      if (eventName === 'root_direction_changed') seriesEntry.changedCount += 1;
      if (eventName === 'root_direction_reset') seriesEntry.resetCount += 1;
      if (eventName === 'root_direction_saved') seriesEntry.savedCount += 1;
      if (eventName === 'root_direction_save_failed') seriesEntry.saveFailedCount += 1;
    }

    uniqueUsers.add(userId);
    eventNames.set(eventName, (eventNames.get(eventName) ?? 0) + 1);

    if (eventName === 'root_direction_opened') openedCount += 1;
    if (eventName === 'root_direction_changed') {
      changedCount += 1;
      const slotIndex = parseNumber(eventData.slotIndex);
      const slotKey = slotIndex === null ? 'unknown' : `slot_${slotIndex}`;
      changedSlots.set(slotKey, (changedSlots.get(slotKey) ?? 0) + 1);
    }
    if (eventName === 'root_direction_reset') resetCount += 1;
    if (eventName === 'root_direction_saved') {
      savedCount += 1;
      usersWhoSaved.add(userId);
      if (order.length > 0) {
        const orderKey = order.join(' > ');
        savedOrders.set(orderKey, (savedOrders.get(orderKey) ?? 0) + 1);
      }
    }
    if (eventName === 'root_direction_save_failed') saveFailedCount += 1;

    recentEvents.push({
      id,
      createdAt,
      userId,
      eventName,
      slotIndex: parseNumber(eventData.slotIndex),
      from: parseOptionalString(eventData.from),
      to: parseOptionalString(eventData.to),
      order,
    });
  }

  const payload: ProfileSettingsTelemetryDashboardResponse = {
    success: true,
    summary: {
      days,
      openedCount,
      changedCount,
      resetCount,
      savedCount,
      saveFailedCount,
      uniqueUsers: uniqueUsers.size,
      usersWhoSaved: usersWhoSaved.size,
      saveSuccessRate: savedCount + saveFailedCount > 0 ? savedCount / (savedCount + saveFailedCount) : 0,
      avgChangesPerSave: savedCount > 0 ? changedCount / savedCount : 0,
    },
    series: series.map((point) => {
      const current = seriesMap.get(point.day);
      return {
        day: point.day,
        openedCount: current?.openedCount ?? 0,
        changedCount: current?.changedCount ?? 0,
        resetCount: current?.resetCount ?? 0,
        savedCount: current?.savedCount ?? 0,
        saveFailedCount: current?.saveFailedCount ?? 0,
        uniqueUsers: current?.userIds.size ?? 0,
      };
    }),
    eventNames: toBreakdownItems(eventNames, openedCount + changedCount + resetCount + savedCount + saveFailedCount),
    changedSlots: toBreakdownItems(changedSlots, changedCount),
    savedOrders: toBreakdownItems(savedOrders, savedCount),
    recentEvents: recentEvents
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 50),
  };

  res.status(200).json(payload);
}
