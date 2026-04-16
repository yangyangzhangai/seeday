// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { User } from '@supabase/supabase-js';
import { applyCors, handlePreflight, jsonError, requireMethod } from '../src/server/http.js';
import {
  requireSupabaseRequestAuth,
  isLiveInputAdminUser,
} from '../src/server/supabase-request-auth.js';
import type {
  UserAnalyticsDashboardResponse,
  UserAnalyticsDailySeries,
  UserAnalyticsRetentionRow,
  UserAnalyticsLookupResponse,
} from '../src/types/userAnalytics.js';

// ── helpers ───────────────────────────────────────────────────────────────────

const PREMIUM_PLANS = new Set(['plus', 'premium', 'pro', 'vip']);

function isPremium(user: User): boolean {
  const am = (user.app_metadata ?? {}) as Record<string, unknown>;
  const um = (user.user_metadata ?? {}) as Record<string, unknown>;
  if (am.is_plus === true || um.is_plus === true) return true;
  if (am.vip === true || um.vip === true) return true;
  const planKeys = ['membership_plan', 'plan', 'subscription_plan'];
  for (const key of planKeys) {
    const v = String(am[key] ?? '').toLowerCase();
    const vv = String(um[key] ?? '').toLowerCase();
    if (PREMIUM_PLANS.has(v) || PREMIUM_PLANS.has(vv)) return true;
  }
  return false;
}

function getMembershipPlan(user: User): string | null {
  const am = (user.app_metadata ?? {}) as Record<string, unknown>;
  const um = (user.user_metadata ?? {}) as Record<string, unknown>;
  for (const src of [am, um]) {
    for (const key of ['membership_plan', 'plan', 'subscription_plan']) {
      const v = String(src[key] ?? '').trim();
      if (v) return v;
    }
  }
  return null;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getWeekKey(d: Date): string {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() - dow + 1); // Monday
  return day.toISOString().slice(0, 10);
}

function parseDays(raw: unknown): number {
  const v = Number(raw);
  return Number.isFinite(v) ? Math.min(Math.max(Math.round(v), 7), 90) : 30;
}

// ── fetch all users via pagination ────────────────────────────────────────────

async function fetchAllUsers(adminClient: NonNullable<Awaited<ReturnType<typeof requireSupabaseRequestAuth>>['adminClient']>): Promise<User[]> {
  const all: User[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error || !data) break;
    all.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }
  return all;
}

// ── dashboard handler ─────────────────────────────────────────────────────────

