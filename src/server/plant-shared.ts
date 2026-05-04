// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/Seeday_植物生长_技术实现文档_v1.7.docx
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { DailyPlantRecord, RootMetrics, RootType } from '../types/plant.js';
import { jsonError } from './http.js';
import { getSupabaseAnonKey, getSupabaseUrl } from './supabase-request-auth.js';

const ROOT_TYPES: RootType[] = ['tap', 'fib', 'sha', 'bra', 'bul'];

function getBearerToken(req: VercelRequest): string | null {
  const raw = req.headers.authorization;
  if (!raw) return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function buildAuthedClient(url: string, key: string, token?: string): SupabaseClient {
  return createClient(url, key, {
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
  });
}

export async function requirePlantAuth(req: VercelRequest, res: VercelResponse): Promise<{
  user: User;
  db: SupabaseClient;
} | null> {
  const token = getBearerToken(req);
  if (!token) {
    jsonError(res, 401, 'Unauthorized');
    return null;
  }

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const authClient = buildAuthedClient(url, anonKey, token);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    jsonError(res, 401, 'Unauthorized');
    return null;
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db = serviceRole
    ? createClient(url, serviceRole)
    : buildAuthedClient(url, anonKey, token);

  return { user: data.user, db };
}

function toParts(date: Date, timezone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return formatter
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});
}

function getTimeZoneOffsetMs(ts: number, timezone: string): number {
  const parts = toParts(new Date(ts), timezone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - ts;
}

function parseYmd(date: string): { year: number; month: number; day: number } | null {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function zonedMidnightMs(date: string, timezone: string): number {
  const ymd = parseYmd(date);
  if (!ymd) {
    return new Date(`${date}T00:00:00`).getTime();
  }

  let utcGuess = Date.UTC(ymd.year, ymd.month - 1, ymd.day, 0, 0, 0);
  for (let i = 0; i < 3; i += 1) {
    utcGuess = Date.UTC(ymd.year, ymd.month - 1, ymd.day, 0, 0, 0) - getTimeZoneOffsetMs(utcGuess, timezone);
  }
  return utcGuess;
}

export function resolveDayWindow(
  date: string,
  timezone: string,
  dayStartMs?: number,
  dayEndMs?: number,
): { startMs: number; endMs: number } {
  if (Number.isFinite(dayStartMs) && Number.isFinite(dayEndMs) && dayStartMs! < dayEndMs!) {
    return { startMs: Number(dayStartMs), endMs: Number(dayEndMs) };
  }
  const startMs = zonedMidnightMs(date, timezone);
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return { startMs, endMs };
}

export function getDateInTimezone(timezone: string, now: Date = new Date()): string {
  const parts = toParts(now, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isTooEarlyToGenerate(date: string, timezone: string, now: Date = new Date()): boolean {
  const today = getDateInTimezone(timezone, now);
  if (date !== today) return false;
  const hour = Number(toParts(now, timezone).hour);
  return hour < 20;
}

export function resolvePlantId(params: {
  rootType: RootType;
  stage: 'early' | 'late';
  date: string;
  isSupportVariant: boolean;
  isAirDay: boolean;
}): string {
  if (params.isAirDay) {
    return 'air_0001';
  }

  const hash = params.date
    .split('')
    .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 999, 0);
  const suffix = String((hash % 3) + 1).padStart(3, '0');
  if (params.isSupportVariant) {
    return `${params.rootType}_${params.stage}_sup_${suffix}`;
  }
  return `${params.rootType}_${params.stage}_${suffix}`;
}

export function toRootMetricsJson(metrics: RootMetrics): Record<string, unknown> {
  return {
    dominant_ratio: metrics.dominantRatio,
    top2_gap: metrics.top2Gap,
    depth_score: metrics.depthScore,
    evenness: metrics.evenness,
    branchiness: metrics.branchiness,
    total_minutes: metrics.totalMinutes,
    active_target_directions: metrics.activeTargetDirections,
    direction_breakdown: metrics.directionBreakdown,
  };
}

export function serializePlantRecord(row: Record<string, any>): DailyPlantRecord {
  const rootMetrics = (row.root_metrics ?? {}) as Record<string, any>;
  const rootType = ROOT_TYPES.includes(row.root_type) ? row.root_type : 'tap';
  return {
    id: String(row.id),
    userId: String(row.user_id),
    date: String(row.date),
    timezone: String(row.timezone),
    rootMetrics: {
      dominantRatio: Number(rootMetrics.dominant_ratio ?? 0),
      top2Gap: Number(rootMetrics.top2_gap ?? 0),
      depthScore: Number(rootMetrics.depth_score ?? 0),
      evenness: Number(rootMetrics.evenness ?? 0),
      branchiness: Number(rootMetrics.branchiness ?? 0),
      totalMinutes: Number(rootMetrics.total_minutes ?? 0),
      activeTargetDirections: Number(rootMetrics.active_target_directions ?? 0),
      directionBreakdown: (rootMetrics.direction_breakdown ?? {}) as RootMetrics['directionBreakdown'],
    },
    rootType,
    plantId: String(row.plant_id),
    plantStage: row.plant_stage === 'late' ? 'late' : 'early',
    isSpecial: Boolean(row.is_special),
    isSupportVariant: Boolean(row.is_support_variant),
    diaryText: row.diary_text ?? undefined,
    generatedAt: row.generated_at ? new Date(row.generated_at).getTime() : Date.now(),
    cycleId: row.cycle_id ?? null,
  };
}
