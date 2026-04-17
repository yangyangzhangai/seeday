// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { User } from '@supabase/supabase-js';
import { jsonError } from './http.js';
import {
  isLiveInputAdminUser,
  requireSupabaseRequestAuth,
} from './supabase-request-auth.js';
import type {
  UserAnalyticsDashboardResponse,
  UserAnalyticsDailySeries,
  UserAnalyticsLookupResponse,
  UserAnalyticsRetentionRow,
} from '../types/userAnalytics.js';

const PREMIUM_PLANS = new Set(['plus', 'premium', 'pro', 'vip']);

function isPremium(user: User): boolean {
  const am = (user.app_metadata ?? {}) as Record<string, unknown>;
  const um = (user.user_metadata ?? {}) as Record<string, unknown>;
  if (am.is_plus === true || um.is_plus === true) return true;
  if (am.vip === true || um.vip === true) return true;
  const planKeys = ['membership_plan', 'plan', 'subscription_plan'];
  for (const key of planKeys) {
    const amPlan = String(am[key] ?? '').toLowerCase();
    const umPlan = String(um[key] ?? '').toLowerCase();
    if (PREMIUM_PLANS.has(amPlan) || PREMIUM_PLANS.has(umPlan)) return true;
  }
  return false;
}

function getMembershipPlan(user: User): string | null {
  const am = (user.app_metadata ?? {}) as Record<string, unknown>;
  const um = (user.user_metadata ?? {}) as Record<string, unknown>;
  for (const src of [am, um]) {
    for (const key of ['membership_plan', 'plan', 'subscription_plan']) {
      const value = String(src[key] ?? '').trim();
      if (value) return value;
    }
  }
  return null;
}

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getWeekKey(value: Date): string {
  const day = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const dayOfWeek = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() - dayOfWeek + 1);
  return day.toISOString().slice(0, 10);
}

function parseDays(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 30;
  return Math.min(Math.max(Math.round(value), 7), 90);
}

async function fetchAllUsers(
  adminClient: NonNullable<Awaited<ReturnType<typeof requireSupabaseRequestAuth>>['adminClient']>,
): Promise<User[]> {
  const allUsers: User[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error || !data) break;
    allUsers.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }

  return allUsers;
}

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

  for (const user of users) {
    const premium = isPremium(user);
    if (premium) premiumIds.add(user.id);
    const created = new Date(user.created_at);
    if (created.getTime() >= sinceMs) {
      const dayKey = toDateKey(created);
      newUsersByDay.set(dayKey, (newUsersByDay.get(dayKey) ?? 0) + 1);
      if (premium) {
        newPremiumByDay.set(dayKey, (newPremiumByDay.get(dayKey) ?? 0) + 1);
      }
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
    const timestamp = Number(row.timestamp);
    if (!Number.isFinite(timestamp)) continue;
    const dayKey = toDateKey(new Date(timestamp));
    if (!dauByDay.has(dayKey)) dauByDay.set(dayKey, new Set());
    dauByDay.get(dayKey)!.add(row.user_id);
    if (premiumIds.has(row.user_id)) {
      if (!premiumDauByDay.has(dayKey)) premiumDauByDay.set(dayKey, new Set());
      premiumDauByDay.get(dayKey)!.add(row.user_id);
    }
  }

  const dailySeries: UserAnalyticsDailySeries[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(Date.now() - index * 86400000);
    const dayKey = toDateKey(date);
    dailySeries.push({
      day: dayKey,
      newUsers: newUsersByDay.get(dayKey) ?? 0,
      dau: dauByDay.get(dayKey)?.size ?? 0,
      newPremium: newPremiumByDay.get(dayKey) ?? 0,
      activePremium: premiumDauByDay.get(dayKey)?.size ?? 0,
    });
  }

  const cohortMap = new Map<string, string[]>();
  for (const user of users) {
    const weekKey = getWeekKey(new Date(user.created_at));
    if (!cohortMap.has(weekKey)) cohortMap.set(weekKey, []);
    cohortMap.get(weekKey)!.push(user.id);
  }

  const msgDatesByUser = new Map<string, number[]>();
  for (const row of msgRows ?? []) {
    const timestamp = Number(row.timestamp);
    if (!Number.isFinite(timestamp)) continue;
    if (!msgDatesByUser.has(row.user_id)) msgDatesByUser.set(row.user_id, []);
    msgDatesByUser.get(row.user_id)!.push(timestamp);
  }

  const sortedWeeks = Array.from(cohortMap.keys()).sort();
  const retention: UserAnalyticsRetentionRow[] = sortedWeeks
    .slice(-10, -1)
    .reverse()
    .map((weekKey) => {
      const weekStartMs = new Date(weekKey).getTime();
      const nextWeekStart = weekStartMs + 7 * 86400000;
      const nextWeekEnd = weekStartMs + 14 * 86400000;
      const userIds = cohortMap.get(weekKey)!;
      const retained = userIds.filter((userId) => {
        return (msgDatesByUser.get(userId) ?? []).some((timestamp) => (
          timestamp >= nextWeekStart && timestamp < nextWeekEnd
        ));
      }).length;

      return {
        cohortWeek: weekKey,
        cohortSize: userIds.length,
        d7Retained: retained,
        d7RetentionRate: userIds.length > 0 ? retained / userIds.length : 0,
      };
    });

  const body: UserAnalyticsDashboardResponse = {
    overview: {
      totalUsers: users.length,
      totalPremium: premiumIds.size,
      conversionRate: users.length > 0 ? premiumIds.size / users.length : 0,
      activeToday: dauByDay.get(todayKey)?.size ?? 0,
      activePremiumToday: premiumDauByDay.get(todayKey)?.size ?? 0,
      newToday: newUsersByDay.get(todayKey) ?? 0,
      newPremiumToday: newPremiumByDay.get(todayKey) ?? 0,
    },
    dailySeries,
    retention,
    generatedAt: new Date().toISOString(),
  };

  res.status(200).json(body);
}

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
  const lowerQuery = query.toLowerCase();
  const found = users.find((user) => user.email?.toLowerCase() === lowerQuery || user.id === query);

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

export async function handleUserAnalyticsDashboard(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const auth = await requireSupabaseRequestAuth(req, res);
  if (!auth) {
    return;
  }

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
    return;
  }

  await handleDashboard(req, res, auth.adminClient);
}