async function handleDashboard(
  req: VercelRequest,
  res: VercelResponse,
  adminClient: NonNullable<Awaited<ReturnType<typeof requireSupabaseRequestAuth>>['adminClient']>,
): Promise<void> {
  const days = parseDays(req.query.days);
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const todayKey = toDateKey(new Date());

  const users = await fetchAllUsers(adminClient);

  const premiumIds = new Set<string>();
  const newUsersByDay = new Map<string, number>();
  const newPremiumByDay = new Map<string, number>();

  for (const u of users) {
    const pm = isPremium(u);
    if (pm) premiumIds.add(u.id);
    const created = new Date(u.created_at);
    if (created.getTime() >= sinceMs) {
      const dk = toDateKey(created);
      newUsersByDay.set(dk, (newUsersByDay.get(dk) ?? 0) + 1);
      if (pm) newPremiumByDay.set(dk, (newPremiumByDay.get(dk) ?? 0) + 1);
    }
  }

  const { data: msgRows, error: msgErr } = await adminClient
    .from('messages')
    .select('user_id, timestamp')
    .gte('timestamp', sinceMs)
    .limit(200000);

  if (msgErr) {
    jsonError(res, 500, 'Failed to query messages', msgErr.message);
    return;
  }

  const dauByDay = new Map<string, Set<string>>();
  const premiumDauByDay = new Map<string, Set<string>>();

  for (const row of msgRows ?? []) {
    const ts = Number(row.timestamp);
    if (!Number.isFinite(ts)) continue;
    const dk = toDateKey(new Date(ts));
    if (!dauByDay.has(dk)) dauByDay.set(dk, new Set());
    dauByDay.get(dk)!.add(row.user_id);
    if (premiumIds.has(row.user_id)) {
      if (!premiumDauByDay.has(dk)) premiumDauByDay.set(dk, new Set());
      premiumDauByDay.get(dk)!.add(row.user_id);
    }
  }

  // Build daily series
  const dailySeries: UserAnalyticsDailySeries[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dk = toDateKey(d);
    dailySeries.push({
      day: dk,
      newUsers: newUsersByDay.get(dk) ?? 0,
      dau: dauByDay.get(dk)?.size ?? 0,
      newPremium: newPremiumByDay.get(dk) ?? 0,
      activePremium: premiumDauByDay.get(dk)?.size ?? 0,
    });
  }

  // Retention: weekly cohorts
  const cohortMap = new Map<string, string[]>();
  for (const u of users) {
    const wk = getWeekKey(new Date(u.created_at));
    if (!cohortMap.has(wk)) cohortMap.set(wk, []);
    cohortMap.get(wk)!.push(u.id);
  }

  const msgDatesByUser = new Map<string, number[]>();
  for (const row of msgRows ?? []) {
    const ts = Number(row.timestamp);
    if (!Number.isFinite(ts)) continue;
    if (!msgDatesByUser.has(row.user_id)) msgDatesByUser.set(row.user_id, []);
    msgDatesByUser.get(row.user_id)!.push(ts);
  }

  const sortedWeeks = Array.from(cohortMap.keys()).sort();
  const retention: UserAnalyticsRetentionRow[] = sortedWeeks
    .slice(-10, -1) // exclude current partial week
    .reverse()
    .map((wk) => {
      const weekStartMs = new Date(wk).getTime();
      const nextWeekStart = weekStartMs + 7 * 86400000;
      const nextWeekEnd = weekStartMs + 14 * 86400000;
      const uids = cohortMap.get(wk)!;
      const retained = uids.filter((uid) => {
        return (msgDatesByUser.get(uid) ?? []).some((ts) => ts >= nextWeekStart && ts < nextWeekEnd);
      }).length;
      return {
        cohortWeek: wk,
        cohortSize: uids.length,
        d7Retained: retained,
        d7RetentionRate: uids.length > 0 ? retained / uids.length : 0,
      };
    });

  const todayDau = dauByDay.get(todayKey)?.size ?? 0;
  const todayPremiumDau = premiumDauByDay.get(todayKey)?.size ?? 0;
  const todayNew = newUsersByDay.get(todayKey) ?? 0;
  const todayNewPremium = newPremiumByDay.get(todayKey) ?? 0;

  const body: UserAnalyticsDashboardResponse = {
    overview: {
      totalUsers: users.length,
      totalPremium: premiumIds.size,
      conversionRate: users.length > 0 ? premiumIds.size / users.length : 0,
      activeToday: todayDau,
      activePremiumToday: todayPremiumDau,
      newToday: todayNew,
      newPremiumToday: todayNewPremium,
    },
    dailySeries,
    retention,
    generatedAt: new Date().toISOString(),
  };

  res.status(200).json(body);
}

// ── user lookup handler ───────────────────────────────────────────────────────

async function handleUserLookup(
  req: VercelRequest,
  res: VercelResponse,
  adminClient: NonNullable<Awaited<ReturnType<typeof requireSupabaseRequestAuth>>['adminClient']>,
): Promise<void> {
  const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
  if (!query) {
    jsonError(res, 400, 'Missing query param');
    return;
  }

  const users = await fetchAllUsers(adminClient);
  const lq = query.toLowerCase();
  const found = users.find((u) => u.email?.toLowerCase() === lq || u.id === query);

  if (!found) {
    res.status(200).json({ found: false, user: null } satisfies UserAnalyticsLookupResponse);
    return;
  }

  const [msgResult, focusResult, statsResult] = await Promise.all([
    adminClient.from('messages').select('timestamp', { count: 'exact', head: false })
      .eq('user_id', found.id).order('timestamp', { ascending: false }).limit(1),
    adminClient.from('focus_sessions').select('id', { count: 'exact', head: true })
      .eq('user_id', found.id),
    adminClient.from('user_stats').select('login_streak').eq('user_id', found.id).maybeSingle(),
  ]);

  const lastMsg = (msgResult.data ?? [])[0];
  const lastMsgTs = lastMsg ? Number(lastMsg.timestamp) : null;

  const body: UserAnalyticsLookupResponse = {
    found: true,
    user: {
      id: found.id,
      email: found.email ?? '',
      createdAt: found.created_at,
      isPremium: isPremium(found),
      membershipPlan: getMembershipPlan(found),
      totalMessages: msgResult.count ?? 0,
      totalFocusSessions: focusResult.count ?? 0,
      loginStreak: (statsResult.data as { login_streak?: number } | null)?.login_streak ?? null,
      lastMessageAt: lastMsgTs && Number.isFinite(lastMsgTs) ? new Date(lastMsgTs).toISOString() : null,
    },
  };

  res.status(200).json(body);
}

// ── main handler ──────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  applyCors(res, ['GET']);
  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'GET')) return;

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

  if (req.query.type === 'user_lookup') {
    await handleUserLookup(req, res, auth.adminClient);
  } else {
    await handleDashboard(req, res, auth.adminClient);
  }
}
